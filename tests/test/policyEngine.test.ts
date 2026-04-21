import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditRecordMock } = vi.hoisted(() => ({
  auditRecordMock: vi.fn(),
}));

vi.mock('../src/core/auditLog.js', () => ({
  record: auditRecordMock,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

async function freshPolicyModules() {
  vi.resetModules();
  const policyModule = await import('../src/core/policyEngine.js');
  const phoenixModule = await import('../src/core/phoenixEventBus.js');
  return {
    policyModule,
    phoenixModule,
  };
}

describe('PolicyEngine', () => {
  beforeEach(() => {
    auditRecordMock.mockReset();
  });

  it('marks GitHub workflow failures as guarded remediation-first decisions', async () => {
    const { policyModule } = await freshPolicyModules();

    const decision = policyModule.evaluatePolicy({
      event: {
        id: 'evt-1',
        source: 'github',
        type: 'github.workflow_run.failure',
        priority: 'high',
        riskHint: 'guarded',
        dedupKey: 'github:workflow:1',
        payload: {},
        timestamp: '2026-03-29T12:00:00.000Z',
      },
      agentName: 'Developer',
      resource: 'src/server/routes/webhooks.ts',
    });

    expect(decision.actionClass).toBe('guarded');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.riskScore).toBeGreaterThan(50);
    expect(decision.guardrails).toContain('require_final_approval');
  });

  it('marks health signals as safe autonomous decisions', async () => {
    const { policyModule } = await freshPolicyModules();

    const decision = policyModule.evaluatePolicy({
      event: {
        id: 'evt-2',
        source: 'health',
        type: 'health.degraded',
        priority: 'medium',
        riskHint: 'safe',
        dedupKey: 'health:degraded:1',
        payload: {},
        timestamp: '2026-03-29T12:00:00.000Z',
      },
    });

    expect(decision.actionClass).toBe('safe');
    expect(decision.requiresApproval).toBe(false);
    expect(decision.autonomyLevel).toBe('high');
  });

  it('marks protected resources as dangerous', async () => {
    const { policyModule } = await freshPolicyModules();

    const decision = policyModule.evaluatePolicy({
      event: {
        id: 'evt-3',
        source: 'manual',
        type: 'manual.request',
        priority: 'medium',
        dedupKey: 'manual:1',
        payload: {},
        timestamp: '2026-03-29T12:00:00.000Z',
      },
      resource: 'src/server/web.ts',
    });

    expect(decision.actionClass).toBe('dangerous');
    expect(decision.auditResult).toBe('DENIED');
    expect(decision.guardrails).toContain('deny_autonomous_execution');
  });

  it('logs decisions to audit and phoenix event bus', async () => {
    const { policyModule, phoenixModule } = await freshPolicyModules();
    const handler = vi.fn();
    phoenixModule.phoenixEventBus.subscribe('phoenix:policy_decision', handler);

    const decision = await policyModule.evaluateAndLogPolicy({
      event: {
        id: 'evt-4',
        source: 'scheduler',
        type: 'scheduler.task.failed',
        priority: 'high',
        riskHint: 'guarded',
        dedupKey: 'scheduler:1',
        payload: {},
        timestamp: '2026-03-29T12:00:00.000Z',
      },
      agentName: 'ScheduledTasksRunner',
      resource: 'weekly-ai-research',
    });

    expect(decision.actionClass).toBe('guarded');
    expect(auditRecordMock).toHaveBeenCalledOnce();
    expect(auditRecordMock).toHaveBeenCalledWith(
      'ALLOWED',
      'ScheduledTasksRunner',
      'policy:scheduler.task.failed',
      'weekly-ai-research',
      expect.stringContaining('riskScore='),
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        actionClass: 'guarded',
        requiresApproval: true,
        source: 'scheduler',
      }),
    );
  });
});
