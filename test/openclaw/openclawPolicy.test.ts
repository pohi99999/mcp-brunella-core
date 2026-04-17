import { describe, expect, it } from 'vitest';
import {
  type OpenClawConfig,
  type OpenClawExecPacket,
  OpenClawConfigSchema,
  OpenClawExecPacketSchema,
  OpenClawGoalPacketSchema,
} from '../../src/integrations/openclaw/index.js';
import { classifyOpenClawPolicy, redactOpenClawPayload } from '../../src/integrations/openclaw/index.js';

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
});
