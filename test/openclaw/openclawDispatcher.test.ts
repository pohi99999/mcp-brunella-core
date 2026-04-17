import { describe, expect, it, vi } from 'vitest';
import {
  OpenClawApprovalDecision,
  OpenClawApprovalRequest,
  OpenClawConfigSchema,
  OpenClawDispatchResultSchema,
  OpenClawExecPacketSchema,
  OpenClawGatewayAdapter,
  OpenClawGatewayResponseSchema,
  OpenClawGoalPacketSchema,
  OpenClawStatusSnapshotSchema,
  OpenClawTaskDispatcher,
} from '../../src/integrations/openclaw/index.js';

function buildConfig() {
  return OpenClawConfigSchema.parse({
    baseUrl: 'https://openclaw.example.com',
    apiKey: 'secret-token',
    timeoutMs: 5_000,
    retryCount: 0,
    retryDelayMs: 0,
    defaultTrustZone: 'amber',
    approvalThreshold: 'amber',
    enabled: true,
    allowedAgents: ['research-agent', 'exec-agent'],
    allowedToolPresets: ['read-only'],
    agentAllowlists: {},
    redaction: {
      enabled: true,
      mask: '[REDACTED]',
      sensitiveKeys: ['token', 'password'],
    },
  });
}

function buildGoal() {
  return OpenClawGoalPacketSchema.parse({
    id: 'goal-1',
    goal: 'Integrate OpenClaw',
    successCriteria: ['scaffold exists'],
    requester: 'orchestrator',
    createdAt: '2026-04-17T00:00:00.000Z',
    correlationId: 'corr-goal-1',
  });
}

function buildExecution(overrides: Record<string, unknown> = {}) {
  return OpenClawExecPacketSchema.parse({
    id: 'exec-1',
    goalId: 'goal-1',
    targetAgent: 'research-agent',
    executionMode: 'read',
    toolScope: ['read_file'],
    allowedConnectors: [],
    requiresApproval: false,
    timeoutMs: 2_000,
    input: {
      query: 'read the repo',
    },
    metadata: {
      source: 'test',
    },
    correlationId: 'corr-exec-1',
    ...overrides,
  });
}

function buildGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-1',
    status: 'completed',
    output: {
      message: 'done',
      sources: ['https://example.com'],
      artifacts: [{ path: 'dist/output.txt' }],
      logs: ['build finished'],
      diffs: [{ path: 'src/index.ts', changeType: 'modified', summary: 'updated' }],
      testResults: [{ name: 'vitest', passed: true }],
      confidence: 0.9,
    },
    warnings: ['watchout'],
    receivedAt: '2026-04-17T00:00:00.000Z',
  });
}

function buildGatewayMock() {
  return {
    dispatch: vi.fn(async () => buildGatewayResponse()),
    getRun: vi.fn(),
    cancelRun: vi.fn(),
    healthCheck: vi.fn(async () => OpenClawStatusSnapshotSchema.parse({
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
      details: {},
    })),
  } satisfies OpenClawGatewayAdapter;
}

describe('OpenClaw task dispatcher', () => {
  it('dispatches green tasks directly and maps evidence from the gateway response', async () => {
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway: buildGatewayMock(),
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution(),
    });

    expect(result.status).toBe('success');
    expect(result.approvalState).toBe('not_required');
    expect(result.redactionApplied).toBe(false);
    expect(result.gatewayResponse?.runId).toBe('run-1');
    expect(result.evidence?.sources).toHaveLength(1);
    expect(result.evidence?.artifacts).toHaveLength(1);
    expect(result.evidence?.logs).toHaveLength(2);
    expect(result.evidence?.diffs).toHaveLength(1);
    expect(result.evidence?.testResults).toHaveLength(1);
    expect(OpenClawDispatchResultSchema.parse(result).status).toBe('success');
  });

  it('requests approval for amber tasks before dispatching', async () => {
    const gateway = buildGatewayMock();
    const approvalService = {
      requestApproval: vi.fn(async (_request: OpenClawApprovalRequest): Promise<OpenClawApprovalDecision> => ({
        approved: true,
        reviewer: 'human-reviewer',
        reason: 'approved',
        decidedAt: '2026-04-17T00:01:00.000Z',
      })),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      approvalService,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution({
        executionMode: 'constrained_write',
        toolScope: ['write_file'],
      }),
    });

    expect(approvalService.requestApproval).toHaveBeenCalledTimes(1);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.approvalState).toBe('approved');
    expect(result.approvedBy).toBe('human-reviewer');
  });

  it('blocks amber tasks when approval is denied', async () => {
    const gateway = buildGatewayMock();
    const approvalService = {
      requestApproval: vi.fn(async (_request: OpenClawApprovalRequest): Promise<OpenClawApprovalDecision> => ({
        approved: false,
        reviewer: 'human-reviewer',
        reason: 'not now',
        decidedAt: '2026-04-17T00:01:00.000Z',
      })),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      approvalService,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution({
        executionMode: 'constrained_write',
        toolScope: ['write_file'],
      }),
    });

    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('denied');
    expect(result.message).toContain('not now');
  });

  it('marks secret-bearing payloads as redacted', async () => {
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway: buildGatewayMock(),
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution({
        input: {
          password: 'super-secret',
          nested: {
            token: 'abc123',
          },
        },
      }),
    });

    expect(result.redactionApplied).toBe(true);
  });
});
