import express from 'express';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCrmDb, initCrmDb } from '@packages/utils/crm_db.js';
import { createKkvCrmRoutes } from '@apps/mcp-core/server/routes/kkvCrm.js';

describe('kkv CRM routes', () => {
  let app: express.Express;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'kkv-crm-routes-')), 'crm.db');
    initCrmDb(dbPath);

    app = express();
    app.use(express.json());
    app.use('/api/v1/kkv-crm', createKkvCrmRoutes());
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  it('ingests a lead through the HTTP route', async () => {
    const res = await request(app)
      .post('/api/v1/kkv-crm/leads')
      .set('x-workflow-id', 'wf-kkv-crm-1')
      .send({
        source: 'webhook',
        payload: {
          id: 'route-lead-1',
          email: 'route@example.com',
          phone: '+36-30-555-3333',
          company: 'Route Kft',
          created_at: '2026-04-04T13:00:00Z',
          urgency: 'high',
          budget: 9000,
          timeline: 'soon',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        inserted: true,
        eventType: 'created',
        followUpCreated: true,
      }),
    );
    expect(res.body.lead.id).toBe('route-lead-1');
    expect(res.body.followUpPlan).toBeTruthy();
    expect(res.body.snapshot.leadStats.total).toBe(1);
  });

  it('returns a validation error for invalid payloads', async () => {
    const invalidApp = express();
    invalidApp.use((req, _res, next) => {
      (req as { body: unknown }).body = null;
      next();
    });
    invalidApp.use('/api/v1/kkv-crm', createKkvCrmRoutes());

    const res = await request(invalidApp).post('/api/v1/kkv-crm/leads').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Invalid CRM lead payload',
      }),
    );
  });

  it('exposes a health snapshot', async () => {
    await request(app)
      .post('/api/v1/kkv-crm/leads')
      .send({
        source: 'partner',
        payload: {
          id: 'route-health-lead',
          email: 'health@example.com',
          phone: '+36-30-444-2222',
          company: 'Health Kft',
          created_at: '2026-04-04T14:00:00Z',
        },
      })
      .expect(201);

    const res = await request(app).get('/api/v1/kkv-crm/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'healthy',
        success: true,
      }),
    );
    expect(res.body.leadStats.total).toBe(1);
    expect(res.body.followUpStats.totalPlans).toBe(1);
    expect(res.body.followUpSummary.totalPlans).toBe(1);
  });
});
