import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenClawCliHandlers, formatOpenClawCliPayload } from '../../src/cli/openclawCommands.js';

const originalBaseUrl = process.env.OPENCLAW_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) {
    delete process.env.OPENCLAW_BASE_URL;
  } else {
    process.env.OPENCLAW_BASE_URL = originalBaseUrl;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OpenClaw CLI handlers', () => {
  it('formats CLI payloads as pretty JSON', () => {
    const payload = formatOpenClawCliPayload({
      ok: true,
      result: {
        status: 'dry_run',
      },
    });

    expect(payload).toContain('"status": "dry_run"');
    expect(payload).toContain('"ok": true');
  });

  it('returns a status payload and a dry-run preview payload', async () => {
    process.env.OPENCLAW_BASE_URL = 'https://openclaw.example.com';

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
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
    })));

    const handlers = createOpenClawCliHandlers();
    const statusPayload = await handlers.status();
    const previewPayload = await handlers.preview(JSON.stringify({
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
    }));

    expect(statusPayload.ok).toBe(true);
    expect((statusPayload.health as { state?: string } | undefined)?.state).toBe('ready');
    expect(previewPayload.ok).toBe(true);
    expect((previewPayload.result as { status?: string } | undefined)?.status).toBe('dry_run');
  });

  it('returns a status error when runtime bootstrap fails', async () => {
    process.env.OPENCLAW_BASE_URL = 'https://openclaw.example.com';
    vi.stubGlobal('fetch', undefined);

    const handlers = createOpenClawCliHandlers();
    const statusPayload = await handlers.status();

    expect(statusPayload.ok).toBe(false);
    expect(statusPayload.error).toContain('fetch');
  });

  it('returns a preview error when the request payload is invalid', async () => {
    const handlers = createOpenClawCliHandlers();
    const previewPayload = await handlers.preview('{}');

    expect(previewPayload.ok).toBe(false);
    expect(previewPayload.error).toContain('Invalid');
  });
});
