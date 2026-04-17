import express from 'express';
import { type AddressInfo } from 'net';
import { type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenClawRoutes } from '../../src/server/routes/openclaw.js';

let server: Server | undefined;
const originalBaseUrl = process.env.OPENCLAW_BASE_URL;
const nativeFetch = globalThis.fetch.bind(globalThis);

afterEach(async () => {
  if (originalBaseUrl === undefined) {
    delete process.env.OPENCLAW_BASE_URL;
  } else {
    process.env.OPENCLAW_BASE_URL = originalBaseUrl;
  }
  vi.unstubAllGlobals();
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    server = undefined;
  }
});

describe('OpenClaw HTTP routes', () => {
  it('serves an OpenClaw status snapshot from the route registry', async () => {
    delete process.env.OPENCLAW_BASE_URL;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/openclaw', createOpenClawRoutes());

    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/status`);
    const payload = await response.json() as {
      success?: boolean;
      data?: {
        health?: {
          state?: string;
        };
      };
    };

    expect(response.ok).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data?.health?.state).toBe('unconfigured');
  });

  it('serves preview and dispatch requests when OpenClaw is configured', async () => {
    process.env.OPENCLAW_BASE_URL = 'https://openclaw.example.com';

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.endsWith('/dispatch')) {
        return new Response(JSON.stringify({
          runId: 'run-1',
          status: 'completed',
          output: {
            message: 'done',
            sources: ['https://example.com'],
          },
          warnings: ['watchouts'],
          receivedAt: '2026-04-17T00:00:00.000Z',
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({
          state: 'ready',
          configured: true,
          reachable: true,
          baseUrl: 'https://openclaw.example.com',
          defaultTrustZone: 'amber',
          approvalThreshold: 'amber',
          enabledExecutors: ['research-agent'],
          redactionEnabled: true,
          lastCheckedAt: '2026-04-17T00:00:00.000Z',
          message: 'ready',
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }));

    const app = express();
    app.use(express.json());
    app.use('/api/v1/openclaw', createOpenClawRoutes());

    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const requestBody = {
      goal: {
        id: 'goal-1',
        goal: 'Preview OpenClaw',
        successCriteria: ['dry-run works'],
        requester: 'orchestrator',
        createdAt: '2026-04-17T00:00:00.000Z',
        correlationId: 'corr-goal-1',
      },
      execution: {
        id: 'exec-1',
        goalId: 'goal-1',
        targetAgent: 'research-agent',
        executionMode: 'read',
        toolScope: ['read_file'],
        allowedConnectors: [],
        requiresApproval: false,
        timeoutMs: 2_000,
        input: {},
        correlationId: 'corr-exec-1',
      },
      dryRun: true,
    };

    const dispatchRequestBody = {
      ...requestBody,
      dryRun: false,
    };

    const previewResponse = await nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const previewPayload = await previewResponse.json() as {
      success?: boolean;
      data?: {
        status?: string;
      };
    };

    const dispatchResponse = await nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dispatchRequestBody),
    });
    const dispatchPayload = await dispatchResponse.json() as {
      success?: boolean;
      data?: {
        status?: string;
      };
    };

    expect(previewResponse.ok).toBe(true);
    expect(previewPayload.success).toBe(true);
    expect(previewPayload.data?.status).toBe('dry_run');
    expect(dispatchResponse.ok).toBe(true);
    expect(dispatchPayload.success).toBe(true);
    expect(dispatchPayload.data?.status).toBe('success');
  });

  it('returns validation errors for malformed preview and dispatch requests', async () => {
    process.env.OPENCLAW_BASE_URL = 'https://openclaw.example.com';

    const app = express();
    app.use(express.json());
    app.use('/api/v1/openclaw', createOpenClawRoutes());

    server = app.listen(0);
    const address = server.address() as AddressInfo;

    const [previewResponse, dispatchResponse] = await Promise.all([
      nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
      nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
    ]);

    const previewPayload = await previewResponse.json() as { success?: boolean; error?: string };
    const dispatchPayload = await dispatchResponse.json() as { success?: boolean; error?: string };

    expect(previewResponse.status).toBe(400);
    expect(previewPayload.success).toBe(false);
    expect(previewPayload.error).toContain('Invalid input');
    expect(dispatchResponse.status).toBe(400);
    expect(dispatchPayload.success).toBe(false);
    expect(dispatchPayload.error).toContain('Invalid input');
  });

  it('returns a status error when runtime bootstrap fails', async () => {
    process.env.OPENCLAW_BASE_URL = 'https://openclaw.example.com';
    vi.stubGlobal('fetch', undefined);

    const app = express();
    app.use(express.json());
    app.use('/api/v1/openclaw', createOpenClawRoutes());

    server = app.listen(0);
    const address = server.address() as AddressInfo;

    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/status`);
    const payload = await response.json() as { success?: boolean; error?: string };

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('fetch');
  });
});
