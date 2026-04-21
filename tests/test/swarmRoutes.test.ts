import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { swarmRouter } from '../src/server/routes/swarm.js';

const {
  listCheckpointsMock,
  getCheckpointStatsMock,
  listSessionsMock,
  createSessionMock,
} = vi.hoisted(() => ({
  listCheckpointsMock: vi.fn(() => [
    { id: 1, colonyId: 'triad-default', completedTasks: 2, createdAt: '2026-04-12T03:00:00Z' },
  ]),
  getCheckpointStatsMock: vi.fn(() => ({
    totalCheckpoints: 4,
    colonies: 1,
    latestAt: '2026-04-12T03:00:00Z',
  })),
  listSessionsMock: vi.fn(() => [
    {
      id: 'session-1',
      objective: 'Review architecture',
      participants: ['Researcher', 'Developer'],
      status: 'active',
    },
  ]),
  createSessionMock: vi.fn((objective: string, participants: string[]) => ({
    id: 'session-2',
    objective,
    participants,
    status: 'active',
  })),
}));

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
vi.mock('../src/core/swarm/colonyPersistence.js', () => ({
  listCheckpoints: listCheckpointsMock,
  getCheckpointStats: getCheckpointStatsMock,
}));
vi.mock('../src/core/SwarmChatManager.js', () => ({
  globalSwarmChatManager: {
    listSessions: listSessionsMock,
    createSession: createSessionMock,
  },
}));

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

  it('GET /api/v1/swarm/sessions returns swarm chat sessions', async () => {
    const res = await request(app).get('/api/v1/swarm/sessions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessions[0].objective).toBe('Review architecture');
  });

  it('POST /api/v1/swarm/create creates a swarm chat session', async () => {
    const res = await request(app)
      .post('/api/v1/swarm/create')
      .send({ objective: 'Review architecture', participants: ['Researcher', 'Developer'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(createSessionMock).toHaveBeenCalledWith('Review architecture', ['Researcher', 'Developer']);
  });

  it('GET /api/v1/swarm/checkpoints/stats returns checkpoint summary', async () => {
    const res = await request(app).get('/api/v1/swarm/checkpoints/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalCheckpoints).toBe(4);
    expect(res.body.colonies).toBe(1);
  });

  it('GET /api/v1/swarm/checkpoints requires swarmId', async () => {
    const res = await request(app).get('/api/v1/swarm/checkpoints');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('swarmId');
  });

  it('GET /api/v1/swarm/checkpoints returns the checkpoint list for a colony', async () => {
    const res = await request(app).get('/api/v1/swarm/checkpoints?swarmId=triad-default');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(listCheckpointsMock).toHaveBeenCalledWith('triad-default');
  });
});
