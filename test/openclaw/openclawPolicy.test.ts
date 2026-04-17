import { describe, expect, it } from 'vitest';
import {
  type OpenClawConfig,
  type OpenClawExecPacket,
  OpenClawConfigSchema,
  OpenClawExecPacketSchema,
  OpenClawGoalPacketSchema,
} from '../../src/integrations/openclaw/index.js';
import {
  buildOpenClawApprovalRequest,
  classifyOpenClawPolicy,
  mapApprovalStateToDispatchStatus,
  redactOpenClawPayload,
} from '../../src/integrations/openclaw/index.js';

function buildConfig(overrides: Partial<OpenClawConfig> = {}) {
  return OpenClawConfigSchema.parse({
    baseUrl: 'https://openclaw.example.com',
    apiKey: 'secret-token',
    timeoutMs: 10_000,
    retryCount: 1,
    retryDelayMs: 100,
    defaultTrustZone: 'amber',
    approvalThreshold: 'amber',
    enabled: true,
    allowedAgents: ['research-agent', 'exec-agent'],
    allowedToolPresets: ['read-only'],
    agentAllowlists: {},
    redaction: {
      enabled: true,
      mask: '[REDACTED]',
      sensitiveKeys: ['token', 'password', 'secret'],
    },
    ...overrides,
  });
}

function buildGoal() {
  return OpenClawGoalPacketSchema.parse({
    id: 'goal-1',
    goal: 'Integrate OpenClaw safely',
    successCriteria: ['Type-safe scaffold', 'Tests pass'],
    requester: 'orchestrator',
    createdAt: '2026-04-17T00:00:00.000Z',
    correlationId: 'corr-goal-1',
    metadata: {
      project: 'brunella',
    },
  });
}

