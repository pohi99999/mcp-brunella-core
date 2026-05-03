import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { harvestRouter } from '@apps/mcp-core/server/routes/harvest.js';

vi.mock('@packages/utils/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('@packages/utils/rag.js', () => ({ addToIndex: vi.fn() }));

const app = express();
app.use(express.json());
app.use('/api/v1/harvest', harvestRouter);

describe('Harvest Routes', () => {
  it('POST /sync returns success', async () => {
    const res = await request(app).post('/api/v1/harvest/sync').send({
      source: ' github-trending ',
      items: [{ title: 'Test', summary: 'Test summary' }, 'invalid-item']
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.received).toBe(1);
    expect(res.body.source).toBe('github-trending');
  });

  it('GET /status returns harvest time', async () => {
    const res = await request(app).get('/api/v1/harvest/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lastHarvestTime');
    expect(res.body).toHaveProperty('stats');
  });
});
