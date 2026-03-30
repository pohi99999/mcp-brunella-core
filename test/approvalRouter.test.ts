import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const { dispatchApprovalRequestedMock, dispatchApprovalResolvedMock } = vi.hoisted(() => ({
  dispatchApprovalRequestedMock: vi.fn().mockResolvedValue([]),
  dispatchApprovalResolvedMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/core/notificationChannels.js', () => ({
  notificationChannels: {
    dispatchApprovalRequested: dispatchApprovalRequestedMock,
    dispatchApprovalResolved: dispatchApprovalResolvedMock,
  },
}));

async function freshApprovalModules() {
  vi.resetModules();
  const approvalRouterModule = await import('../src/core/approvalRouter.js');
  const approvalManagerModule = await import('../src/utils/approvalManager.js');
  const phoenixModule = await import('../src/core/phoenixEventBus.js');
  return {
    approvalRouterModule,
    approvalManagerModule,
    phoenixModule,
  };
}

describe('ApprovalRouter', () => {
  beforeEach(async () => {
    dispatchApprovalRequestedMock.mockClear();
    dispatchApprovalResolvedMock.mockClear();
    const { approvalRouterModule, phoenixModule } = await freshApprovalModules();
    approvalRouterModule.approvalRouter.clear();
    phoenixModule.phoenixEventBus.clearHistory();
    vi.useRealTimers();
  });

  it('creates workflow from guarded policy decision', async () => {
    const { approvalRouterModule } = await freshApprovalModules();

    const workflow = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 70,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'GitHub workflow failure',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-1',
          source: 'github',
          type: 'github.workflow_run.failure',
          priority: 'high',
          dedupKey: 'github:workflow:1',
          payload: {},
          timestamp: '2026-03-29T13:00:00.000Z',
        },
        agentName: 'ZeroPromptRuntime',
      },
    );

    expect(workflow).not.toBeNull();
    expect(workflow?.status).toBe('pending');
    expect(workflow?.approvalRequestId).toBeDefined();
    expect(workflow?.eventId).toBe('evt-1');
    expect(workflow?.callback.approveUrl).toContain(`/approval/${workflow?.approvalRequestId}/callback`);
    expect(workflow?.callback.rejectUrl).toContain('action=reject');
    expect(approvalRouterModule.approvalRouter.verifyCallbackToken(workflow?.approvalRequestId ?? '', workflow?.callback.token ?? '')).toBe(true);
    expect(dispatchApprovalRequestedMock).toHaveBeenCalledTimes(1);
  });

  it('tracks external approval response', async () => {
    const { approvalRouterModule, approvalManagerModule, phoenixModule } = await freshApprovalModules();

    const workflow = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 62,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Scheduler failure',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-2',
          source: 'scheduler',
          type: 'scheduler.task.failed',
          priority: 'high',
          dedupKey: 'scheduler:1',
          payload: {},
          timestamp: '2026-03-29T13:00:00.000Z',
        },
      },
    );

    expect(workflow).not.toBeNull();
    const approvalId = workflow?.approvalRequestId ?? '';
    const approved = approvalManagerModule.approvalManager.respond(approvalId, 'approve', { by: 'tester' });
    expect(approved).toBe(true);

    const updated = approvalRouterModule.approvalRouter.registerExternalResponse(approvalId, 'approve', { by: 'tester' });
    expect(updated?.status).toBe('approved');
    expect(updated?.response).toEqual({ by: 'tester' });
    expect(dispatchApprovalResolvedMock).toHaveBeenCalledTimes(1);

    const history = phoenixModule.phoenixEventBus.getHistory('phoenix:approval_resolved', 10);
    expect(history[0]?.data).toEqual(expect.objectContaining({
      status: 'approved',
      resumeEventType: 'approval.workflow.approved',
    }));
  });

  it('returns workflows by status', async () => {
    const { approvalRouterModule, approvalManagerModule } = await freshApprovalModules();

    const first = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 62,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Need review',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-a',
          source: 'github',
          type: 'github.workflow_run.failure',
          priority: 'high',
          dedupKey: 'github:a',
          payload: {},
          timestamp: '2026-03-29T13:00:00.000Z',
        },
      },
    );

    const second = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 62,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Need second review',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-b',
          source: 'scheduler',
          type: 'scheduler.task.failed',
          priority: 'high',
          dedupKey: 'scheduler:b',
          payload: {},
          timestamp: '2026-03-29T13:00:01.000Z',
        },
      },
    );

    expect(first && second).toBeTruthy();
    approvalManagerModule.approvalManager.respond(first?.approvalRequestId ?? '', 'reject', { by: 'qa' });
    approvalRouterModule.approvalRouter.registerExternalResponse(first?.approvalRequestId ?? '', 'reject', { by: 'qa' });

    const pending = approvalRouterModule.approvalRouter.listWorkflows('pending');
    const rejected = approvalRouterModule.approvalRouter.listWorkflows('rejected');

    expect(pending.some((workflow) => workflow.approvalRequestId === second?.approvalRequestId)).toBe(true);
    expect(rejected.some((workflow) => workflow.approvalRequestId === first?.approvalRequestId)).toBe(true);
  });

  it('propagates expiry into workflow status, phoenix events and notifications', async () => {
    vi.useFakeTimers();
    const { approvalRouterModule, phoenixModule } = await freshApprovalModules();

    const workflow = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 55,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Awaiting review',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-expire',
          source: 'scheduler',
          type: 'scheduler.task.failed',
          priority: 'high',
          dedupKey: 'scheduler:expire',
          payload: {},
          timestamp: '2026-03-29T13:00:00.000Z',
        },
        timeoutMs: 50,
      },
    );

    expect(workflow).not.toBeNull();

    vi.advanceTimersByTime(60);
    const refreshed = approvalRouterModule.approvalRouter.refreshWorkflow(workflow?.workflowId ?? '');

    expect(refreshed?.status).toBe('expired');
    expect(dispatchApprovalResolvedMock).toHaveBeenCalledTimes(1);

    const history = phoenixModule.phoenixEventBus.getHistory('phoenix:approval_resolved', 10);
    const expiryEvent = history.find((entry) => (entry.data as { status?: string }).status === 'expired');
    expect(expiryEvent).toBeDefined();
  });
});