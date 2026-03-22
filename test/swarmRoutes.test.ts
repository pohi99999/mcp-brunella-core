import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { swarmRouter } from '../src/server/routes/swarm.js';

// Mock AgentManager — hoisted above import by Vitest
vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { initialize: vi.fn() },
  swarmManager: {
    listColonies: vi.fn(() => [
      { swarmId: 'triad-default', name: 'Triad', status: 'active', agents: new Map(), leaderId: null,
        metrics: { tasksCompleted: 2, tasksFailed: 0, avgDurationMs: 50, throughput: 1, lastActivity: Date.now() } }
    ]),
    getColony: vi.fn((id: string) => id === 'triad-default'
      ? { swarmId: id, name: 'Triad', status: 'active', agents: new Map(), leaderId: null }
      : undefined),
    submitTask: vi.fn(async () => ({ status: 'success', result: 'done', durationMs: 100, agentId: 'researcher', taskId: 't1' })),
    nextTaskId: vi.fn(() => 'task-abc'),
  }
}));

vi.mock('../src/config/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('../src/utils/rag.js', () => ({ addToIndex: vi.fn() }));

describe('Swarm REST Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/swarm', swarmRouter);
  });

  it('GET /api/v1/swarm/status returns colony list', async () => {
    const res = await request(app).get('/api/v1/swarm/status');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.colonies[0].name).toBe('Triad');
    expect(res.body.colonies[0].colonyId).toBe('triad-default');
  });

  it('POST /api/v1/swarm/dispatch dispatches task to colony', async () => {
    const res = await request(app).post('/api/v1/swarm/dispatch').send({ task: 'analyse trends' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/swarm/dispatch returns 400 when task missing', async () => {
    const res = await request(app).post('/api/v1/swarm/dispatch').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/swarm/dispatch returns 404 for unknown colony', async () => {
    const res = await request(app).post('/api/v1/swarm/dispatch').send({ task: 'x', colonyId: 'unknown' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
