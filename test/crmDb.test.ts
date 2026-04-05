import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'vitest';
import { vi } from 'vitest';
import {
  approveCrmFollowUpPlan,
  cancelCrmFollowUpPlan,
  closeCrmDb,
  createCrmFollowUpPlan,
  dispatchDueCrmFollowUpActions,
  dispatchCrmFollowUpAction,
  getCrmLeadStats,
  getCrmFollowUpStats,
  getCrmFollowUpSummary,
  initCrmDb,
  ingestCrmLead,
  listCrmFollowUpActions,
  listCrmFollowUpAuditTrail,
  pauseCrmFollowUpPlan,
  recordCrmLeadResponse,
  recordCrmLeadScore,
  resumeCrmFollowUpPlan,
  scoreCrmFollowUpLeadById,
} from '../src/data/crm_db.js';
import { normalizeCrmLead } from '../src/utils/crmLead.js';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'crm-follow-up-test' }),
    })),
  },
}));

describe('crm_db', () => {
  it('persists and deduplicates CRM leads', async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'crm-db-'));
    const dbPath = path.join(tmpDir, 'crm.db');

    try {
      initCrmDb(dbPath);
      process.env.SMTP_HOST = 'smtp.example.test';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'crm@example.test';
      process.env.SMTP_PASS = 'secret';
      process.env.SMTP_FROM = 'crm@example.test';

      const lead = normalizeCrmLead({
        source: 'webhook',
        payload: {
          email: 'lead@example.com',
          phone: '+36-30-123-4567',
          company: 'Acme Kft',
          created_at: '2026-03-20T08:00:00Z',
          receivedAt: '2026-03-20T08:00:00Z',
        },
      });

      assert.ok(lead);

      const first = ingestCrmLead(lead, { dbFilePath: dbPath, workflowId: 'wf-test' });
      assert.equal(first.inserted, true);
      assert.equal(first.eventType, 'created');
      assert.equal(first.lead.status, 'new');

      const second = ingestCrmLead(lead, { dbFilePath: dbPath, workflowId: 'wf-test' });
      assert.equal(second.inserted, false);
      assert.equal(second.eventType, 'deduped');
      assert.equal(second.lead.dedupeKey, first.lead.dedupeKey);

      const stats = getCrmLeadStats(dbPath);
      assert.equal(stats.total, 1);
      assert.equal(stats.deduped, 1);

      const scored = scoreCrmFollowUpLeadById(first.lead.id, dbPath);
      assert.ok(scored);
      assert.ok(scored?.decision.score > 0);

      const persistedScore = recordCrmLeadScore(first.lead.id, { dbFilePath: dbPath, workflowId: 'wf-score' });
      assert.ok(persistedScore);
      assert.equal(persistedScore?.lead.priorityScore, persistedScore?.decision.score);
      assert.equal(persistedScore?.lead.assignedOwner, persistedScore?.decision.owner);

      const plan = createCrmFollowUpPlan(first.lead.id, { dbFilePath: dbPath });
      assert.ok(plan);
      assert.equal(plan?.actions.length, 3);
      assert.equal(plan?.plan.status, 'scheduled');
      assert.equal(plan?.plan.route, 'email');
      assert.equal(plan?.actions[0]?.channel, 'email');
      assert.equal(plan?.actions[0]?.target, 'lead@example.com');

      const actions = listCrmFollowUpActions(10, { leadId: first.lead.id }, dbPath);
      assert.equal(actions.length, 3);

      const dispatched = await dispatchCrmFollowUpAction({ leadId: first.lead.id, note: 'manual dispatch' }, { dbFilePath: dbPath });
      assert.ok(dispatched);
      assert.equal(dispatched?.delivery.status, 'sent');
      assert.equal(dispatched?.completed, false);
      assert.equal(dispatched?.action.status, 'executed');

      const dueDispatch = await dispatchDueCrmFollowUpActions({ dbFilePath: dbPath, note: 'scheduler run' });
      assert.equal(dueDispatch.scanned, 2);
      assert.equal(dueDispatch.dispatched.length, 2);
      assert.equal(dueDispatch.dispatched[1]?.completed, true);

      const cancelled = cancelCrmFollowUpPlan(first.lead.id, 'manual hold', { dbFilePath: dbPath });
      assert.ok(cancelled);
      assert.equal(cancelled?.plan.status, 'cancelled');

      const response = recordCrmLeadResponse(
        first.lead.id,
        { reason: 'customer replied', response: { interested: true } },
        { dbFilePath: dbPath },
      );
      assert.ok(response);
      assert.equal(response?.lead.responseState, 'responded');

      const trail = listCrmFollowUpAuditTrail(20, { leadId: first.lead.id }, dbPath);
      assert.ok(trail.some((event) => event.eventType === 'follow_up_scored'));

      const followUpStats = getCrmFollowUpStats(dbPath);
      assert.ok(followUpStats.totalPlans >= 1);
      assert.ok(followUpStats.activePlans >= 0);
      assert.ok(followUpStats.pendingApprovalPlans >= 0);
    } finally {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.SMTP_FROM;
      closeCrmDb();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports approval, pause, resume, and audit summary for hot leads', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'crm-db-hot-'));
    const dbPath = path.join(tmpDir, 'crm.db');

    try {
      initCrmDb(dbPath);
      const lead = normalizeCrmLead({
        source: 'demo-request',
        payload: {
          email: 'hot@example.com',
          phone: '+36-30-999-8888',
          company: 'Hot Kft',
          created_at: '2026-04-05T09:00:00Z',
          urgency: 'high',
          budget: 7500,
          timeline: 'this week',
        },
      });

      assert.ok(lead);
      const inserted = ingestCrmLead(lead, { dbFilePath: dbPath, workflowId: 'wf-hot' });
      assert.equal(inserted.inserted, true);

      const plan = createCrmFollowUpPlan(inserted.lead.id, { dbFilePath: dbPath });
      assert.ok(plan);
      assert.equal(plan?.plan.status, 'pending_approval');
      assert.equal(plan?.plan.route, 'slack');
      assert.ok(plan?.actions.every((action) => action.status === 'pending_approval'));

      const approved = approveCrmFollowUpPlan(inserted.lead.id, {
        dbFilePath: dbPath,
        reason: 'approved by sales',
        actor: 'sales-manager',
        note: 'send the follow-up',
      });
      assert.ok(approved);
      assert.equal(approved?.plan.status, 'scheduled');
      assert.equal(approved?.lead.followUpState, 'scheduled');

      const paused = pauseCrmFollowUpPlan(inserted.lead.id, {
        dbFilePath: dbPath,
        reason: 'customer requested delay',
        actor: 'sales-manager',
      });
      assert.ok(paused);
      assert.equal(paused?.plan.status, 'paused');

      const resumed = resumeCrmFollowUpPlan(inserted.lead.id, {
        dbFilePath: dbPath,
        reason: 'customer is ready again',
        actor: 'sales-manager',
      });
      assert.ok(resumed);
      assert.equal(resumed?.plan.status, 'scheduled');

      const summary = getCrmFollowUpSummary(dbPath);
      assert.ok(summary.totalPlans >= 1);
      assert.ok(summary.activePlans >= 1);
      assert.ok(summary.manualEventCounts.follow_up_approved >= 1);
      assert.ok(summary.manualEventCounts.follow_up_paused >= 1);
      assert.ok(summary.manualEventCounts.follow_up_resumed >= 1);

      const auditTrail = listCrmFollowUpAuditTrail(10, { leadId: inserted.lead.id }, dbPath);
      const eventTypes = auditTrail.map((event) => event.eventType);
      assert.ok(eventTypes.includes('follow_up_approved'));
      assert.ok(eventTypes.includes('follow_up_paused'));
      assert.ok(eventTypes.includes('follow_up_resumed'));
    } finally {
      closeCrmDb();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