function buildExecution(overrides: Partial<OpenClawExecPacket> = {}) {
  return OpenClawExecPacketSchema.parse({
    id: 'exec-1',
    goalId: 'goal-1',
    targetAgent: 'research-agent',
    executionMode: 'read',
    toolScope: ['read_file', 'list_directory'],
    allowedConnectors: [],
    requiresApproval: false,
    timeoutMs: 5_000,
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

describe('OpenClaw policy translation', () => {
  it('auto-approves read-only green tasks', () => {
    const decision = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, buildConfig());

    expect(decision.trustZone).toBe('green');
    expect(decision.verdict).toBe('pass');
    expect(decision.canDispatch).toBe(true);
    expect(decision.requiresApproval).toBe(false);
    expect(decision.approvalEligible).toBe(false);
    expect(decision.reasonCodes).toContain('READ_ONLY_SCOPE');
  });

  it('escalates constrained writes to review', () => {
    const execution = buildExecution({
      executionMode: 'constrained_write',
      toolScope: ['write_file'],
    });

    const decision = classifyOpenClawPolicy({ goal: buildGoal(), execution }, buildConfig());

    expect(decision.trustZone).toBe('amber');
    expect(decision.verdict).toBe('needs_review');
    expect(decision.canDispatch).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.approvalEligible).toBe(true);
    expect(decision.reasonCodes).toContain('CONSTRAINED_WRITE_SCOPE');
  });

  it('escalates green tasks to review when the approval threshold is strict', () => {
    const config = buildConfig({ approvalThreshold: 'green' });
    const decision = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, config);

    expect(decision.trustZone).toBe('green');
    expect(decision.verdict).toBe('needs_review');
    expect(decision.canDispatch).toBe(false);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.approvalEligible).toBe(true);
  });

  it('fails when the target agent is not allowlisted', () => {
    const config = buildConfig({
      allowedAgents: ['approved-agent'],
    });

    const decision = classifyOpenClawPolicy({ goal: buildGoal(), execution: buildExecution() }, config);

    expect(decision.verdict).toBe('fail');
    expect(decision.canDispatch).toBe(false);
    expect(decision.approvalEligible).toBe(false);
    expect(decision.reasonCodes).toContain('AGENT_NOT_ALLOWED');
  });

  it('classifies broad exec/write/network combinations as red', () => {
    const execution = buildExecution({
      executionMode: 'exec',
      toolScope: ['shell', 'write_file'],
      allowedConnectors: ['network'],
    });

    const decision = classifyOpenClawPolicy({ goal: buildGoal(), execution }, buildConfig());

    expect(decision.trustZone).toBe('red');
    expect(decision.verdict).toBe('needs_review');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCodes).toContain('BROAD_EXECUTION_SURFACE');
  });

  it('redacts secrets and sensitive strings from payloads', () => {
    const redaction = redactOpenClawPayload({
      token: 'abc123',
      nested: {
        password: 'super-secret',
        contact: 'person@example.com',
      },
      safe: 'visible',
    }, buildConfig());

    expect(redaction.applied).toBe(true);
    expect(redaction.value).toEqual({
      token: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        contact: '[REDACTED]',
      },
      safe: 'visible',
    });
  });

  it('redacts sensitive plain string payloads directly', () => {
    const redaction = redactOpenClawPayload('Bearer abc123', buildConfig());

    expect(redaction.applied).toBe(true);
    expect(redaction.value).toBe('[REDACTED]');
  });

  it('detects sensitive data in arrays and external action requests', () => {
    const decision = classifyOpenClawPolicy(
      {
        goal: buildGoal(),
        execution: buildExecution({
          executionMode: 'external_action',
          toolScope: ['read_file'],
          allowedConnectors: ['slack'],
          input: ['visible', { nested: [{ token: 'abc123' }] }],
        }),
      },
      buildConfig(),
    );

    expect(decision.trustZone).toBe('amber');
    expect(decision.verdict).toBe('needs_review');
    expect(decision.redactionApplied).toBe(true);
    expect(decision.reasonCodes).toContain('EXTERNAL_ACTION_REQUIRED');
  });

  it('treats red approval thresholds as the strictest rank', () => {
    const decision = classifyOpenClawPolicy(
      {
        goal: buildGoal(),
        execution: buildExecution(),
      },
      buildConfig({ approvalThreshold: 'red' }),
    );

    expect(decision.trustZone).toBe('green');
    expect(decision.canDispatch).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it('falls back to the default severity rank for unknown thresholds', () => {
    const config = {
      ...buildConfig(),
      approvalThreshold: 'ultra-red',
    } as unknown as OpenClawConfig;

    const decision = classifyOpenClawPolicy(
      {
        goal: buildGoal(),
        execution: buildExecution(),
      },
      config,
    );

    expect(decision.trustZone).toBe('green');
    expect(decision.canDispatch).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it('rejects requests with missing required fields', () => {
    const decision = classifyOpenClawPolicy(
      {
        goal: {
          ...buildGoal(),
          goal: '',
        },
        execution: {
          ...buildExecution(),
          targetAgent: '',
          toolScope: [],
        },
      },
      buildConfig(),
    );

    expect(decision.verdict).toBe('fail');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.reasonCodes).toContain('MISSING_REQUIRED_FIELDS');
  });

  it('rejects agents that request tool scopes outside their allowlist', () => {
    const decision = classifyOpenClawPolicy(
      {
        goal: buildGoal(),
        execution: buildExecution({
          targetAgent: 'ops-agent',
          toolScope: ['write_file'],
        }),
      },
      buildConfig({
        allowedAgents: ['ops-agent'],
        agentAllowlists: {
          'ops-agent': ['read_file'],
        },
      }),
    );

    expect(decision.verdict).toBe('fail');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.reasonCodes).toContain('AGENT_TOOL_SCOPE_NOT_ALLOWED');
  });

  it('marks destructive tool scopes as red and blocked', () => {
    const decision = classifyOpenClawPolicy(
      {
        goal: buildGoal(),
        execution: buildExecution({
          executionMode: 'exec',
          toolScope: ['delete_workspace'],
        }),
      },
      buildConfig(),
    );

    expect(decision.trustZone).toBe('red');
    expect(decision.verdict).toBe('needs_review');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasonCodes).toContain('DESTRUCTIVE_OR_CREDENTIAL_TOUCHING_SCOPE');
  });

  it('builds an approval request from the policy decision', () => {
    const request: Parameters<typeof classifyOpenClawPolicy>[0] = {
      goal: {
        ...buildGoal(),
        goal: 'Ship the OpenClaw pilot safely',
        requester: 'brunella-orchestrator',
      },
      execution: {
        ...buildExecution(),
        id: 'exec-approval',
        targetAgent: 'research-agent',
        executionMode: 'read',
        toolScope: ['read_file'],
        allowedConnectors: ['github'],
        requiresApproval: true,
        timeoutMs: 8_000,
        metadata: {
          source: 'dashboard',
        },
      },
    };

    const decision = classifyOpenClawPolicy(request, buildConfig());
    const approval = buildOpenClawApprovalRequest(request, decision);

    expect(approval.goalId).toBe(request.goal.id);
    expect(approval.executionId).toBe(request.execution.id);
    expect(approval.agentName).toBe('research-agent');
    expect(approval.trustZone).toBe(decision.trustZone);
    expect(approval.reasonCodes).toEqual(decision.reasonCodes);
    expect(approval.summary).toContain('research-agent');
    expect(approval.summary).toContain(decision.trustZone);
    expect(approval.correlationId).toBe(request.execution.correlationId);
    expect(approval.metadata).toMatchObject({
      requester: 'brunella-orchestrator',
      executionMode: 'read',
    });
  });

  it('maps approval states to dispatch statuses', () => {
    expect(mapApprovalStateToDispatchStatus('approved', true)).toBe('success');
    expect(mapApprovalStateToDispatchStatus('approved', false)).toBe('failed');
    expect(mapApprovalStateToDispatchStatus('denied', true)).toBe('blocked');
    expect(mapApprovalStateToDispatchStatus('skipped', true)).toBe('dry_run');
    expect(mapApprovalStateToDispatchStatus('pending', false)).toBe('blocked');
    expect(mapApprovalStateToDispatchStatus('not_required' as never, false)).toBe('failed');
  });

  it('falls back to goal metadata when execution correlation and track ids are missing', () => {
    const goal = {
      ...buildGoal(),
      trackId: 'track-goal-only',
      correlationId: 'goal-correlation-only',
    };
    const execution = {
      ...buildExecution(),
      trackId: undefined,
      correlationId: undefined,
    };

    const decision = classifyOpenClawPolicy({
      goal: goal as never,
      execution: execution as never,
    }, buildConfig());

    const approvalRequest = buildOpenClawApprovalRequest({
      goal: goal as never,
      execution: execution as never,
    }, decision);

    expect(approvalRequest.correlationId).toBe(goal.correlationId);
  });
});
