import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpOpenClawGatewayAdapter,
  OpenClawConfigSchema,
  OpenClawExecPacketSchema,
  OpenClawGatewayError,
  OpenClawGatewayRequestSchema,
  OpenClawGoalPacketSchema,
  OpenClawGatewayResponseSchema,
  classifyOpenClawPolicy,
} from '../../src/integrations/openclaw/index.js';

function buildConfig(overrides: Record<string, unknown> = {}) {
  return OpenClawConfigSchema.parse({
    baseUrl: 'https://openclaw.example.com',
    apiKey: 'secret-token',
    timeoutMs: 5_000,
    retryCount: 0,
    retryDelayMs: 0,
    defaultTrustZone: 'amber',
    approvalThreshold: 'amber',
    enabled: true,
    allowedAgents: ['research-agent'],
    allowedToolPresets: ['read-only'],
    agentAllowlists: {},
    redaction: {
      enabled: true,
      mask: '[REDACTED]',
      sensitiveKeys: ['token', 'password'],
    },
    ...overrides,
  });
}

function buildGoal() {
  return OpenClawGoalPacketSchema.parse({
    id: 'goal-1',
    goal: 'OpenClaw runtime',
    successCriteria: ['status reachable'],
    requester: 'orchestrator',
    createdAt: '2026-04-17T00:00:00.000Z',
    correlationId: 'corr-goal-1',
  });
}

function buildExecution() {
  return OpenClawExecPacketSchema.parse({
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
  });
}

