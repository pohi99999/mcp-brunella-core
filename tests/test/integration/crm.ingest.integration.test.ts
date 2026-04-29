import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Import routers and DB helpers (use .js extensions to match repo ESM rules)
import { createCrmRoutes } from '@apps/mcp-core/server/routes/crm.js';
import { initCrmDb, closeCrmDb, listCrmLeads } from '@packages/utils/crm_db.js';

// Helper: create a unique temp DB path for each test run
function makeTempDbPath(): string {
  const file = `brunella-crm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  return path.join(os.tmpdir(), file);
}

// Sample payload used by tests
export const SAMPLE_PAYLOAD = {
  source: 'web_form',
  payload: {
    email: 'alice@example.com',
    phone: '+36 30 123 4567',
    company: 'Acme Kft',
    // explicit id to make dedupe behaviour deterministic
    id: 'test-lead-1',
    createdAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    // other arbitrary fields that may appear in real payloads
    message: 'Interested in product X',
  },
};

describe('CRM ingest end-to-end integration', () => {
  let app: express.Express;
  let dbPath: string;

  beforeEach(() => {
    // Create temp DB and initialize CRM DB state before mounting routes
    dbPath = makeTempDbPath();
    initCrmDb(dbPath);

    app = express();
    app.use(express.json());

    // Mount CRM routes under /api/v1/crm (matches production mount)
    app.use('/api/v1/crm', createCrmRoutes());
  });

  afterEach(() => {
    // Close DB and remove temp file
    try {
      closeCrmDb();
    } catch (e) {
      // best-effort cleanup
    }
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch (e) {
      // ignore
    }
  });

  it('should_insert_lead_when_posting_valid_payload_and_store_in_db', async () => {
    const res = await request(app)
      .post('/api/v1/crm/intake')
      .send(SAMPLE_PAYLOAD)
      .set('Accept', 'application/json');

    // First insert should be created (201)
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({ ok: true, accepted: true, inserted: true, eventType: 'created' }),
    );

    // Verify lead appears via the public listing endpoint
    const listRes = await request(app).get('/api/v1/crm/leads');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.objectContaining({ ok: true, count: expect.any(Number), leads: expect.any(Array) }),
    );

    const leads = listRes.body.leads as Array<Record<string, unknown>>;
    expect(leads.length).toBeGreaterThanOrEqual(1);

    // Find our lead by id/email
    const found = leads.find((l) => (l.id === 'test-lead-1') || (l.email === 'alice@example.com'));
    expect(found).toBeDefined();
    expect(found).toEqual(expect.objectContaining({
      source: 'web_form',
      email: 'alice@example.com',
      phone: expect.any(String),
      company: 'Acme Kft',
    }));

    // Also verify direct DB helper returns the record (integration + DB wiring check)
    const dbLeads = listCrmLeads(dbPath, 10);
    const dbFound = dbLeads.find((l) => l.id === 'test-lead-1' || l.email === 'alice@example.com');
    expect(dbFound).toBeDefined();
    expect(dbFound).toEqual(expect.objectContaining({ source: 'web_form', email: 'alice@example.com' }));
  });

  it('should_create_followup_plan_when_requested_and_store_actions', async () => {
    // Ensure a lead exists first
    const insert = await request(app).post('/api/v1/crm/intake').send(SAMPLE_PAYLOAD);
    expect(insert.status).toBe(201);

    // Create a follow-up plan via follow-up route
    const planRes = await request(app)
      .post('/api/v1/crm/follow-up/plan')
      .send({ leadId: 'test-lead-1' })
      .set('Accept', 'application/json');

    expect([200, 201]).toContain(planRes.status);
    expect(planRes.body).toEqual(
      expect.objectContaining({ ok: true, plan: expect.any(Object), actions: expect.any(Array) }),
    );

    const actions = planRes.body.actions as Array<Record<string, unknown>>;
    expect(actions.length).toBeGreaterThanOrEqual(1);

    // Verify the follow-up plan is visible via GET /plans
    const listPlans = await request(app).get('/api/v1/crm/follow-up/plans');
    expect(listPlans.status).toBe(200);
    expect(listPlans.body).toEqual(expect.objectContaining({ ok: true, count: expect.any(Number), plans: expect.any(Array) }));
    const plans = listPlans.body.plans as Array<Record<string, unknown>>;
    const matched = plans.find((p) => p.leadId === 'test-lead-1' || p.leadId === 'test-lead-1');
    expect(matched).toBeDefined();
  });

  it('should_deduplicate_when_same_payload_posted_twice_and_not_create_duplicate_lead', async () => {
    // First insert
    const first = await request(app).post('/api/v1/crm/intake').send(SAMPLE_PAYLOAD);
    expect(first.status).toBe(201);
    expect(first.body.inserted).toBe(true);

    // Second insert (identical payload) should be deduped
    const second = await request(app).post('/api/v1/crm/intake').send(SAMPLE_PAYLOAD);
    // When deduped route returns 200 with inserted: false
    expect(second.status).toBe(200);
    expect(second.body).toEqual(expect.objectContaining({ ok: true, inserted: false, eventType: 'deduped' }));

    // Ensure there is still only one lead in DB
    const listRes = await request(app).get('/api/v1/crm/leads');
    expect(listRes.status).toBe(200);
    const leads = listRes.body.leads as Array<Record<string, unknown>>;
    // There should be exactly 1 lead for this dedupe key
    const matches = leads.filter((l) => l.email === 'alice@example.com' || l.id === 'test-lead-1');
    expect(matches.length).toBe(1);
  });
});
