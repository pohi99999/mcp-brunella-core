import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTaskRoutes } from '@apps/mcp-core/server/routes/tasks.js';

const taskMocks = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getTaskCount: vi.fn(),
  getTaskById: vi.fn(),
  getTaskStats: vi.fn(),
  executeWorkflow: vi.fn(),
  listWorkflowExecutions: vi.fn(),
  decomposeToDAGAsync: vi.fn(),
}));

vi.mock('@packages/utils/tasksDb.js', () => ({
  getTasks: taskMocks.getTasks,
  getTaskCount: taskMocks.getTaskCount,
  getTaskById: taskMocks.getTaskById,
  getTaskStats: taskMocks.getTaskStats,
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    executeWorkflow: taskMocks.executeWorkflow,
    listWorkflowExecutions: taskMocks.listWorkflowExecutions,
    queueTask: vi.fn(),
    processPendingTasks: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
    pauseTask: vi.fn(),
    resumeTask: vi.fn(),
  },
}));

vi.mock('@packages/agents/taskDecomposerCore.js', () => ({
  decomposeToDAGAsync: taskMocks.decomposeToDAGAsync,
}));

describe('Task routes', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    taskMocks.getTasks.mockResolvedValue([{ id: 1, status: 'pending' }]);
    taskMocks.getTaskCount.mockResolvedValue(1);
    taskMocks.getTaskStats.mockResolvedValue({ pending: 1 });
    taskMocks.listWorkflowExecutions.mockReturnValue([]);
    taskMocks.decomposeToDAGAsync.mockResolvedValue({
      id: 'wf-1',
      name: 'Workflow',
      nodes: [{ id: 'n1', label: 'Analyse', type: 'agent', agentName: 'Planner' }],
      edges: [],
    });
    taskMocks.executeWorkflow.mockResolvedValue({ status: 'success' });

    app = express();
    app.use(express.json());
    app.use('/api/v1/tasks', createTaskRoutes());
  });

  it('clamps task list limits and trims status filters', async () => {
    const response = await request(app).get('/api/v1/tasks?limit=999&offset=-3&status=%20pending%20');

    expect(response.status).toBe(200);
    expect(taskMocks.getTasks).toHaveBeenCalledWith(100, 0, 'pending');
    expect(taskMocks.getTaskCount).toHaveBeenCalledWith('pending');
    expect(response.body.limit).toBe(100);
    expect(response.body.offset).toBe(0);
  });

  it('normalizes workflow preview task and default agent', async () => {
    const response = await request(app)
      .post('/api/v1/tasks/workflow/preview')
      .send({ task: '  coordinate launch  ', defaultAgent: '  Orchestrator  ' });

    expect(response.status).toBe(200);
    expect(taskMocks.decomposeToDAGAsync).toHaveBeenCalledWith('coordinate launch', { defaultAgent: 'Orchestrator' });
  });

  it('rejects invalid workflow run payloads before execution', async () => {
    const response = await request(app)
      .post('/api/v1/tasks/workflow/run')
      .send({ workflow: { id: 'wf-1', name: 'Broken', nodes: [] } });

    expect(response.status).toBe(400);
    expect(taskMocks.executeWorkflow).not.toHaveBeenCalled();
  });

  it('requires object-shaped initial context for workflow runs', async () => {
    const response = await request(app)
      .post('/api/v1/tasks/workflow/run')
      .send({ task: 'run this', initialContext: ['not-object'] });

    expect(response.status).toBe(400);
    expect(taskMocks.executeWorkflow).not.toHaveBeenCalled();
  });
});