describe('OpenClaw gateway adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns an unconfigured snapshot when OpenClaw is disabled', async () => {
    const config = buildConfig({ baseUrl: null, enabled: false });
    const adapter = new HttpOpenClawGatewayAdapter(config, { fetchImpl: vi.fn() as unknown as typeof fetch });

    await expect(adapter.healthCheck()).resolves.toMatchObject({
      state: 'unconfigured',
      configured: false,
      reachable: false,
    });
  });

  it('returns a synthetic dry-run response without hitting fetch', async () => {
    const fetchMock = vi.fn();
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: true,
      packet: buildExecution(),
      policy,
    });

    const response = await adapter.dispatch(request);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe('dry_run');
    expect(response.runId).toContain('dry-run-');
  });

  it('uses the host fetch implementation when no fetch override is supplied', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const adapter = new HttpOpenClawGatewayAdapter(buildConfig());
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: true,
      packet: buildExecution(),
      policy,
    });

    const response = await adapter.dispatch(request);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe('dry_run');
  });

  it('throws when the host environment has no fetch implementation', () => {
    vi.stubGlobal('fetch', undefined);

    expect(() => new HttpOpenClawGatewayAdapter(buildConfig(), {})).toThrow(/fetch/i);
  });

  it('rejects dispatch and cancel calls when the adapter is unconfigured', async () => {
    const fetchMock = vi.fn();
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig({
      baseUrl: null,
      enabled: false,
    }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    await expect(adapter.dispatch(request)).rejects.toMatchObject({
      code: 'OPENCLAW_UNCONFIGURED',
    });
    await expect(adapter.cancelRun('run-123')).rejects.toMatchObject({
      code: 'OPENCLAW_UNCONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes gateway HTTP failures as retryable errors', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    }));
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    await expect(adapter.dispatch(request)).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes through explicit OpenClaw gateway errors from fetch', async () => {
    const fetchMock = vi.fn(async () => {
      throw new OpenClawGatewayError('direct gateway error', {
        details: {
          reason: 'manual',
        },
      });
    });
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    await expect(adapter.dispatch(request)).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      message: 'direct gateway error',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes generic fetch failures as gateway errors', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network broke');
    });
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    await expect(adapter.dispatch(request)).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      message: 'network broke',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes generic getRun fetch failures as gateway errors', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('run lookup broke');
    });
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(adapter.getRun('run-123')).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      message: 'run lookup broke',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes through explicit getRun OpenClawGatewayError failures', async () => {
    const fetchMock = vi.fn(async () => {
      throw new OpenClawGatewayError('run lookup direct error');
    });
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(adapter.getRun('run-123')).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      message: 'run lookup direct error',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses successful gateway responses', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      runId: 'run-1',
      status: 'completed',
      output: { message: 'done' },
      warnings: ['watchouts'],
      receivedAt: '2026-04-17T00:00:00.000Z',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });
    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-1',
      correlationId: 'corr-exec-1',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    const response = await adapter.dispatch(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      runId: 'run-1',
      status: 'completed',
      warnings: ['watchouts'],
    });
    expect(OpenClawGatewayResponseSchema.parse(response).runId).toBe('run-1');
  });

  it('fetches run details and cancels runs using the normalized base URL and auth headers', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (input instanceof Request) {
        expect(input.headers.get('authorization')).toBe('Bearer sk-test-api-key');
        expect(input.headers.get('x-openclaw-api-key-ref')).toBe('secret/openclaw/api-key');
        expect(input.headers.get('x-openclaw-token-ref')).toBe('secret/openclaw/token');
      }

      if (url.endsWith('/runs/run-123')) {
        return new Response(JSON.stringify({
          runId: 'run-123',
          status: 'running',
          output: { message: 'still running' },
          warnings: [],
          receivedAt: '2026-04-17T01:00:00.000Z',
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (url.endsWith('/runs/run-123/cancel')) {
        return new Response(JSON.stringify({
          runId: 'run-123',
          status: 'cancelled',
          output: null,
          warnings: ['user cancelled'],
          receivedAt: '2026-04-17T01:00:01.000Z',
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const adapter = new HttpOpenClawGatewayAdapter(buildConfig({
      baseUrl: 'https://openclaw.example.com/',
      apiKey: 'sk-test-api-key',
      apiKeyRef: 'secret/openclaw/api-key',
      tokenRef: 'secret/openclaw/token',
    }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const run = await adapter.getRun('run-123');
    const cancelled = await adapter.cancelRun('run-123');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(run).toMatchObject({
      runId: 'run-123',
      status: 'running',
    });
    expect(cancelled).toBeUndefined();
    expect(OpenClawGatewayResponseSchema.parse(run).runId).toBe('run-123');
    expect(fetchMock.mock.calls[1]?.[0]).toBeDefined();
  });

  it('rejects blank run identifiers before performing any fetch calls', async () => {
    const fetchMock = vi.fn();
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig(), { fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(adapter.getRun('')).rejects.toThrow(/run id/i);
    await expect(adapter.cancelRun('')).rejects.toThrow(/run id/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an offline health snapshot when the health request fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    const adapter = new HttpOpenClawGatewayAdapter(buildConfig({
      baseUrl: 'https://openclaw.example.com',
    }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const health = await adapter.healthCheck();

    expect(health.state).toBe('offline');
    expect(health.reachable).toBe(false);
    expect(health.message).toContain('network down');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient gateway failures before succeeding', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporary failure', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId: 'run-retry',
        status: 'completed',
        output: { message: 'done after retry' },
        warnings: [],
        receivedAt: '2026-04-17T02:00:00.000Z',
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }));

    const adapter = new HttpOpenClawGatewayAdapter(buildConfig({
      baseUrl: 'https://openclaw.example.com',
      retryCount: 1,
      retryDelayMs: 0,
    }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const policy = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());
    const request = OpenClawGatewayRequestSchema.parse({
      id: 'exec-retry',
      correlationId: 'corr-exec-retry',
      dryRun: false,
      packet: buildExecution(),
      policy,
    });

    const response = await adapter.dispatch(request);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      runId: 'run-retry',
      status: 'completed',
    });
  });

  it('retries cancelRun failures before surfacing the final error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporary failure', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }))
      .mockResolvedValueOnce(new Response('temporary failure', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }));

    const adapter = new HttpOpenClawGatewayAdapter(buildConfig({
      baseUrl: 'https://openclaw.example.com',
      retryCount: 1,
      retryDelayMs: 1,
    }), {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(adapter.cancelRun('run-retry')).rejects.toMatchObject({
      code: 'OPENCLAW_GATEWAY_ERROR',
      retryable: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
