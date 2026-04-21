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
  buildEvidenceFromGatewayResponse,
} from '../../src/integrations/openclaw/index.js';

function buildConfig(overrides: Record<string, unknown> = {}) {
  const baseRedaction = {
    enabled: true,
    mask: '[REDACTED]',
    sensitiveKeys: ['token', 'password'],
  };

  const config = {
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
    ...overrides,
    redaction: {
      ...baseRedaction,
      ...(overrides.redaction as Record<string, unknown> | undefined),
    },
  };

  return OpenClawConfigSchema.parse(config);
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

function buildMixedEvidenceGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-2',
    status: 'completed',
    output: {
      sources: [
        'https://example.com/one',
        {
          url: 'https://example.com/two',
          label: 'Two',
          note: 'secondary',
        },
      ],
      artifacts: [
        'dist/output.txt',
        {
          path: 'dist/bundle.js',
          kind: 'bundle',
          checksum: 'abc123',
          note: 'compiled output',
        },
      ],
      logs: [
        'string log entry',
        {
          level: 'warn',
          message: 'structured log entry',
          timestamp: '2026-04-17T00:05:00.000Z',
          source: 'pipeline',
          metadata: {
            step: 1,
          },
        },
      ],
      diffs: [
        'src/index.ts',
        {
          path: 'src/other.ts',
          changeType: 'added',
          summary: 'new file',
          patch: '@@ -0,0 +1 @@',
        },
      ],
      testResults: [
        'vitest smoke',
        {
          name: 'jest',
          passed: false,
          summary: 'failed',
          details: 'oops',
          durationMs: 12,
        },
      ],
      confidence: 0.5,
      metadata: {
        origin: 'mixed-response',
      },
    },
    warnings: [],
    receivedAt: '2026-04-17T00:05:00.000Z',
  });
}

function buildMetadataOnlyGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-7',
    status: 'completed',
    output: {
      message: 'metadata only',
      metadata: {
        source: 'metadata-path',
        channel: 'test',
      },
    },
    warnings: [],
    receivedAt: '2026-04-17T00:10:00.000Z',
  });
}

function buildEvidenceWithoutMetadataGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-8',
    status: 'completed',
    output: {
      message: 'evidence without metadata',
    },
    evidence: {
      id: 'evidence-8',
      goalId: 'goal-1',
      executionId: 'exec-1',
      sources: [],
      artifacts: [],
      logs: [],
      diffs: [],
      testResults: [],
      confidence: 0.2,
      capturedAt: '2026-04-17T00:11:00.000Z',
      redactionApplied: false,
    },
    warnings: [],
    receivedAt: '2026-04-17T00:11:00.000Z',
  });
}

function buildIdentifiedEvidenceGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-6',
    status: 'completed',
    output: {
      sources: [
        {
          id: 'source-identified',
          url: 'https://example.com/source',
          label: 'Source',
        },
      ],
      artifacts: [
        {
          id: 'artifact-identified',
          path: 'dist/identified.txt',
          kind: 'file',
          checksum: 'def456',
        },
      ],
      logs: [
        {
          id: 'log-identified',
          level: 'debug',
          message: 'identified log entry',
          timestamp: '2026-04-17T00:09:00.000Z',
        },
      ],
      diffs: [
        {
          id: 'diff-identified',
          path: 'src/identified.ts',
          changeType: 'modified',
          summary: 'identified diff',
        },
      ],
      testResults: [
        {
          id: 'test-identified',
          name: 'identified suite',
          passed: true,
          summary: 'ok',
        },
      ],
      confidence: 0.8,
    },
    warnings: [],
    receivedAt: '2026-04-17T00:09:00.000Z',
  });
}

function buildPassthroughGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-3',
    status: 'completed',
    output: {
      message: 'unused because evidence is already present',
    },
    evidence: {
      id: 'evidence-3',
      goalId: 'goal-1',
      executionId: 'exec-1',
      sources: [
        {
          id: 'source-3',
          url: 'https://example.com/passthrough',
        },
      ],
      artifacts: [],
      logs: [],
      diffs: [],
      testResults: [],
      confidence: 0.75,
      capturedAt: '2026-04-17T00:06:00.000Z',
      redactionApplied: false,
      metadata: {
        source: 'gateway',
      },
    },
    warnings: ['passthrough'],
    receivedAt: '2026-04-17T00:06:00.000Z',
  });
}

