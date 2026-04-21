import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { createCrmRoutes } from '../src/server/routes/crm.js';
import { closeCrmDb, initCrmDb, ingestCrmLead } from '../src/data/crm_db.js';
import { normalizeCrmLead } from '../src/utils/crmLead.js';

describe('crm follow-up routes', () => {
  let app: express.Express;
  let dbPath: string;

  beforeEach(() => {
    dbPath = mkdtempSync(path.join(os.tmpdir(), 'crm-follow-up-routes-'));
    dbPath = path.join(dbPath, 'crm.db');
    initCrmDb(dbPath);

    app = express();
    app.use(express.json());
    app.use('/api/v1/crm', createCrmRoutes());
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  it('supports approval, pause, resume, summary, and audit trail endpoints', async () => {
    const lead = normalizeCrmLead({
      source: 'demo-request',
      payload: {
        id: 'hot-follow-up-lead',
        email: 'hot@example.com',
        phone: '+36-30-999-7777',
        company: 'Hot Kft',
        created_at: '2026-04-05T09:00:00Z',
        urgency: 'high',
        budget: 7500,
        timeline: 'this week',
      },
    });

    assert.ok(lead);
    const inserted = ingestCrmLead(lead, { dbFilePath: dbPath, workflowId: 'wf-hot-follow-up' });
    assert.equal(inserted.inserted, true);

    const planRes = await request(app).post('/api/v1/crm/follow-up/plan').send({ leadId: inserted.lead.id });
    expect(planRes.status).toBe(201);
    expect(planRes.body).toEqual(expect.objectContaining({ ok: true, plan: expect.any(Object) }));
    expect(planRes.body.plan.status).toBe('pending_approval');

    const scoreRes = await request(app).post('/api/v1/crm/follow-up/score').send({ leadId: inserted.lead.id, workflowId: 'wf-score' });
    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body).toEqual(expect.objectContaining({ ok: true, recorded: true }));
    expect(scoreRes.body.lead.priorityScore).toBe(scoreRes.body.decision.score);

    const approvalRes = await request(app)
      .post('/api/v1/crm/follow-up/approval')
      .send({
        leadId: inserted.lead.id,
        approved: true,
        reason: 'approved by ops',
        actor: 'ops-lead',
        note: 'go ahead',
      });
    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body).toEqual(expect.objectContaining({ ok: true, approved: true }));
    expect(approvalRes.body.plan.status).toBe('scheduled');

    const pauseRes = await request(app)
      .post('/api/v1/crm/follow-up/pause')
      .send({
        leadId: inserted.lead.id,
        reason: 'waiting for customer',
        actor: 'ops-lead',
      });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body).toEqual(expect.objectContaining({ ok: true, paused: true }));
    expect(pauseRes.body.plan.status).toBe('paused');

    const resumeRes = await request(app)
      .post('/api/v1/crm/follow-up/resume')
      .send({
        leadId: inserted.lead.id,
        reason: 'customer confirmed',
        actor: 'ops-lead',
      });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body).toEqual(expect.objectContaining({ ok: true, resumed: true }));
    expect(resumeRes.body.plan.status).toBe('scheduled');

    const summaryRes = await request(app).get('/api/v1/crm/follow-up/summary');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body).toEqual(expect.objectContaining({ ok: true, summary: expect.any(Object) }));
    expect(summaryRes.body.summary.manualEventCounts.follow_up_approved).toBeGreaterThanOrEqual(1);
    expect(summaryRes.body.summary.manualEventCounts.follow_up_paused).toBeGreaterThanOrEqual(1);
    expect(summaryRes.body.summary.manualEventCounts.follow_up_resumed).toBeGreaterThanOrEqual(1);

    const auditRes = await request(app)
      .get('/api/v1/crm/follow-up/audit')
      .query({ leadId: inserted.lead.id, limit: 10 });
    expect(auditRes.status).toBe(200);
    expect(auditRes.body).toEqual(expect.objectContaining({ ok: true, events: expect.any(Array) }));
    const eventTypes = (auditRes.body.events as Array<{ eventType: string }>).map((event) => event.eventType);
    expect(eventTypes).toEqual(expect.arrayContaining(['follow_up_scored', 'follow_up_planned', 'follow_up_approved', 'follow_up_paused', 'follow_up_resumed']));
  });
});
