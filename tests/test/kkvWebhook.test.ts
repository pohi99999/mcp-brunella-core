import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import { createKkvWebhookRoutes } from '@apps/mcp-core/server/routes/kkvWebhook.js';
import { initCrmDb, closeCrmDb } from '@packages/utils/crm_db.js';

describe('KKV follow-up webhook', () => {
  let tmpDir: string;
  let dbPath: string;
  let app: express.Express;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kkv-webhook-'));
    dbPath = path.join(tmpDir, 'crm.db');
    initCrmDb(dbPath);

    app = express();
    app.use(express.json());
    app.use('/api/v1/webhooks/kkv', createKkvWebhookRoutes());
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('ingests a lead and returns OK', async () => {
    const payload = {
      payload: {
        id: 'webhook-lead-1',
        email: 'webhook@example.com',
        phone: '+36-30-111-2222',
        company: 'Webhook Kft',
        created_at: '2026-04-05T12:00:00Z',
      },
      source: 'n8n',
    };

    const res = await request(app).post('/api/v1/webhooks/kkv/kkv-followup').send(payload).expect((r) => {
      if (![201, 202].includes(r.status)) throw new Error(`Unexpected status ${r.status}`);
    });

    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('lead');
    expect(res.body.lead).toHaveProperty('id');
  });
});