function buildCircularGatewayResponse() {
  const circular = {
    label: 'circular',
  } as Record<string, unknown>;
  circular.self = circular;

  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-4',
    status: 'completed',
    output: circular,
    warnings: [],
    receivedAt: '2026-04-17T00:07:00.000Z',
  });
}

function buildEmptyStringGatewayResponse() {
  return OpenClawGatewayResponseSchema.parse({
    runId: 'run-5',
    status: 'completed',
    output: '',
    warnings: [],
    receivedAt: '2026-04-17T00:08:00.000Z',
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

  it('fails when a directly dispatchable green task is rejected by the gateway', async () => {
    const gateway = {
      ...buildGatewayMock(),
      dispatch: vi.fn(async () => {
        throw new Error('direct dispatch exploded');
      }),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway: gateway as never,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution(),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(result.status).toBe('failed');
    expect(result.approvalState).toBe('not_required');
    expect(result.message).toBe('OpenClaw dispatch failed');
    expect(result.error).toContain('direct dispatch exploded');
    expect(result.correlationId).toBe('goal-only-correlation');
    expect(result.trackId).toBe('goal-only-track');
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
  });

  it('uses the default dry-run and success messages when the gateway returns no warnings', async () => {
    const gateway = {
      ...buildGatewayMock(),
      dispatch: vi.fn(async () => OpenClawGatewayResponseSchema.parse({
        runId: 'run-default',
        status: 'completed',
        output: { message: 'done' },
        warnings: [],
        receivedAt: '2026-04-17T00:00:00.000Z',
      })),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway: gateway as never,
      logger: undefined,
    });

    const successResult = await dispatcher.dispatch({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution(),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });
    const previewResult = await dispatcher.preview({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution({
          executionMode: 'constrained_write',
          toolScope: ['write_file'],
        }),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(successResult.message).toBe('OpenClaw dispatch completed');
    expect(successResult.correlationId).toBe('goal-only-correlation');
    expect(successResult.trackId).toBe('goal-only-track');
    expect(previewResult.message).toBe('Dry run completed');
    expect(previewResult.approvalState).toBe('skipped');
    expect(previewResult.correlationId).toBe('goal-only-correlation');
    expect(previewResult.trackId).toBe('goal-only-track');
  });

  it('returns a pending dry-run block when evaluation says approval is required but not eligible', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      logger: undefined,
    });

    dispatcher.evaluate = vi.fn(() => ({
      id: 'policy-1',
      goalId: 'goal-1',
      targetAgent: 'research-agent',
      trustZone: 'amber',
      executionMode: 'constrained_write',
      verdict: 'fail',
      canDispatch: false,
      requiresApproval: true,
      approvalEligible: false,
      reasonCodes: ['CUSTOM_POLICY'],
      blockedReasons: [],
      isDestructive: false,
      redactionApplied: false,
      createdAt: '2026-04-17T00:00:00.000Z',
      correlationId: 'corr-exec-1',
      metadata: {},
    })) as never;

    const result = await dispatcher.preview({
      goal: buildGoal(),
      execution: buildExecution(),
    });

    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('pending');
    expect(result.message).toContain('OpenClaw dry-run blocked by policy.');
  });

  it('normalizes mixed evidence payloads from the gateway response', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const evidence = buildEvidenceFromGatewayResponse(request, buildMixedEvidenceGatewayResponse(), false);

    expect(evidence.sources).toHaveLength(2);
    expect(evidence.artifacts).toHaveLength(2);
    expect(evidence.logs).toHaveLength(2);
    expect(evidence.diffs).toHaveLength(2);
    expect(evidence.testResults).toHaveLength(2);
    expect(evidence.confidence).toBe(0.5);
    expect(evidence.metadata?.gatewayStatus).toBe('completed');
  });

  it('preserves explicit ids when the gateway payload already provides them', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const evidence = buildEvidenceFromGatewayResponse(request, buildIdentifiedEvidenceGatewayResponse(), false);

    expect(evidence.sources[0]?.id).toBe('source-identified');
    expect(evidence.artifacts[0]?.id).toBe('artifact-identified');
    expect(evidence.logs[0]?.id).toBe('log-identified');
    expect(evidence.diffs[0]?.id).toBe('diff-identified');
    expect(evidence.testResults[0]?.id).toBe('test-identified');
  });

  it('preserves evidence already returned by the gateway', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const evidence = buildEvidenceFromGatewayResponse(request, buildPassthroughGatewayResponse(), true);

    expect(evidence.id).toBe('evidence-3');
    expect(evidence.redactionApplied).toBe(true);
    expect(evidence.metadata).toMatchObject({
      gatewayStatus: 'completed',
      source: 'gateway',
    });
    expect(evidence.sources).toHaveLength(1);
  });

  it('preserves metadata from both the output payload and passthrough evidence', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const outputEvidence = buildEvidenceFromGatewayResponse(request, buildMetadataOnlyGatewayResponse(), false);
    const passthroughEvidence = buildEvidenceFromGatewayResponse(request, buildEvidenceWithoutMetadataGatewayResponse(), false);

    expect(outputEvidence.metadata).toMatchObject({
      gatewayStatus: 'completed',
      summary: 'metadata only',
      source: 'metadata-path',
      channel: 'test',
    });
    expect(passthroughEvidence.metadata).toMatchObject({
      gatewayStatus: 'completed',
      correlationId: 'corr-exec-1',
    });
  });

  it('normalizes fallback evidence fields when optional gateway output data is absent', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const evidence = buildEvidenceFromGatewayResponse(request, OpenClawGatewayResponseSchema.parse({
      runId: 'run-9',
      status: 'completed',
      output: {
        sources: [{ url: 'https://example.com/fallback-source' }],
        logs: [{ message: 'fallback log' }],
        diffs: [
          { path: 'src/fallback.ts', changeType: 'modified' },
          { path: 'src/unknown.ts' },
        ],
        testResults: [{ name: 'fallback suite' }],
        metadata: {
          source: 'raw-output',
        },
      },
      warnings: [],
      receivedAt: '2026-04-17T00:12:00.000Z',
    }), false);

    expect(evidence.sources[0]?.label).toBeUndefined();
    expect(evidence.sources[0]?.note).toBeUndefined();
    expect(evidence.logs[0]?.level).toBe('info');
    expect(evidence.logs[0]?.timestamp).toBe('2026-04-17T00:12:00.000Z');
    expect(evidence.confidence).toBeUndefined();
    expect(evidence.diffs[0]?.summary).toBeUndefined();
    expect(evidence.diffs[1]?.changeType).toBe('unknown');
    expect(evidence.testResults[0]?.passed).toBe(false);
    expect(evidence.metadata).toMatchObject({
      gatewayStatus: 'completed',
      source: 'raw-output',
    });
  });

  it('falls back to stringified output when the gateway payload is circular', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    const evidence = buildEvidenceFromGatewayResponse(request, buildCircularGatewayResponse(), false);

    expect(evidence.logs).toHaveLength(1);
    expect(evidence.logs[0]?.message).toBe('[object Object]');
  });

  it('throws when the fallback stringified log message would be empty', () => {
    const request = {
      goal: buildGoal(),
      execution: buildExecution(),
    };

    expect(() => buildEvidenceFromGatewayResponse(request, buildEmptyStringGatewayResponse(), false)).toThrow();
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

  it('requests approval for green tasks that explicitly require approval', async () => {
    const gateway = buildGatewayMock();
    const approvalService = {
      requestApproval: vi.fn(async (_request: OpenClawApprovalRequest): Promise<OpenClawApprovalDecision> => ({
        approved: true,
        reviewer: 'human-reviewer',
        decidedAt: '2026-04-17T00:02:00.000Z',
      })),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      approvalService,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution({
          requiresApproval: true,
        }),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(result.policy.trustZone).toBe('green');
    expect(result.policy.requiresApproval).toBe(true);
    expect(approvalService.requestApproval).toHaveBeenCalledTimes(1);
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
    expect(result.approvalState).toBe('approved');
    expect(result.approvedBy).toBe('human-reviewer');
    expect(result.correlationId).toBe('goal-only-correlation');
    expect(result.trackId).toBe('goal-only-track');
  });

  it('blocks amber tasks when approval is denied', async () => {
    const gateway = buildGatewayMock();
    const approvalService = {
      requestApproval: vi.fn(async (_request: OpenClawApprovalRequest): Promise<OpenClawApprovalDecision> => ({
        approved: false,
        reviewer: 'human-reviewer',
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
    expect(result.message).toBe('OpenClaw approval denied.');
  });

  it('blocks dry-run requests before gateway dispatch when they are not eligible', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig({
        allowedAgents: ['exec-agent'],
      }),
      gateway,
      logger: undefined,
    });

    const result = await dispatcher.preview({
      goal: buildGoal(),
      execution: buildExecution(),
    });

    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('skipped');
    expect(gateway.dispatch).not.toHaveBeenCalled();
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

  it('returns a dry-run preview without dispatching to the gateway', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      logger: undefined,
    });

    const result = await dispatcher.preview({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution(),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(result.status).toBe('dry_run');
    expect(result.approvalState).toBe('not_required');
    expect(result.redactionApplied).toBe(false);
    expect(result.correlationId).toBe('goal-only-correlation');
    expect(result.trackId).toBe('goal-only-track');
    expect(gateway.dispatch).toHaveBeenCalledTimes(1);
    const [dispatchRequest] = gateway.dispatch.mock.calls[0] as unknown as [
      { dryRun?: boolean }
    ];
    expect(dispatchRequest).toMatchObject({
      dryRun: true,
    });
  });

  it('marks dry-run gateway failures as failed results', async () => {
    const gateway = {
      ...buildGatewayMock(),
      dispatch: vi.fn(async () => {
        throw new Error('dry-run gateway exploded');
      }),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway: gateway as never,
      logger: undefined,
    });

    const result = await dispatcher.preview({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution(),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(result.status).toBe('failed');
    expect(result.approvalState).toBe('skipped');
    expect(result.message).toBe('OpenClaw dispatch failed');
    expect(result.error).toContain('dry-run gateway exploded');
    expect(result.correlationId).toBe('goal-only-correlation');
    expect(result.trackId).toBe('goal-only-track');
  });

  it('blocks non-eligible requests before gateway dispatch', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig({
        allowedAgents: ['exec-agent'],
      }),
      gateway,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: {
        ...buildGoal(),
        correlationId: 'goal-only-correlation',
        trackId: 'goal-only-track',
      },
      execution: {
        ...buildExecution(),
        correlationId: undefined,
        trackId: undefined,
      } as never,
    });

    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('skipped');
    expect(result.correlationId).toBe('goal-only-correlation');
    expect(result.trackId).toBe('goal-only-track');
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it('uses the default blocked reason when policy does not provide one', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      logger: undefined,
    });

    dispatcher.evaluate = vi.fn(() => ({
      id: 'policy-empty-block',
      goalId: 'goal-1',
      targetAgent: 'research-agent',
      trustZone: 'amber',
      executionMode: 'read',
      verdict: 'fail',
      canDispatch: false,
      requiresApproval: false,
      approvalEligible: false,
      reasonCodes: ['CUSTOM_POLICY'],
      blockedReasons: [],
      isDestructive: false,
      redactionApplied: false,
      createdAt: '2026-04-17T00:00:00.000Z',
      correlationId: 'corr-exec-1',
      metadata: {},
    })) as never;

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution(),
    });

    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('skipped');
    expect(result.message).toBe('OpenClaw task is not approval eligible.');
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it('blocks amber requests when no approval service is configured', async () => {
    const gateway = buildGatewayMock();
    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig(),
      gateway,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution({
        executionMode: 'constrained_write',
        toolScope: ['write_file'],
      }),
    });

    expect(result.status).toBe('blocked');
    expect(result.approvalState).toBe('pending');
    expect(result.message).toContain('approval service is not configured');
    expect(gateway.dispatch).not.toHaveBeenCalled();
  });

  it('fails when the approval service rejects the request', async () => {
    const gateway = buildGatewayMock();
    const approvalService = {
      requestApproval: vi.fn(async () => {
        throw new Error('approval service unavailable');
      }),
    };

    const dispatcher = new OpenClawTaskDispatcher({
      config: buildConfig({
        approvalThreshold: 'amber',
      }),
      gateway,
      approvalService: approvalService as never,
      logger: undefined,
    });

    const result = await dispatcher.dispatch({
      goal: buildGoal(),
      execution: buildExecution({
        executionMode: 'constrained_write',
        toolScope: ['write_file'],
      }),
    });

    expect(result.status).toBe('failed');
    expect(result.approvalState).toBe('pending');
    expect(gateway.dispatch).not.toHaveBeenCalled();
    expect(approvalService.requestApproval).toHaveBeenCalledTimes(1);
  });

  it('fails when the gateway rejects an approved request', async () => {
    const gateway = {
      ...buildGatewayMock(),
      dispatch: vi.fn(async () => {
        throw new Error('approved gateway exploded');
      }),
    };

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
      gateway: gateway as never,
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

    expect(result.status).toBe('failed');
    expect(result.approvalState).toBe('approved');
    expect(result.message).toBe('OpenClaw dispatch failed');
    expect(result.error).toContain('approved gateway exploded');
    expect(approvalService.requestApproval).toHaveBeenCalledTimes(1);
  });
});
