import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const { delegateMock } = vi.hoisted(() => {
  const delegateMock = vi.fn().mockResolvedValue({ message: 'OK' });
  return { delegateMock };
});

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: { delegate: delegateMock }
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
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

  it('executes email_triage with normal risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'email_triage', payload: { task: 'Process emails' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.riskLevel).toBe('normal');
    expect(res.body.agent).toBe('InvoiceAutomation');
    expect(delegateMock).toHaveBeenCalledWith('InvoiceAutomation', 'Process emails', {});
  });

  it('flags browser_task as high risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'browser_task', payload: { task: 'Navigate somewhere' } });
    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe('high');
  });

  it('flags agent_start as high risk', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/')
      .set('X-Brunella-Secret', 'test-secret')
      .send({ action: 'agent_start', payload: { task: 'Start agent' } });
    expect(res.status).toBe(200);
    expect(res.body.riskLevel).toBe('high');
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
