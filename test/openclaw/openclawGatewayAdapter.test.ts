import { describe, expect, it, vi } from 'vitest';
import {
  HttpOpenClawGatewayAdapter,
  OpenClawConfigSchema,
  OpenClawExecPacketSchema,
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
});
