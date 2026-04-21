/**
 * test/integration/psales.strategy.integration.test.ts
 *
 * End-to-end integration tests for the P-Sales strategy routes and
 * psales_db persistence layer.
 *
 * Uses supertest + in-memory SQLite (:memory:) to avoid touching
 * the filesystem. Each test gets a clean DB via beforeEach / afterEach.
 *
 * Conventions:
 *  - All imports end with .js (ESM / repo rule)
 *  - Test names read like specs: should_<behaviour>_when_<condition>
 *  - No console.log — silence is expected
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

import { createPSalesStrategyRoutes } from '../../src/server/routes/psales-strategy.js';
import {
  initPSalesDb,
  closePSalesDb,
  getStrategyPlan,
  listPSalesAuditEvents,
} from '../../src/data/psales_db.js';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function buildTestApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/psales/strategy', createPSalesStrategyRoutes());
  return app;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('P-Sales Strategy — integration tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Always use :memory: for tests — avoids file I/O and leaks
    initPSalesDb(':memory:');
    app = buildTestApp();
  });

  afterEach(() => {
    try {
      closePSalesDb();
    } catch {
      // best-effort teardown
    }
  });

  // -------------------------------------------------------------------------
  // POST /plan
  // -------------------------------------------------------------------------

  describe('POST /plan', () => {
    it('should_return_201_with_persisted_plan_when_valid_body_provided', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'Budapest', estimatedValue: 120000 })
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan).toMatchObject({
        propertyType: 'apartment',
        location: 'Budapest',
        estimatedValue: 120000,
        approvalState: 'pending',
      });
      expect(typeof res.body.plan.planId).toBe('string');
      expect(res.body.plan.planId).toHaveLength(36); // UUID

      // Verify the plan is actually persisted in DB
      const stored = getStrategyPlan(res.body.plan.planId);
      expect(stored).not.toBeNull();
      expect(stored?.approvalState).toBe('pending');
    });

    it('should_persist_audit_event_when_plan_is_created', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'house', location: 'Győr', estimatedValue: 250000 });

      expect(res.status).toBe(201);
      const planId = res.body.plan.planId as string;

      const events = listPSalesAuditEvents(10, { planId });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('plan_created');
      expect(events[0].planId).toBe(planId);
    });

    it('should_return_400_when_propertyType_is_missing', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ location: 'Budapest' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(typeof res.body.error).toBe('string');
    });

    it('should_use_default_channels_when_propertyType_is_unknown', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'yacht', location: 'Balaton', estimatedValue: 80000 });

      expect(res.status).toBe(201);
      expect(res.body.plan.channels).toBeInstanceOf(Array);
      expect(res.body.plan.channels.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /approve
  // -------------------------------------------------------------------------

  describe('POST /approve', () => {
    async function createPlan(): Promise<string> {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'industrial', location: 'Debrecen', estimatedValue: 500000 });
      return res.body.plan.planId as string;
    }

    it('should_return_200_with_approved_plan_when_decision_is_approved', async () => {
      const planId = await createPlan();

      const res = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'approved', actor: 'test-reviewer' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan.approvalState).toBe('approved');
      expect(res.body.plan.decidedBy).toBe('test-reviewer');
    });

    it('should_return_200_with_rejected_plan_when_decision_is_rejected', async () => {
      const planId = await createPlan();

      const res = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.plan.approvalState).toBe('rejected');
    });

    it('should_persist_audit_event_on_approval', async () => {
      const planId = await createPlan();
      await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'approved', actor: 'manager' });

      const events = listPSalesAuditEvents(20, { planId });
      const approvedEvent = events.find(e => e.eventType === 'approved');
      expect(approvedEvent).toBeDefined();
      expect(approvedEvent?.actor).toBe('manager');
    });

    it('should_return_400_when_decision_is_invalid', async () => {
      const planId = await createPlan();

      const res = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'maybe' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_400_when_planId_is_missing', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ decision: 'approved' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_404_when_planId_does_not_exist', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId: '00000000-0000-0000-0000-000000000000', decision: 'approved' });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // POST /pause
  // -------------------------------------------------------------------------

  describe('POST /pause', () => {
    async function createPlan(): Promise<string> {
      const res = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'Pécs', estimatedValue: 90000 });
      return res.body.plan.planId as string;
    }

    it('should_return_paused_plan_with_resume_token_when_pending_plan_paused', async () => {
      const planId = await createPlan();

      const res = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId, reason: 'Awaiting legal review', actor: 'compliance-team' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan.approvalState).toBe('paused');
      expect(res.body.plan.pauseReason).toBe('Awaiting legal review');
      expect(typeof res.body.resumeToken).toBe('string');
      expect(res.body.resumeToken).toHaveLength(36);
    });

    it('should_persist_paused_audit_event', async () => {
      const planId = await createPlan();
      await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId, reason: 'Hold', actor: 'admin' });

      const events = listPSalesAuditEvents(10, { planId });
      const pausedEvent = events.find(e => e.eventType === 'paused');
      expect(pausedEvent).toBeDefined();
    });

    it('should_return_400_when_planId_is_missing', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ reason: 'no id' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_404_when_planId_does_not_exist', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_409_when_plan_is_already_approved', async () => {
      const planId = await createPlan();
      // approve first
      await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'approved' });

      const res = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
      expect(res.body.currentState).toBe('approved');
    });
  });

  // -------------------------------------------------------------------------
  // POST /resume
  // -------------------------------------------------------------------------

  describe('POST /resume', () => {
    async function createAndPausePlan(): Promise<{ planId: string; resumeToken: string }> {
      const planRes = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'house', location: 'Miskolc', estimatedValue: 200000 });
      const planId = planRes.body.plan.planId as string;

      const pauseRes = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId, reason: 'Manual gate' });
      const resumeToken = pauseRes.body.resumeToken as string;

      return { planId, resumeToken };
    }

    it('should_resume_paused_plan_by_planId', async () => {
      const { planId } = await createAndPausePlan();

      const res = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ planId, actor: 'analyst' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan.approvalState).toBe('pending');
      expect(res.body.plan.pausedAt).toBeNull();
    });

    it('should_resume_paused_plan_by_resume_token', async () => {
      const { planId, resumeToken } = await createAndPausePlan();

      const res = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ resumeToken, actor: 'webhook' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.plan.approvalState).toBe('pending');
      expect(res.body.plan.planId).toBe(planId);
    });

    it('should_persist_resumed_audit_event', async () => {
      const { planId } = await createAndPausePlan();
      await request(app)
        .post('/api/psales/strategy/resume')
        .send({ planId, actor: 'legal' });

      const events = listPSalesAuditEvents(20, { planId });
      const resumedEvent = events.find(e => e.eventType === 'resumed');
      expect(resumedEvent).toBeDefined();
      expect(resumedEvent?.actor).toBe('legal');
    });

    it('should_return_400_when_neither_planId_nor_resumeToken_provided', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ actor: 'someone' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_404_when_resume_token_does_not_match', async () => {
      const res = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ resumeToken: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });

    it('should_return_404_when_plan_is_not_paused', async () => {
      // Create plan but don't pause it (state: pending)
      const planRes = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'Sopron', estimatedValue: 110000 });
      const planId = planRes.body.plan.planId as string;

      const res = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ planId });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // GET /audit
  // -------------------------------------------------------------------------

  describe('GET /audit', () => {
    it('should_return_all_audit_events_across_plans', async () => {
      // Create two plans
      await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'A', estimatedValue: 100 });
      await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'house', location: 'B', estimatedValue: 200 });

      const res = await request(app).get('/api/psales/strategy/audit');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(2);
    });

    it('should_filter_audit_events_by_planId', async () => {
      const planARes = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'A', estimatedValue: 100 });
      const planBRes = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'house', location: 'B', estimatedValue: 200 });

      const planAId = planARes.body.plan.planId as string;
      const planBId = planBRes.body.plan.planId as string;

      const res = await request(app).get(`/api/psales/strategy/audit?planId=${planAId}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);
      // All returned events must belong to plan A only
      for (const event of res.body.events as Array<{ planId: string }>) {
        expect(event.planId).toBe(planAId);
        expect(event.planId).not.toBe(planBId);
      }
    });

    it('should_respect_limit_query_parameter', async () => {
      // Create 3 plans → 3 audit events
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/psales/strategy/plan')
          .send({ propertyType: 'apartment', location: `City-${i}`, estimatedValue: i * 1000 });
      }

      const res = await request(app).get('/api/psales/strategy/audit?limit=2');

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeLessThanOrEqual(2);
    });

    it('should_return_empty_events_array_when_no_plans_exist', async () => {
      const res = await request(app).get('/api/psales/strategy/audit');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.events).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /weekly-status
  // -------------------------------------------------------------------------

  describe('GET /weekly-status', () => {
    it('should_return_zero_counts_when_no_plans_exist', async () => {
      const res = await request(app).get('/api/psales/strategy/weekly-status');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.summary.totalPlans).toBe(0);
      expect(res.body.summary.byApprovalState.pending).toBe(0);
      expect(res.body.summary.byApprovalState.approved).toBe(0);
      expect(res.body.summary.byApprovalState.rejected).toBe(0);
      expect(res.body.summary.byApprovalState.paused).toBe(0);
    });

    it('should_count_plans_by_approval_state_correctly', async () => {
      // Create: 2 pending, 1 approved, 1 rejected, 1 paused
      const createPlan = async (type: string) =>
        (await request(app)
          .post('/api/psales/strategy/plan')
          .send({ propertyType: type, location: 'X', estimatedValue: 100 })).body.plan.planId as string;

      const ids = await Promise.all([
        createPlan('apartment'),
        createPlan('house'),
        createPlan('apartment'),
        createPlan('industrial'),
        createPlan('house'),
      ]);

      // Approve #0
      await request(app).post('/api/psales/strategy/approve').send({ planId: ids[0], decision: 'approved' });
      // Reject #1
      await request(app).post('/api/psales/strategy/approve').send({ planId: ids[1], decision: 'rejected' });
      // Pause #2
      await request(app).post('/api/psales/strategy/pause').send({ planId: ids[2] });
      // ids[3] and ids[4] remain pending

      const res = await request(app).get('/api/psales/strategy/weekly-status');

      expect(res.status).toBe(200);
      expect(res.body.summary.totalPlans).toBe(5);
      expect(res.body.summary.byApprovalState.approved).toBe(1);
      expect(res.body.summary.byApprovalState.rejected).toBe(1);
      expect(res.body.summary.byApprovalState.paused).toBe(1);
      expect(res.body.summary.byApprovalState.pending).toBe(2);
    });

    it('should_include_recent_audit_events_in_summary', async () => {
      await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'apartment', location: 'Y', estimatedValue: 50000 });

      const res = await request(app).get('/api/psales/strategy/weekly-status');

      expect(res.body.summary.recentAuditEvents).toBeInstanceOf(Array);
      expect(res.body.summary.recentAuditEvents.length).toBeGreaterThan(0);
    });

    it('should_include_generatedAt_iso_timestamp', async () => {
      const res = await request(app).get('/api/psales/strategy/weekly-status');
      expect(typeof res.body.summary.generatedAt).toBe('string');
      expect(() => new Date(res.body.summary.generatedAt)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // State machine: full approval lifecycle
  // -------------------------------------------------------------------------

  describe('Full lifecycle: create → pause → resume → approve', () => {
    it('should_complete_full_human_in_loop_lifecycle', async () => {
      // 1. Create
      const createRes = await request(app)
        .post('/api/psales/strategy/plan')
        .send({ propertyType: 'house', location: 'Veszprém', estimatedValue: 180000 });

      expect(createRes.status).toBe(201);
      const planId = createRes.body.plan.planId as string;
      expect(createRes.body.plan.approvalState).toBe('pending');

      // 2. Pause (legal gate)
      const pauseRes = await request(app)
        .post('/api/psales/strategy/pause')
        .send({ planId, reason: 'Legal compliance gate', actor: 'legal-bot' });

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.plan.approvalState).toBe('paused');
      const resumeToken = pauseRes.body.resumeToken as string;

      // 3. Resume via token (simulates webhook callback)
      const resumeRes = await request(app)
        .post('/api/psales/strategy/resume')
        .send({ resumeToken, actor: 'legal-cleared', note: 'Compliance approved' });

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.plan.approvalState).toBe('pending');
      expect(resumeRes.body.plan.pausedAt).toBeNull();

      // 4. Final approval
      const approveRes = await request(app)
        .post('/api/psales/strategy/approve')
        .send({ planId, decision: 'approved', actor: 'ceo' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.plan.approvalState).toBe('approved');
      expect(approveRes.body.plan.decidedBy).toBe('ceo');

      // 5. Verify full audit trail
      const auditRes = await request(app).get(`/api/psales/strategy/audit?planId=${planId}`);
      const eventTypes = (auditRes.body.events as Array<{ eventType: string }>).map(e => e.eventType);

      expect(eventTypes).toContain('plan_created');
      expect(eventTypes).toContain('paused');
      expect(eventTypes).toContain('resumed');
      expect(eventTypes).toContain('approved');
    });
  });
});
