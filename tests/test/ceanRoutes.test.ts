import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

describe('CEAN routes tenant isolation', () => {
  let router: typeof import('../src/server/routes/cean.js').default;
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    process.env.DATABASE_PATH = ':memory:';
    ({ default: router } = await import('../src/server/routes/cean.js'));
    app = express();
    app.use(express.json());
    app.use(router);
  });

  it('stores chat history per tenant', async () => {
    const sessionId = 'session-1';

    await request(app)
      .post('/cean/chat/save')
      .set('X-Tenant-ID', 'tenant-a')
      .send({ sessionId, role: 'user', content: 'Hello A' })
      .expect(200);

    await request(app)
      .post('/cean/chat/save')
      .set('X-Tenant-ID', 'tenant-b')
      .send({ sessionId, role: 'assistant', content: 'Hello B' })
      .expect(200);

    const tenantAHistory = await request(app)
      .get(`/cean/chat/history/${sessionId}`)
      .set('X-Tenant-ID', 'tenant-a')
      .expect(200);

    expect(tenantAHistory.body.tenantId).toBe('tenant-a');
    expect(tenantAHistory.body.messages).toHaveLength(1);
    expect(tenantAHistory.body.messages[0].content).toBe('Hello A');

    const tenantBHistory = await request(app)
      .get(`/cean/chat/history/${sessionId}`)
      .set('X-Tenant-ID', 'tenant-b')
      .expect(200);

    expect(tenantBHistory.body.messages).toHaveLength(1);
    expect(tenantBHistory.body.messages[0].content).toBe('Hello B');
  });

  it('deletes only the matching tenant history', async () => {
    const sessionId = 'session-2';

    await request(app)
      .post('/cean/chat/save')
      .set('X-Tenant-ID', 'tenant-a')
      .send({ sessionId, role: 'user', content: 'Message A' })
      .expect(200);

    await request(app)
      .post('/cean/chat/save')
      .set('X-Tenant-ID', 'tenant-b')
      .send({ sessionId, role: 'assistant', content: 'Message B' })
      .expect(200);

    const deleteResponse = await request(app)
      .delete(`/cean/chat/history/${sessionId}`)
      .set('X-Tenant-ID', 'tenant-a')
      .expect(200);

    expect(deleteResponse.body.tenantId).toBe('tenant-a');
    expect(deleteResponse.body.deleted).toBe(1);

    const tenantAHistory = await request(app)
      .get(`/cean/chat/history/${sessionId}`)
      .set('X-Tenant-ID', 'tenant-a')
      .expect(200);
    expect(tenantAHistory.body.messages).toHaveLength(0);

    const tenantBHistory = await request(app)
      .get(`/cean/chat/history/${sessionId}`)
      .set('X-Tenant-ID', 'tenant-b')
      .expect(200);
    expect(tenantBHistory.body.messages).toHaveLength(1);
  });

  it('falls back to the system tenant when no tenant header is supplied', async () => {
    const response = await request(app)
      .post('/cean/chat/save')
      .send({ sessionId: 'session-3', role: 'user', content: 'System message' })
      .expect(200);

    expect(response.body.tenantId).toBe('system');
  });
});
