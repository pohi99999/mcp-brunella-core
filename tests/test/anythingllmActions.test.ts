import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const { delegateMock, executeWorkspaceActionMock, requestApprovalMock, getRequestMock, checkPermissionMock, isWorkspaceActionMock } = vi.hoisted(() => {
  const delegateMock = vi.fn().mockResolvedValue({ message: 'OK' });
  const executeWorkspaceActionMock = vi.fn().mockResolvedValue({ operation: 'email_triage', count: 1, messages: [] });
  const requestApprovalMock = vi.fn().mockResolvedValue('approval-123');
  const getRequestMock = vi.fn();
  const checkPermissionMock = vi.fn(() => ({
    allowed: true,
    agent: 'CopilotBridge',
    action: 'http',
    reason: 'Permission granted',
    profile: 'ADMIN',
  }));
  const workspaceActions = new Set(['email_triage', 'email_draft', 'email_send', 'calendar_check', 'calendar_create', 'drive_list', 'drive_upload', 'chat_list_spaces', 'chat_list_messages', 'chat_send']);
  const isWorkspaceActionMock = vi.fn((action: string) => workspaceActions.has(action));
  return { delegateMock, executeWorkspaceActionMock, requestApprovalMock, getRequestMock, checkPermissionMock, isWorkspaceActionMock };
});

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { delegate: delegateMock }
}));

vi.mock('../src/utils/approvalManager.js', () => ({
  approvalManager: {
    requestApproval: requestApprovalMock,
    getRequest: getRequestMock,
  },
}));

vi.mock('../src/core/rbac/agentPermissions.js', () => ({
  getEnhancedPermissionManager: () => ({
    checkPermission: checkPermissionMock,
  }),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/server/workspaceActions.js', () => ({
  executeWorkspaceAction: executeWorkspaceActionMock,
  isWorkspaceAction: isWorkspaceActionMock,
}));

async function buildApp() {
  const { createAnythingLLMActionRoutes } = await import('../src/server/routes/anythingllmActions.js');
  const app = express();
  app.use(express.json());
  app.use('/', createAnythingLLMActionRoutes());
  return app;
}

describe('AnythingLLM Action Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRUNELLA_ACTION_SECRET = 'test-secret';
    checkPermissionMock.mockImplementation((agentName: string, action: string) => ({
      allowed: true,
      agent: agentName,
      action,
      reason: 'Permission granted',
      profile: agentName === 'Orchestrator' ? 'ADMIN' : 'ADMIN',
    }));
    executeWorkspaceActionMock.mockResolvedValue({ operation: 'email_triage', count: 1, messages: [] });
    getRequestMock.mockReturnValue(undefined);
  });

  it('returns 401 without secret header', async () => {
    const app = await buildApp();
    const res = await request(app).post('/').send({ action: 'email_triage' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong secret', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'wrong')
      .send({ action: 'email_triage' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for unknown action', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'unknown_action' });
    expect(res.status).toBe(400);
    expect(res.body.supported).toContain('email_triage');
  });

  it('executes email_triage directly through the workspace bridge', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'email_triage', payload: { task: 'Process emails', query: 'inbox' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.riskLevel).toBe('normal');
    expect(res.body.agent).toBe('CopilotBridge');
    expect(executeWorkspaceActionMock).toHaveBeenCalledWith('email_triage', { task: 'Process emails', query: 'inbox' });
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('blocks high-risk actions for non-admin role', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .set('X-Brunella-Role', 'operator')
      .send({ action: 'browser_task', payload: { task: 'Navigate somewhere' } });
    expect(res.status).toBe(403);
    expect(res.body.requiredRole).toBe('admin');
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('requests approval before high-risk workspace execution', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .set('X-Brunella-Role', 'admin')
      .send({ action: 'email_send', payload: { to: ['team@example.com'], subject: 'Hi', body: 'Message' } });
    expect(res.status).toBe(202);
    expect(res.body.approvalRequired).toBe(true);
    expect(res.body.approvalId).toBe('approval-123');
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
    expect(executeWorkspaceActionMock).not.toHaveBeenCalled();
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('executes high-risk workspace action after approval', async () => {
    getRequestMock.mockReturnValue({
      id: 'approval-123',
      status: 'approved',
      metadata: { action: 'email_send', agent: 'CopilotBridge' },
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .set('X-Brunella-Role', 'admin')
      .send({
        action: 'email_send',
        approvalId: 'approval-123',
        payload: { to: ['team@example.com'], subject: 'Hi', body: 'Message' },
      });

    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe('high');
    expect(res.body.role).toBe('admin');
    expect(executeWorkspaceActionMock).toHaveBeenCalledWith('email_send', { to: ['team@example.com'], subject: 'Hi', body: 'Message' });
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('rejects unresolved approval tokens', async () => {
    getRequestMock.mockReturnValue({
      id: 'approval-123',
      status: 'pending',
      metadata: { action: 'agent_start', agent: 'Orchestrator' },
    });

    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .set('X-Brunella-Role', 'admin')
      .send({
        action: 'agent_start',
        approvalId: 'approval-123',
        payload: { task: 'Start agent' },
      });

    expect(res.status).toBe(409);
    expect(res.body.approvalStatus).toBe('pending');
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('executes chat workspace actions directly', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'chat_list_spaces', payload: { maxResults: 5 } });

    expect(res.status).toBe(200);
    expect(executeWorkspaceActionMock).toHaveBeenCalledWith('chat_list_spaces', { maxResults: 5 });
    expect(delegateMock).not.toHaveBeenCalled();
  });

  it('returns audit log with executed records', async () => {
    const app = await buildApp();
    await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'email_triage', payload: { task: 'test' } });

    const res = await request(app)
      .get('/audit')
      .set('X-Brunella-Secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body.records.length).toBeGreaterThan(0);
    expect(res.body.records[0].action).toBe('email_triage');
  });
});
