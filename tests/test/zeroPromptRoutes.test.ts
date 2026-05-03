import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createZeroPromptRouter } from '@apps/mcp-core/server/routes/zeroPrompt.js';

const {
  approvalRouterMock,
  notificationChannelsMock,
  eventFabricMock,
  githubRemediationRuntimeMock,
  zeroPromptRuntimeMock,
  evaluateAndLogPolicyMock,
  listDeliveriesMock,
  getSummaryMock,
  getPoliciesMock,
  dispatchWorkflowStateMock,
  listWorkflowsMock,
  getWorkflowMock,
  sampleDeliveries,
  sampleWorkflows,
} = vi.hoisted(() => {
  const sampleWorkflows = [
    { workflowId: 'wf-1', approvalRequestId: 'apr-1', status: 'pending' as const },
    { workflowId: 'wf-2', approvalRequestId: 'apr-2', status: 'approved' as const },
    { workflowId: 'wf-3', approvalRequestId: 'apr-3', status: 'rejected' as const },
    { workflowId: 'wf-4', approvalRequestId: 'apr-4', status: 'expired' as const },
  ];

  const sampleDeliveries = [
    {
      id: 'del-1',
      workflowId: 'wf-1',
      approvalRequestId: 'apr-1',
      channel: 'email' as const,
      status: 'sent' as const,
      eventType: 'approval_requested' as const,
      title: 'Workflow approved',
      message: 'Notification sent',
      createdAt: '2026-03-30T05:00:00.000Z',
    },
  ];

  const listDeliveriesMock = vi.fn().mockImplementation((filters?: { limit?: number }) => {
    const limit = filters?.limit ?? 20;
    return sampleDeliveries.slice(0, limit);
  });

  const getSummaryMock = vi.fn().mockReturnValue({
    total: 1,
    sent: 1,
    failed: 0,
    skipped: 0,
    byChannel: { email: 1 },
    availableChannels: [
      { channel: 'email', enabled: true, target: 'ops@example.com' },
      { channel: 'slack', enabled: false },
      { channel: 'discord', enabled: false },
    ],
  });

  const getPoliciesMock = vi.fn().mockReturnValue([
    {
      channel: 'email',
      enabled: true,
      eventTypes: ['approval_requested', 'approval_resolved', 'approval_expired'],
    },
  ]);

  const dispatchWorkflowStateMock = vi.fn().mockResolvedValue(sampleDeliveries);

  const listWorkflowsMock = vi.fn().mockImplementation((status?: string) => (
    status ? sampleWorkflows.filter((workflow) => workflow.status === status) : sampleWorkflows
  ));

  const getWorkflowMock = vi.fn().mockImplementation((workflowId: string) => (
    sampleWorkflows.find((workflow) => workflow.workflowId === workflowId)
  ));

  return {
    approvalRouterMock: {
      listWorkflows: listWorkflowsMock,
      getWorkflow: getWorkflowMock,
    },
    notificationChannelsMock: {
      getSummary: getSummaryMock,
      getPolicies: getPoliciesMock,
      listDeliveries: listDeliveriesMock,
      dispatchWorkflowState: dispatchWorkflowStateMock,
    },
    githubRemediationRuntimeMock: {
      listRuns: vi.fn().mockReturnValue([
        {
          id: 'run-1',
          status: 'awaiting_final_approval',
          repositoryName: 'pohi99999/mcp-brunella-core',
        },
      ]),
      getSummary: vi.fn().mockReturnValue({
        total: 1,
        counts: { awaiting_final_approval: 1 },
        active: true,
        pendingFinalApproval: 1,
      }),
    },
    eventFabricMock: {
      getStats: vi.fn().mockReturnValue({}),
      getHistory: vi.fn().mockReturnValue([]),
      publish: vi.fn().mockReturnValue({ accepted: true, reason: 'ok' }),
      replay: vi.fn().mockReturnValue({ replayed: 0, events: [] }),
    },
    zeroPromptRuntimeMock: {
      isActive: vi.fn().mockReturnValue(false),
      start: vi.fn(),
      stop: vi.fn(),
    },
    evaluateAndLogPolicyMock: vi.fn(),
    listDeliveriesMock,
    getSummaryMock,
    getPoliciesMock,
    dispatchWorkflowStateMock,
    listWorkflowsMock,
    getWorkflowMock,
    sampleDeliveries,
    sampleWorkflows,
  };
});

vi.mock('@packages/utils/logger.js', () => ({
  logError: vi.fn(),
}));

vi.mock('@packages/core-logic/zeroPromptRuntime.js', () => ({
  zeroPromptRuntime: zeroPromptRuntimeMock,
}));

