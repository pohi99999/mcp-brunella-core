import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -----------------------------------------------------------------------
// Hoist mocks BEFORE any imports that load the modules under test
// -----------------------------------------------------------------------
const { auditRecordMock } = vi.hoisted(() => ({
  auditRecordMock: vi.fn().mockResolvedValue(undefined),
}));

const { approvalRouterState } = vi.hoisted(() => {
  let workflowStatus: 'pending' | 'approved' | 'rejected' | 'expired' = 'pending';

  return {
    approvalRouterState: {
      createWorkflowFromPolicy: vi.fn().mockImplementation(async () => ({
        workflowId: 'wf-ephemeral',
        approvalRequestId: 'apr-ephemeral',
        eventId: 'evt-ephemeral',
        status: 'pending',
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
        timeoutMs: 60000,
        eventType: 'ephemeral.agent.budget_exceeded',
        source: 'ephemeral_manager',
        decision: {
          actionClass: 'guarded',
          riskScore: 78,
          autonomyLevel: 'low',
          requiresApproval: true,
          reason: 'Budget approval',
          guardrails: ['require_approval'],
          auditResult: 'ALLOWED',
        },
        eventPayload: {},
        callback: {
          token: 'token',
          approveUrl: 'http://localhost/approve',
          rejectUrl: 'http://localhost/reject',
        },
      })),
      getWorkflow: vi.fn().mockImplementation(() => ({
        workflowId: 'wf-ephemeral',
        approvalRequestId: 'apr-ephemeral',
        eventId: 'evt-ephemeral',
        status: workflowStatus,
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
        timeoutMs: 60000,
        eventType: 'ephemeral.agent.budget_exceeded',
        source: 'ephemeral_manager',
        decision: {
          actionClass: 'guarded',
          riskScore: 78,
          autonomyLevel: 'low',
          requiresApproval: true,
          reason: 'Budget approval',
          guardrails: ['require_approval'],
          auditResult: 'ALLOWED',
        },
        eventPayload: {},
        callback: {
          token: 'token',
          approveUrl: 'http://localhost/approve',
          rejectUrl: 'http://localhost/reject',
        },
      })),
      setWorkflowStatus: (status: 'pending' | 'approved' | 'rejected' | 'expired') => {
        workflowStatus = status;
      },
      reset: () => {
        workflowStatus = 'pending';
      },
    },
  };
});

vi.mock('@packages/core-logic/auditLog.js', () => ({
  record: auditRecordMock,
}));

