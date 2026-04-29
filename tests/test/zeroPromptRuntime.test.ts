import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditRecordMock } = vi.hoisted(() => ({
  auditRecordMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@packages/core-logic/auditLog.js', () => ({
  record: auditRecordMock,
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const { dispatchApprovalRequestedMock, dispatchApprovalResolvedMock } = vi.hoisted(() => ({
  dispatchApprovalRequestedMock: vi.fn().mockResolvedValue([]),
  dispatchApprovalResolvedMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('@packages/core-logic/notificationChannels.js', () => ({
  notificationChannels: {
    dispatchApprovalRequested: dispatchApprovalRequestedMock,
    dispatchApprovalResolved: dispatchApprovalResolvedMock,
  },
}));

async function freshZeroPromptModules() {
  vi.resetModules();
  const runtimeModule = await import('@packages/core-logic/zeroPromptRuntime.js');
  const eventFabricModule = await import('@packages/core-logic/eventFabric.js');
  const approvalRouterModule = await import('@packages/core-logic/approvalRouter.js');
  const phoenixModule = await import('@packages/core-logic/phoenixEventBus.js');
  return {
    runtimeModule,
    eventFabricModule,
    approvalRouterModule,
    phoenixModule,
  };
}

describe('ZeroPromptRuntime', () => {
  beforeEach(async () => {
    auditRecordMock.mockClear();
    dispatchApprovalRequestedMock.mockClear();
    dispatchApprovalResolvedMock.mockClear();
    const { runtimeModule, eventFabricModule, approvalRouterModule } = await freshZeroPromptModules();
    runtimeModule.zeroPromptRuntime.stop();
    eventFabricModule.eventFabric.clearHistory();
    approvalRouterModule.approvalRouter.clear();
  });

  it('bridges phoenix degraded events into Event Fabric health events', async () => {
    const { runtimeModule, eventFabricModule, phoenixModule } = await freshZeroPromptModules();
    runtimeModule.zeroPromptRuntime.start();

    phoenixModule.phoenixEventBus.publish('phoenix:degraded', {
      level: 'partial',
      services: ['ollama'],
      message: 'Service unhealthy: ollama',
      timestamp: '2026-03-29T13:10:00.000Z',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    const history = eventFabricModule.eventFabric.getHistory({ source: 'health', limit: 10 });
    expect(history.some((event) => event.type === 'health.degraded')).toBe(true);
    runtimeModule.zeroPromptRuntime.stop();
  });

  it('does not create approval workflow automatically for remediation-first workflow failures', async () => {
    const { runtimeModule, eventFabricModule, approvalRouterModule } = await freshZeroPromptModules();
    runtimeModule.zeroPromptRuntime.start();

    eventFabricModule.eventFabric.publish(
      eventFabricModule.createGithubWebhookEventEnvelope('workflow_run', {
        action: 'completed',
        workflow_run: {
          id: 501,
          conclusion: 'failure',
          name: 'CI',
        },
        repository: {
          name: 'pohi99999/mcp-brunella-core',
        },
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 25));

    const workflows = approvalRouterModule.approvalRouter.listWorkflows();
    expect(workflows.length).toBe(0);
    expect(auditRecordMock).toHaveBeenCalled();
    expect(dispatchApprovalRequestedMock).not.toHaveBeenCalled();
    runtimeModule.zeroPromptRuntime.stop();
  });

  it('publishes approval resume events after approved workflows resolve', async () => {
    const { runtimeModule, approvalRouterModule, eventFabricModule, phoenixModule } = await freshZeroPromptModules();
    runtimeModule.zeroPromptRuntime.start();

    const workflow = await approvalRouterModule.approvalRouter.createWorkflowFromPolicy(
      {
        actionClass: 'guarded',
        riskScore: 61,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Needs human approval',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
      {
        event: {
          id: 'evt-approve-1',
          source: 'github',
          type: 'github.workflow_run.failure',
          priority: 'high',
          dedupKey: 'github:resume:1',
          payload: { branch: 'main' },
          timestamp: '2026-03-29T13:00:00.000Z',
        },
      },
    );

    approvalRouterModule.approvalRouter.registerExternalResponse(workflow?.approvalRequestId ?? '', 'approve', { by: 'tester' });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const history = eventFabricModule.eventFabric.getHistory({ type: 'approval.workflow.approved', limit: 10 });
    expect(history.some((event) => event.metadata?.category === 'approval_resume')).toBe(true);

    const resolvedHistory = phoenixModule.phoenixEventBus.getHistory('phoenix:approval_resolved', 10);
    expect(resolvedHistory.some((entry) => (entry.data as { status?: string }).status === 'approved')).toBe(true);
    runtimeModule.zeroPromptRuntime.stop();
  });
});