vi.mock('@packages/core-logic/githubRemediationRuntime.js', () => ({
  githubRemediationRuntime: githubRemediationRuntimeMock,
}));

vi.mock('@packages/core-logic/eventFabric.js', () => ({
  eventFabric: eventFabricMock,
}));

vi.mock('@packages/core-logic/approvalRouter.js', () => ({
  approvalRouter: approvalRouterMock,
}));

vi.mock('@packages/core-logic/notificationChannels.js', () => ({
  notificationChannels: notificationChannelsMock,
}));

vi.mock('@packages/core-logic/policyEngine.js', () => ({
  evaluateAndLogPolicy: evaluateAndLogPolicyMock,
}));

describe('ZeroPrompt routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1/zero-prompt', createZeroPromptRouter());
  });

  it('returns approval notification deliveries', async () => {
    const response = await request(app).get('/api/v1/zero-prompt/notifications?limit=1');

    expect(response.status).toBe(200);
    expect(response.body.deliveries).toHaveLength(1);
    expect(response.body.deliveries[0].workflowId).toBe('wf-1');
    expect(listDeliveriesMock).toHaveBeenCalledWith({ limit: 1, channel: undefined, status: undefined });
  });

  it('returns approval notification summary with workflow counts', async () => {
    const response = await request(app).get('/api/v1/zero-prompt/notifications/summary');

    expect(response.status).toBe(200);
    expect(response.body.summary.total).toBe(1);
    expect(response.body.summary.workflowCounts).toEqual({
      pending: 1,
      approved: 1,
      rejected: 1,
      expired: 1,
    });
    expect(response.body.summary.channelPolicies).toHaveLength(1);
    expect(getSummaryMock).toHaveBeenCalledTimes(1);
    expect(getPoliciesMock).toHaveBeenCalledTimes(1);
  });

  it('re-dispatches approval notifications for a workflow', async () => {
    const response = await request(app).post('/api/v1/zero-prompt/workflows/wf-1/notify');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.deliveries).toHaveLength(1);
    expect(dispatchWorkflowStateMock).toHaveBeenCalledTimes(1);
    expect(getWorkflowMock).toHaveBeenCalledWith('wf-1');
  });

  it('returns 404 when a workflow is missing', async () => {
    const response = await request(app).post('/api/v1/zero-prompt/workflows/missing/notify');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });

  it('returns remediation runs and summary', async () => {
    const runsResponse = await request(app).get('/api/v1/zero-prompt/remediation-runs');
    const summaryResponse = await request(app).get('/api/v1/zero-prompt/remediation-runs/summary');

    expect(runsResponse.status).toBe(200);
    expect(runsResponse.body.count).toBe(1);
    expect(runsResponse.body.runs[0].id).toBe('run-1');

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.summary.total).toBe(1);
    expect(summaryResponse.body.summary.pendingFinalApproval).toBe(1);
  });

  it('normalizes manual event publication payloads', async () => {
    const response = await request(app)
      .post('/api/v1/zero-prompt/events')
      .send({
        source: '  dashboard  ',
        type: '  readiness.detected  ',
        priority: 'invalid',
        riskHint: 'unknown',
        metadata: ['drop'],
        payload: { ok: true },
      });

    expect(response.status).toBe(201);
    expect(eventFabricMock.publish).toHaveBeenCalledWith(expect.objectContaining({
      source: 'dashboard',
      type: 'readiness.detected',
      priority: 'medium',
      riskHint: 'safe',
      payload: { ok: true },
      metadata: { source: 'manual_api' },
    }));
  });

  it('normalizes evaluate and replay inputs for policy checks', async () => {
    evaluateAndLogPolicyMock.mockResolvedValue({ decision: 'allow' });

    const evaluate = await request(app)
      .post('/api/v1/zero-prompt/evaluate')
      .send({
        source: '  copilot  ',
        type: '  route.check  ',
        priority: 'critical',
        riskHint: 'dangerous',
        agentName: '  CopilotCLI  ',
        resource: '  route-contracts  ',
      });

    expect(evaluate.status).toBe(200);
    expect(evaluateAndLogPolicyMock).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'CopilotCLI',
      resource: 'route-contracts',
      event: expect.objectContaining({
        source: 'copilot',
        type: 'route.check',
        priority: 'critical',
        riskHint: 'dangerous',
      }),
    }));

    const replay = await request(app)
      .post('/api/v1/zero-prompt/replay')
      .send({ source: ' copilot ', type: ' route.check ', limit: 999 });

    expect(replay.status).toBe(200);
    expect(eventFabricMock.replay).toHaveBeenCalledWith({
      source: 'copilot',
      type: 'route.check',
      limit: 200,
    });
  });
});
