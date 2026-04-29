import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'vitest';
import {
  approveCrmFollowUpPlan,
  cancelCrmFollowUpPlan,
  closeCrmDb,
  createCrmFollowUpPlan,
  dispatchDueCrmFollowUpActions,
  initCrmDb,
  ingestCrmLead,
  pauseCrmFollowUpPlan,
  resumeCrmFollowUpPlan,
  recordCrmLeadResponse,
} from '@packages/utils/crm_db.js';
import { normalizeCrmLead } from '@packages/utils/crmLead.js';

function buildLead(payload: Record<string, unknown>): ReturnType<typeof normalizeCrmLead> {
  const lead = normalizeCrmLead({
    source: String(payload.source ?? 'website'),
    payload,
  });

  assert.ok(lead);
  return lead;
}

describe('crm follow-up execution', () => {
  let dbPath: string;
  let dbFilePath: string;

  beforeEach(() => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'crm-follow-up-exec-'));
    dbPath = path.join(tmpDir, 'crm.db');
    dbFilePath = dbPath;
    initCrmDb(dbFilePath);
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  it('dispatches due actions once and preserves the configured channel', async () => {
    const emailLead = buildLead({
      source: 'website',
      email: 'warm@example.com',
      company: 'Warm Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
    });
    const slackLead = buildLead({
      source: 'demo-request',
      email: 'hot@example.com',
      phone: '+36-30-999-7777',
      company: 'Hot Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
      urgency: 'high',
      budget: 7500,
      timeline: 'this week',
    });

    const emailInserted = ingestCrmLead(emailLead, { dbFilePath });
    const slackInserted = ingestCrmLead(slackLead, { dbFilePath });
    assert.equal(emailInserted.inserted, true);
    assert.equal(slackInserted.inserted, true);

    const emailPlan = createCrmFollowUpPlan(emailInserted.lead.id, { dbFilePath });
    const slackPlan = createCrmFollowUpPlan(slackInserted.lead.id, { dbFilePath });
    assert.ok(emailPlan);
    assert.ok(slackPlan);
    assert.equal(emailPlan?.plan.status, 'scheduled');
    assert.equal(slackPlan?.plan.status, 'pending_approval');

    const approval = approveCrmFollowUpPlan(slackInserted.lead.id, {
      dbFilePath,
      reason: 'approved for dispatch',
      actor: 'ops',
    });
    assert.ok(approval);

    const firstRun = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'scheduler run' });
    assert.equal(firstRun.scanned, 6);
    assert.equal(firstRun.dispatched.length, 6);

    const channels = firstRun.dispatched.map((item) => item.delivery.channel).sort();
    assert.deepEqual(channels, ['email', 'email', 'email', 'slack', 'slack', 'slack']);

    const secondRun = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'scheduler run' });
    assert.equal(secondRun.scanned, 0);
    assert.equal(secondRun.dispatched.length, 0);
  });

  it('keeps approval and pause/resume gates intact before dispatching', async () => {
    const approvalLead = buildLead({
      source: 'demo-request',
      email: 'approval@example.com',
      phone: '+36-30-111-2222',
      company: 'Approval Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
      urgency: 'high',
      budget: 7500,
      timeline: 'this week',
    });
    const pausedLead = buildLead({
      source: 'website',
      email: 'paused@example.com',
      company: 'Paused Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
    });

    const approvalInserted = ingestCrmLead(approvalLead, { dbFilePath });
    const pausedInserted = ingestCrmLead(pausedLead, { dbFilePath });
    assert.equal(approvalInserted.inserted, true);
    assert.equal(pausedInserted.inserted, true);

    const approvalPlan = createCrmFollowUpPlan(approvalInserted.lead.id, { dbFilePath });
    assert.ok(approvalPlan);
    assert.equal(approvalPlan?.plan.status, 'pending_approval');
    const pausedPlan = createCrmFollowUpPlan(pausedInserted.lead.id, { dbFilePath });
    assert.ok(pausedPlan);
    assert.equal(pausedPlan?.plan.status, 'scheduled');
    const paused = pauseCrmFollowUpPlan(pausedInserted.lead.id, {
      dbFilePath,
      reason: 'wait',
      actor: 'ops',
    });
    assert.ok(paused);

    const blockedBeforeApproval = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'pre-approval' });
    assert.equal(blockedBeforeApproval.scanned, 0);
    assert.equal(blockedBeforeApproval.dispatched.length, 0);

    const approved = approveCrmFollowUpPlan(approvalInserted.lead.id, {
      dbFilePath,
      reason: 'approved',
      actor: 'ops',
    });
    assert.ok(approved);

    const approvedRun = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'approved' });
    assert.equal(approvedRun.scanned, 3);
    assert.equal(approvedRun.dispatched.length, 3);

    const blockedWhilePaused = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'paused' });
    assert.equal(blockedWhilePaused.scanned, 0);
    assert.equal(blockedWhilePaused.dispatched.length, 0);

    const resumed = resumeCrmFollowUpPlan(pausedInserted.lead.id, {
      dbFilePath,
      reason: 'resume',
      actor: 'ops',
    });
    assert.ok(resumed);

    const resumedRun = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'resumed' });
    assert.equal(resumedRun.scanned, 3);
    assert.equal(resumedRun.dispatched.length, 3);
  });

  it('removes cancelled and responded plans from future due execution', async () => {
    const cancelledLead = buildLead({
      source: 'website',
      email: 'cancelled@example.com',
      company: 'Cancelled Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
    });
    const respondedLead = buildLead({
      source: 'website',
      email: 'responded@example.com',
      company: 'Responded Kft',
      created_at: '2026-01-01T00:00:00Z',
      receivedAt: '2026-01-01T00:00:00Z',
    });

    const cancelledInserted = ingestCrmLead(cancelledLead, { dbFilePath });
    const respondedInserted = ingestCrmLead(respondedLead, { dbFilePath });
    assert.ok(cancelledInserted.inserted);
    assert.ok(respondedInserted.inserted);

    const cancelledPlan = createCrmFollowUpPlan(cancelledInserted.lead.id, { dbFilePath });
    const respondedPlan = createCrmFollowUpPlan(respondedInserted.lead.id, { dbFilePath });
    assert.ok(cancelledPlan);
    assert.ok(respondedPlan);

    const cancelled = cancelCrmFollowUpPlan(cancelledInserted.lead.id, 'customer asked to stop', { dbFilePath });
    const responded = recordCrmLeadResponse(
      respondedInserted.lead.id,
      { reason: 'customer replied', response: { interested: true } },
      { dbFilePath },
    );

    assert.ok(cancelled);
    assert.ok(responded);
    assert.equal(cancelled?.plan.status, 'cancelled');
    assert.equal(responded?.lead.responseState, 'responded');

    const run = await dispatchDueCrmFollowUpActions({ dbFilePath, note: 'cancelled-response' });
    assert.equal(run.scanned, 0);
    assert.equal(run.dispatched.length, 0);
  });
});