vi.mock('@packages/core-logic/approvalRouter.js', () => ({
  approvalRouter: {
    createWorkflowFromPolicy: approvalRouterState.createWorkflowFromPolicy,
    getWorkflow: approvalRouterState.getWorkflow,
  },
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function freshModules() {
  vi.resetModules();
  const [managerModule, busModule] = await Promise.all([
    import('@packages/core-logic/ephemeralAgentManager.js'),
    import('@packages/core-logic/phoenixEventBus.js'),
  ]);
  return { managerModule, busModule };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('EphemeralAgentManager', () => {
  beforeEach(() => {
    auditRecordMock.mockClear();
    approvalRouterState.reset();
    approvalRouterState.createWorkflowFromPolicy.mockClear();
    approvalRouterState.getWorkflow.mockClear();
  });

  afterEach(async () => {
    const { managerModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();
  });

  it('spawns an agent in running state', async () => {
    const { managerModule } = await freshModules();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'OrchestratorAgent',
      purpose: 'Analyse CSV schema',
      allowedTools: ['read_file', 'parse_csv'],
      ttlMs: 60_000,
    });

    expect(record.id).toBeTruthy();
    expect(record.state).toBe('running');
    expect(record.spec.parentAgentName).toBe('OrchestratorAgent');
    expect(record.auditTrail[0]?.event).toBe('spawned');

    managerModule.ephemeralAgentManager.clear();
  });

  it('terminate() sets state to terminated and emits event', async () => {
    const { managerModule, busModule } = await freshModules();
    const { getPostmortem, clearPostmortems } = await import('@packages/core-logic/ephemeralAudit.js');
    managerModule.ephemeralAgentManager.clear();
    busModule.phoenixEventBus.clearHistory();
    clearPostmortems();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'ParentAgent',
      purpose: 'Do something',
      allowedTools: ['tool_a'],
      ttlMs: 60_000,
    });

    const terminated = managerModule.ephemeralAgentManager.terminate(record.id, 'task_done');
    expect(terminated?.state).toBe('terminated');
    expect(terminated?.terminationReason).toBe('task_done');

    const history = busModule.phoenixEventBus.getHistory('phoenix:ephemeral_terminated', 5);
    expect(history.some((e) => (e.data as { agentId?: string }).agentId === record.id)).toBe(true);
    expect(getPostmortem(record.id)?.terminationReason).toBe('task_done');

    managerModule.ephemeralAgentManager.clear();
  });

  it('recordUsage kills agent when token budget exceeded', async () => {
    const { managerModule, busModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();
    busModule.phoenixEventBus.clearHistory();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'Parent',
      purpose: 'Token test',
      allowedTools: ['llm'],
      ttlMs: 60_000,
      tokenBudget: 100,
    });

    const result = await managerModule.ephemeralAgentManager.recordUsage(record.id, 150, 0.01, 1);
    expect(result.killed).toBe(true);
    expect(result.reason).toBe('token_budget_exceeded');

    const updated = managerModule.ephemeralAgentManager.getAgent(record.id);
    expect(updated?.state).toBe('terminated');

    const budgetEvents = busModule.phoenixEventBus.getHistory('phoenix:ephemeral_budget_exceeded', 5);
    expect(budgetEvents.length).toBeGreaterThan(0);

    managerModule.ephemeralAgentManager.clear();
  });

  it('recordUsage kills agent when step budget exceeded', async () => {
    const { managerModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'Parent',
      purpose: 'Step test',
      allowedTools: ['tool'],
      ttlMs: 60_000,
      stepBudget: 2,
    });

    await managerModule.ephemeralAgentManager.recordUsage(record.id, 10, 0.001, 1);
    const result = await managerModule.ephemeralAgentManager.recordUsage(record.id, 10, 0.001, 2);

    expect(result.killed).toBe(true);
    expect(result.reason).toBe('step_budget_exceeded');

    managerModule.ephemeralAgentManager.clear();
  });

  it('listAgents filters by state correctly', async () => {
    const { managerModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();

    const a = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'P',
      purpose: 'A',
      allowedTools: [],
      ttlMs: 60_000,
    });
    await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'P',
      purpose: 'B',
      allowedTools: [],
      ttlMs: 60_000,
    });

    managerModule.ephemeralAgentManager.terminate(a.id);

    const running = managerModule.ephemeralAgentManager.listAgents('running');
    const terminated = managerModule.ephemeralAgentManager.listAgents('terminated');

    expect(running).toHaveLength(1);
    expect(terminated).toHaveLength(1);

    managerModule.ephemeralAgentManager.clear();
  });

  it('TTL expiration transitions agent to expired', async () => {
    const { managerModule, busModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();
    busModule.phoenixEventBus.clearHistory();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'Parent',
      purpose: 'Short-lived',
      allowedTools: [],
      ttlMs: 30, // 30ms — fires quickly
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const updated = managerModule.ephemeralAgentManager.getAgent(record.id);
    expect(updated?.state).toBe('expired');

    const history = busModule.phoenixEventBus.getHistory('phoenix:ephemeral_terminated', 5);
    expect(
      history.some(
        (e) =>
          (e.data as { agentId?: string; reason?: string }).agentId === record.id &&
          (e.data as { reason?: string }).reason === 'ttl_expired',
      ),
    ).toBe(true);

    managerModule.ephemeralAgentManager.clear();
  });

  it('requests approval and renews lease when budget escalation is approved', async () => {
    const { managerModule } = await freshModules();
    managerModule.ephemeralAgentManager.clear();

    const record = await managerModule.ephemeralAgentManager.spawn({
      parentAgentName: 'Parent',
      purpose: 'Approval path',
      allowedTools: ['tool'],
      ttlMs: 60_000,
      tokenBudget: 100,
      leasePolicy: {
        onBudgetExceeded: 'require_approval',
        maxRenewals: 1,
        approvalExtensionMs: 30_000,
        resetBudgetsOnRenew: true,
      },
    });

    const first = await managerModule.ephemeralAgentManager.recordUsage(record.id, 150, 0.01, 1);
    expect(first.killed).toBe(false);
    expect(first.reason).toBe('budget_approval_requested');

    const pending = managerModule.ephemeralAgentManager.getAgent(record.id);
    expect(pending?.state).toBe('pending');
    expect(pending?.approval?.kind).toBe('budget');

    approvalRouterState.setWorkflowStatus('approved');
    const resumed = managerModule.ephemeralAgentManager.getAgent(record.id);

    expect(resumed?.state).toBe('running');
    expect(resumed?.approval).toBeUndefined();
    expect(resumed?.lease.renewalsUsed).toBe(1);
    expect(resumed?.tokenUsed).toBe(0);
    expect(resumed?.costUsed).toBe(0);

    managerModule.ephemeralAgentManager.clear();
  });
});
