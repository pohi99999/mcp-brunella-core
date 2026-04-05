import DatabaseConstructor, { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync } from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import type { NormalizedCrmLead } from '../utils/crmLead.js';
import {
  buildCrmFollowUpSchedule,
  scoreCrmFollowUpLead,
  type CrmFollowUpDecision,
  type CrmFollowUpLeadSnapshot,
  type CrmFollowUpScheduleStep,
} from '../utils/crmFollowUp.js';

export interface CrmLeadRecord {
  id: string;
  source: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  receivedAt: string;
  updatedAt: string;
  followUpState: string;
  responseState: string;
  priorityScore: number;
  assignedOwner: string | null;
  lastResponseAt: string | null;
}

export interface CrmFollowUpPlanRecord {
  id: string;
  leadId: string;
  score: number;
  tier: CrmFollowUpDecision['tier'];
  route: CrmFollowUpDecision['route'];
  owner: string | null;
  status: string;
  nextActionAt: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  responseAt: string | null;
  reasons: string[];
}

export interface CrmFollowUpActionRecord {
  id: string;
  planId: string;
  leadId: string;
  step: CrmFollowUpScheduleStep['step'];
  dueAt: string;
  channel: CrmFollowUpScheduleStep['channel'];
  target: string | null;
  summary: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface CrmFollowUpActionExecutionContext {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  action: CrmFollowUpActionRecord;
}

export interface CrmFollowUpDeliveryRecord {
  channel: CrmFollowUpScheduleStep['channel'];
  target: string;
  provider: 'smtp' | 'webhook';
  status: 'sent' | 'failed' | 'skipped';
  subject: string;
  message: string;
  error?: string;
}

export interface CrmFollowUpDispatchResult {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  action: CrmFollowUpActionRecord;
  remainingActions: CrmFollowUpActionRecord[];
  completed: boolean;
  delivery: CrmFollowUpDeliveryRecord;
}

export interface CrmLeadEventRecord {
  id: number;
  leadId: string;
  eventType: string;
  workflowId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CrmFollowUpSummaryRecord {
  generatedAt: string;
  totalPlans: number;
  activePlans: number;
  pendingApprovalPlans: number;
  pausedPlans: number;
  cancelledPlans: number;
  overdueActions: number;
  dueTodayActions: number;
  byRoute: Record<string, number>;
  byPlanStatus: Record<string, number>;
  byActionStatus: Record<string, number>;
  manualEventCounts: Record<string, number>;
}

interface CrmLeadRow {
  id: string;
  source: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  dedupe_key: string;
  payload: string;
  created_at: string;
  received_at: string;
  updated_at: string;
  follow_up_state: string;
  response_state: string;
  priority_score: number;
  assigned_owner: string | null;
  last_response_at: string | null;
}

interface CrmEventRow {
  id: number;
  lead_id: string;
  event_type: string;
  workflow_id: string | null;
  payload: string;
  created_at: string;
}

interface CrmFollowUpPlanRow {
  id: string;
  lead_id: string;
  score: number;
  tier: string;
  route: string;
  owner: string | null;
  status: string;
  next_action_at: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  response_at: string | null;
  reasons: string;
}

interface CrmFollowUpActionRow {
  id: string;
  plan_id: string;
  lead_id: string;
  step: string;
  due_at: string;
  channel: string;
  target: string | null;
  summary: string;
  status: string;
  payload: string;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

interface CrmSmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

interface CrmDbState {
  db: Database | null;
  path: string | null;
}

const DEFAULT_DB_PATH = 'data/crm.db';
const state: CrmDbState = {
  db: null,
  path: null,
};

function openDB(dbFilePath: string): Database {
  if (state.db) {
    state.db.close();
    state.db = null;
    state.path = null;
  }

  mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new DatabaseConstructor(dbFilePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      dedupe_key TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      follow_up_state TEXT NOT NULL DEFAULT 'pending',
      response_state TEXT NOT NULL DEFAULT 'pending',
      priority_score INTEGER NOT NULL DEFAULT 0,
      assigned_owner TEXT,
      last_response_at TEXT
    );

    CREATE TABLE IF NOT EXISTS crm_lead_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      workflow_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_follow_up_plans (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL UNIQUE,
      score INTEGER NOT NULL,
      tier TEXT NOT NULL,
      route TEXT NOT NULL,
      owner TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      next_action_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cancelled_at TEXT,
      cancel_reason TEXT,
      response_at TEXT,
      reasons TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS crm_follow_up_actions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      step TEXT NOT NULL,
      due_at TEXT NOT NULL,
      channel TEXT NOT NULL,
      target TEXT,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      executed_at TEXT,
      cancelled_at TEXT,
      cancel_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON crm_leads (source);
    CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads (status);
    CREATE INDEX IF NOT EXISTS idx_crm_leads_follow_up_state ON crm_leads (follow_up_state);
    CREATE INDEX IF NOT EXISTS idx_crm_leads_dedupe_key ON crm_leads (dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_up_plans_status ON crm_follow_up_plans (status);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_up_plans_lead_id ON crm_follow_up_plans (lead_id);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_up_actions_plan_id ON crm_follow_up_actions (plan_id);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_up_actions_due_at ON crm_follow_up_actions (due_at);
    CREATE INDEX IF NOT EXISTS idx_crm_follow_up_actions_status ON crm_follow_up_actions (status);
  `);

  state.db = db;
  state.path = dbFilePath;
  return db;
}

function ensureDB(dbFilePath: string = state.path ?? DEFAULT_DB_PATH): Database {
  if (state.db && state.path === dbFilePath) {
    return state.db;
  }

  return openDB(dbFilePath);
}

function toRecord(row: CrmLeadRow): CrmLeadRecord {
  return {
    id: row.id,
    source: row.source,
    email: row.email,
    phone: row.phone,
    company: row.company,
    status: row.status,
    dedupeKey: row.dedupe_key,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.created_at,
    receivedAt: row.received_at,
    updatedAt: row.updated_at,
    followUpState: row.follow_up_state,
    responseState: row.response_state,
    priorityScore: Number(row.priority_score) || 0,
    assignedOwner: row.assigned_owner,
    lastResponseAt: row.last_response_at,
  };
}

function toLeadSnapshot(row: CrmLeadRow): CrmFollowUpLeadSnapshot {
  return {
    id: row.id,
    source: row.source,
    email: row.email,
    phone: row.phone,
    company: row.company,
    status: row.status,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    assignedOwner: row.assigned_owner,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  };
}

function mapPlan(row: CrmFollowUpPlanRow): CrmFollowUpPlanRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    score: Number(row.score) || 0,
    tier: row.tier as CrmFollowUpPlanRecord['tier'],
    route: row.route as CrmFollowUpPlanRecord['route'],
    owner: row.owner,
    status: row.status,
    nextActionAt: row.next_action_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    responseAt: row.response_at,
    reasons: JSON.parse(row.reasons) as string[],
  };
}

function mapAction(row: CrmFollowUpActionRow): CrmFollowUpActionRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    leadId: row.lead_id,
    step: row.step as CrmFollowUpActionRecord['step'],
    channel: row.channel as CrmFollowUpActionRecord['channel'],
    dueAt: row.due_at,
    target: row.target,
    summary: row.summary,
    status: row.status,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    executedAt: row.executed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
  };
}

function mapLeadEvent(row: CrmEventRow): CrmLeadEventRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    eventType: row.event_type,
    workflowId: row.workflow_id,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function claimCrmFollowUpActionExecution(
  actionId: string,
  options: { dbFilePath?: string } = {},
): CrmFollowUpActionExecutionContext | null {
  const db = ensureDB(options.dbFilePath);
  const now = new Date().toISOString();
  const updateResult = db
    .prepare(`
      UPDATE crm_follow_up_actions
      SET status = 'dispatching', updated_at = ?
      WHERE id = ?
        AND status = 'scheduled'
        AND EXISTS (
          SELECT 1
          FROM crm_follow_up_plans AS plan
          INNER JOIN crm_leads AS lead ON lead.id = crm_follow_up_actions.lead_id
          WHERE plan.id = crm_follow_up_actions.plan_id
            AND plan.status != 'cancelled'
            AND lead.response_state = 'pending'
            AND lead.follow_up_state != 'cancelled'
        )
    `)
    .run(now, actionId);

  if (updateResult.changes === 0) {
    return null;
  }

  const actionRow = db.prepare('SELECT * FROM crm_follow_up_actions WHERE id = ?').get(actionId) as
    | CrmFollowUpActionRow
    | undefined;
  const planRow = actionRow
    ? (db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(actionRow.plan_id) as
        | CrmFollowUpPlanRow
        | undefined)
    : undefined;
  const leadRow = actionRow
    ? (db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(actionRow.lead_id) as CrmLeadRow | undefined)
    : undefined;

  if (!actionRow || !planRow || !leadRow) {
    return null;
  }

  return {
    plan: mapPlan(planRow),
    lead: toRecord(leadRow),
    action: mapAction(actionRow),
  };
}

function getCrmSmtpConfig(): CrmSmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

function buildCrmFollowUpDispatchMessage(
  plan: CrmFollowUpPlanRecord,
  lead: CrmLeadRecord,
  action: CrmFollowUpActionRecord,
  note?: string,
): { subject: string; text: string; html: string; slackText: string } {
  const leadLabel = lead.company?.trim() || lead.email?.trim() || lead.id;
  const lines = [
    `Lead: ${leadLabel}`,
    `Lead ID: ${lead.id}`,
    `Plan: ${plan.id}`,
    `Step: ${action.step}`,
    `Due at: ${action.dueAt}`,
    `Channel: ${action.channel}`,
    `Target: ${action.target ?? 'n/a'}`,
    `Summary: ${action.summary}`,
  ];

  if (note) {
    lines.push(`Note: ${note}`);
  }

  if (plan.cancelReason) {
    lines.push(`Plan note: ${plan.cancelReason}`);
  }

  const subject = `[CRM follow-up] ${action.summary} — ${leadLabel}`;
  const text = lines.join('\n');
  const html = [
    `<p><strong>${subject}</strong></p>`,
    '<ul>',
    ...lines.map((line) => `<li>${line}</li>`),
    '</ul>',
  ].join('');

  return {
    subject,
    text,
    html,
    slackText: text,
  };
}

async function sendCrmFollowUpDelivery(
  plan: CrmFollowUpPlanRecord,
  lead: CrmLeadRecord,
  action: CrmFollowUpActionRecord,
  note?: string,
): Promise<CrmFollowUpDeliveryRecord> {
  const message = buildCrmFollowUpDispatchMessage(plan, lead, action, note);
  const target = action.target?.trim() || lead.email?.trim() || '';

  if (action.channel === 'email') {
    const config = getCrmSmtpConfig();
    if (!config || target.length === 0) {
      const error = !config ? 'SMTP config missing' : 'Email target missing';
      logWarn('crm_db', `Skipping CRM email delivery for action ${action.id}: ${error}`);
      return {
        channel: 'email',
        provider: 'smtp',
        status: 'skipped',
        target: target || 'n/a',
        subject: message.subject,
        message: message.text,
        error,
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });

      await transporter.sendMail({
        from: config.from,
        to: target,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      logInfo('crm_db', `CRM follow-up email sent for action ${action.id} to ${target}`);
      return {
        channel: 'email',
        provider: 'smtp',
        status: 'sent',
        target,
        subject: message.subject,
        message: message.text,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError('crm_db', `CRM follow-up email failed for action ${action.id}: ${errorMessage}`);
      return {
        channel: 'email',
        provider: 'smtp',
        status: 'failed',
        target,
        subject: message.subject,
        message: message.text,
        error: errorMessage,
      };
    }
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.BRUNELLA_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    const error = 'Slack webhook missing';
    logWarn('crm_db', `Skipping CRM Slack delivery for action ${action.id}: ${error}`);
    return {
      channel: 'slack',
      provider: 'webhook',
      status: 'skipped',
      target: target || 'n/a',
      subject: message.subject,
      message: message.slackText,
      error,
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `${message.subject}\n${message.slackText}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook HTTP ${response.status}`);
    }

    logInfo('crm_db', `CRM follow-up Slack message sent for action ${action.id} to ${target}`);
    return {
      channel: 'slack',
      provider: 'webhook',
      status: 'sent',
      target: target || 'n/a',
      subject: message.subject,
      message: message.slackText,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('crm_db', `CRM follow-up Slack delivery failed for action ${action.id}: ${errorMessage}`);
    return {
      channel: 'slack',
      provider: 'webhook',
      status: 'failed',
      target: target || 'n/a',
      subject: message.subject,
      message: message.slackText,
      error: errorMessage,
    };
  }
}

function finalizeCrmFollowUpDispatch(
  db: Database,
  actionRow: CrmFollowUpActionRow,
  planRow: CrmFollowUpPlanRow,
  leadRow: CrmLeadRow,
  delivery: CrmFollowUpDeliveryRecord,
  note?: string,
): CrmFollowUpDispatchResult {
  const now = new Date().toISOString();
  const remainingRows = db
    .prepare("SELECT * FROM crm_follow_up_actions WHERE plan_id = ? AND status = 'scheduled' ORDER BY due_at ASC")
    .all(planRow.id) as CrmFollowUpActionRow[];

  const remainingScheduledActions = remainingRows.map(mapAction);
  const hasRemainingScheduledActions = remainingScheduledActions.length > 0;
  const attemptSucceeded = delivery.status === 'sent';

  if (attemptSucceeded) {
    db.prepare(`
      UPDATE crm_follow_up_actions
      SET status = 'executed', executed_at = ?, updated_at = ?, cancel_reason = NULL
      WHERE id = ?
    `).run(now, now, actionRow.id);
  } else {
    db.prepare(`
      UPDATE crm_follow_up_actions
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(delivery.status === 'skipped' ? 'skipped' : 'failed', now, actionRow.id);
  }

  const planStatus = attemptSucceeded
    ? hasRemainingScheduledActions
      ? 'scheduled'
      : 'completed'
    : hasRemainingScheduledActions
      ? 'scheduled'
      : 'failed';
  const leadFollowUpState = attemptSucceeded
    ? hasRemainingScheduledActions
      ? 'in_progress'
      : 'completed'
    : hasRemainingScheduledActions
      ? 'in_progress'
      : 'failed';
  const leadStatus = attemptSucceeded
    ? hasRemainingScheduledActions
      ? 'follow_up_in_progress'
      : 'follow_up_completed'
    : hasRemainingScheduledActions
      ? 'follow_up_in_progress'
      : 'follow_up_failed';

  db.prepare(`
    UPDATE crm_follow_up_plans
    SET status = ?, next_action_at = ?, updated_at = ?
    WHERE id = ?
  `).run(planStatus, hasRemainingScheduledActions ? remainingScheduledActions[0].dueAt : actionRow.due_at, now, planRow.id);

  upsertLeadStatus(db, leadRow.id, {
    status: leadStatus,
    followUpState: leadFollowUpState,
    responseState: leadRow.response_state,
    priorityScore: planRow.score,
    assignedOwner: planRow.owner ?? leadRow.assigned_owner,
    lastResponseAt: leadRow.last_response_at,
  });

  insertLeadEvent(db, leadRow.id, attemptSucceeded ? 'follow_up_action_dispatched' : delivery.status === 'skipped' ? 'follow_up_action_skipped' : 'follow_up_action_failed', null, {
    planId: planRow.id,
    actionId: actionRow.id,
    step: actionRow.step,
    channel: actionRow.channel,
    target: actionRow.target,
    note: note ?? null,
    delivery,
    remainingActions: remainingScheduledActions.map((item) => ({
      id: item.id,
      step: item.step,
      dueAt: item.dueAt,
      channel: item.channel,
    })),
    completed: attemptSucceeded && !hasRemainingScheduledActions,
    recordedAt: now,
  });

  if (attemptSucceeded && !hasRemainingScheduledActions) {
    insertLeadEvent(db, leadRow.id, 'follow_up_completed', null, {
      planId: planRow.id,
      lastActionId: actionRow.id,
      note: note ?? null,
      recordedAt: now,
    });
  }

  if (!attemptSucceeded && !hasRemainingScheduledActions) {
    insertLeadEvent(db, leadRow.id, 'follow_up_failed', null, {
      planId: planRow.id,
      lastActionId: actionRow.id,
      note: note ?? null,
      recordedAt: now,
      delivery,
    });
  }

  const refreshedPlan = db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(planRow.id) as
    | CrmFollowUpPlanRow
    | undefined;
  const refreshedAction = db.prepare('SELECT * FROM crm_follow_up_actions WHERE id = ?').get(actionRow.id) as
    | CrmFollowUpActionRow
    | undefined;
  const refreshedLead = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadRow.id) as CrmLeadRow | undefined;

  return {
    plan: refreshedPlan ? mapPlan(refreshedPlan) : mapPlan(planRow),
    lead: refreshedLead ? toRecord(refreshedLead) : toRecord(leadRow),
    action: refreshedAction ? mapAction(refreshedAction) : mapAction(actionRow),
    remainingActions: remainingScheduledActions,
    completed: attemptSucceeded && !hasRemainingScheduledActions,
    delivery,
  };
}

function insertLeadEvent(
  db: Database,
  leadId: string,
  eventType: string,
  workflowId: string | null,
  payload: Record<string, unknown>,
): void {
  db.prepare(`
    INSERT INTO crm_lead_events (lead_id, event_type, workflow_id, payload)
    VALUES (?, ?, ?, ?)
  `).run(leadId, eventType, workflowId, JSON.stringify(payload));
}

function upsertLeadStatus(
  db: Database,
  leadId: string,
  fields: {
    status?: string;
    followUpState?: string;
    responseState?: string;
    priorityScore?: number;
    assignedOwner?: string | null;
    lastResponseAt?: string | null;
  },
): void {
  const current = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!current) {
    return;
  }

  db.prepare(`
    UPDATE crm_leads
    SET
      status = ?,
      follow_up_state = ?,
      response_state = ?,
      priority_score = ?,
      assigned_owner = ?,
      last_response_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    fields.status ?? current.status,
    fields.followUpState ?? current.follow_up_state,
    fields.responseState ?? current.response_state,
    fields.priorityScore ?? current.priority_score,
    fields.assignedOwner ?? current.assigned_owner,
    fields.lastResponseAt ?? current.last_response_at,
    new Date().toISOString(),
    leadId,
  );
}

function updateCrmFollowUpPlanLifecycle(
  db: Database,
  leadId: string,
  options: {
    planStatus: 'scheduled' | 'pending_approval' | 'paused';
    leadFollowUpState: 'scheduled' | 'pending_approval' | 'paused';
    actionStatuses: Array<'scheduled' | 'pending_approval' | 'paused'>;
    actionStatus: 'scheduled' | 'pending_approval' | 'paused';
    eventType: string;
    eventPayload: Record<string, unknown>;
    leadStatus?: string;
  },
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  actions: CrmFollowUpActionRecord[];
} | null {
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!leadRow || leadRow.response_state !== 'pending' || leadRow.follow_up_state === 'cancelled') {
    return null;
  }

  const planRow = db.prepare('SELECT * FROM crm_follow_up_plans WHERE lead_id = ?').get(leadId) as
    | CrmFollowUpPlanRow
    | undefined;
  if (!planRow || planRow.status === 'cancelled') {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE crm_follow_up_plans
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(options.planStatus, now, planRow.id);

  if (options.actionStatuses.length > 0) {
    const placeholders = options.actionStatuses.map(() => '?').join(', ');
    db.prepare(`
      UPDATE crm_follow_up_actions
      SET status = ?, updated_at = ?
      WHERE plan_id = ? AND status IN (${placeholders})
    `).run(options.actionStatus, now, planRow.id, ...options.actionStatuses);
  }

  upsertLeadStatus(db, leadId, {
    status: options.leadStatus ?? (leadRow.status === 'new' ? 'follow_up' : leadRow.status),
    followUpState: options.leadFollowUpState,
  });

  insertLeadEvent(db, leadId, options.eventType, null, {
    ...options.eventPayload,
    planId: planRow.id,
    leadId,
    previousPlanStatus: planRow.status,
    previousFollowUpState: leadRow.follow_up_state,
    previousResponseState: leadRow.response_state,
    recordedAt: now,
  });

  const refreshedPlan = db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(planRow.id) as
    | CrmFollowUpPlanRow
    | undefined;
  const refreshedActions = db
    .prepare('SELECT * FROM crm_follow_up_actions WHERE plan_id = ? ORDER BY due_at ASC')
    .all(planRow.id) as CrmFollowUpActionRow[];

  return {
    plan: refreshedPlan ? mapPlan(refreshedPlan) : mapPlan(planRow),
    lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
    actions: refreshedActions.map(mapAction),
  };
}

export function initCrmDb(dbFilePath: string = DEFAULT_DB_PATH): void {
  try {
    openDB(dbFilePath);
  } catch (error) {
    logError('crm_db', 'Failed to initialize CRM database:', error);
    throw error;
  }
}

export function closeCrmDb(): void {
  if (!state.db) {
    return;
  }

  state.db.close();
  state.db = null;
  state.path = null;
}

export function ingestCrmLead(
  lead: NormalizedCrmLead,
  options: { dbFilePath?: string; workflowId?: string } = {},
): { inserted: boolean; eventType: 'created' | 'deduped'; lead: CrmLeadRecord } {
  const db = ensureDB(options.dbFilePath);
  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT * FROM crm_leads WHERE dedupe_key = ?')
    .get(lead.dedupeKey) as CrmLeadRow | undefined;

  const payload = {
    ...lead.raw,
    canonical: {
      id: lead.id,
      source: lead.source,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      dedupeKey: lead.dedupeKey,
      receivedAt: lead.receivedAt,
      createdAt: lead.createdAt,
    },
  };

  if (existing) {
    db.prepare(`
      UPDATE crm_leads
      SET
        source = ?,
        email = ?,
        phone = ?,
        company = ?,
        payload = ?,
        updated_at = ?,
        last_response_at = COALESCE(last_response_at, NULL)
      WHERE dedupe_key = ?
    `).run(
      lead.source,
      lead.email,
      lead.phone,
      lead.company,
      JSON.stringify(payload),
      now,
      lead.dedupeKey,
    );

    insertLeadEvent(db, existing.id, 'deduped', options.workflowId ?? null, {
      dedupeKey: lead.dedupeKey,
      source: lead.source,
      updatedAt: now,
    });

    const updated = db
      .prepare('SELECT * FROM crm_leads WHERE dedupe_key = ?')
      .get(lead.dedupeKey) as CrmLeadRow;

    return {
      inserted: false,
      eventType: 'deduped',
      lead: toRecord(updated),
    };
  }

  db.prepare(`
    INSERT INTO crm_leads (
      id, source, email, phone, company, status, dedupe_key, payload,
      created_at, received_at, updated_at, follow_up_state, response_state,
      priority_score, assigned_owner, last_response_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lead.id,
    lead.source,
    lead.email,
    lead.phone,
    lead.company,
    'new',
    lead.dedupeKey,
    JSON.stringify(payload),
    lead.createdAt,
    lead.receivedAt,
    now,
    'pending',
    'pending',
    0,
    null,
    null,
  );

  const record = db
    .prepare('SELECT * FROM crm_leads WHERE dedupe_key = ?')
    .get(lead.dedupeKey) as CrmLeadRow;

  insertLeadEvent(db, record.id, 'created', options.workflowId ?? null, {
    dedupeKey: lead.dedupeKey,
    source: lead.source,
    receivedAt: lead.receivedAt,
  });

  return {
    inserted: true,
    eventType: 'created',
    lead: toRecord(record),
  };
}

export function listCrmLeads(
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
  limit = 25,
): CrmLeadRecord[] {
  const db = ensureDB(dbFilePath);
  const rows = db
    .prepare('SELECT * FROM crm_leads ORDER BY updated_at DESC LIMIT ?')
    .all(Math.min(Math.max(limit, 1), 200)) as CrmLeadRow[];

  return rows.map(toRecord);
}

export function getCrmLeadById(
  leadId: string,
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
): CrmLeadRecord | null {
  const db = ensureDB(dbFilePath);
  const row = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  return row ? toRecord(row) : null;
}

export function getCrmLeadStats(dbFilePath: string = state.path ?? DEFAULT_DB_PATH): {
  total: number;
  active: number;
  deduped: number;
  byStatus: Record<string, number>;
} {
  const db = ensureDB(dbFilePath);
  const total = db.prepare('SELECT COUNT(*) AS value FROM crm_leads').get() as { value: number };
  const active = db
    .prepare("SELECT COUNT(*) AS value FROM crm_leads WHERE follow_up_state IN ('pending', 'pending_approval', 'scheduled', 'paused')")
    .get() as { value: number };
  const deduped = db.prepare('SELECT COUNT(*) AS value FROM crm_lead_events WHERE event_type = ?').get('deduped') as { value: number };
  const statusRows = db
    .prepare('SELECT status, COUNT(*) AS count FROM crm_leads GROUP BY status')
    .all() as Array<{ status: string; count: number }>;

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  return {
    total: total.value || 0,
    active: active.value || 0,
    deduped: deduped.value || 0,
    byStatus,
  };
}

export function scoreCrmFollowUpLeadById(
  leadId: string,
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
): { lead: CrmLeadRecord; decision: CrmFollowUpDecision } | null {
  const db = ensureDB(dbFilePath);
  const row = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!row) {
    return null;
  }

  return {
    lead: toRecord(row),
    decision: scoreCrmFollowUpLead(toLeadSnapshot(row)),
  };
}

export function recordCrmLeadScore(
  leadId: string,
  options: { dbFilePath?: string; workflowId?: string } = {},
): { lead: CrmLeadRecord; decision: CrmFollowUpDecision } | null {
  const db = ensureDB(options.dbFilePath);
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!leadRow) {
    return null;
  }

  const beforeScore = Number(leadRow.priority_score) || 0;
  const decision = scoreCrmFollowUpLead(toLeadSnapshot(leadRow));
  const now = new Date().toISOString();

  upsertLeadStatus(db, leadId, {
    priorityScore: decision.score,
    assignedOwner: decision.owner,
  });

  insertLeadEvent(db, leadId, 'follow_up_scored', options.workflowId ?? null, {
    score: decision.score,
    previousScore: beforeScore,
    tier: decision.tier,
    route: decision.route,
    owner: decision.owner,
    reasons: decision.reasons,
    leadStatus: leadRow.status,
    followUpState: leadRow.follow_up_state,
    responseState: leadRow.response_state,
    recordedAt: now,
  });

  return {
    lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
    decision,
  };
}

export function createCrmFollowUpPlan(
  leadId: string,
  options: { dbFilePath?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  decision: CrmFollowUpDecision;
  actions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!leadRow) {
    return null;
  }

  if (leadRow.response_state !== 'pending' || leadRow.follow_up_state === 'cancelled') {
    return null;
  }

  const existingPlan = db.prepare('SELECT * FROM crm_follow_up_plans WHERE lead_id = ?').get(leadId) as
    | CrmFollowUpPlanRow
    | undefined;
  if (existingPlan) {
    const actions = db
      .prepare('SELECT * FROM crm_follow_up_actions WHERE plan_id = ? ORDER BY due_at ASC')
      .all(existingPlan.id) as CrmFollowUpActionRow[];
    const decision: CrmFollowUpDecision = {
      score: Number(existingPlan.score) || 0,
      tier: existingPlan.tier as CrmFollowUpDecision['tier'],
      route: existingPlan.route as CrmFollowUpDecision['route'],
      owner: existingPlan.owner ?? leadRow.assigned_owner ?? 'sales-standard',
      reasons: JSON.parse(existingPlan.reasons) as string[],
    };

    return {
      plan: mapPlan(existingPlan),
      lead: toRecord(leadRow),
      decision,
      actions: actions.map(mapAction),
    };
  }

  const snapshot = toLeadSnapshot(leadRow);
  const decision = scoreCrmFollowUpLead(snapshot);
  const steps = buildCrmFollowUpSchedule(snapshot, decision);
  const approvalRequired = decision.tier === 'hot';
  const initialStatus = approvalRequired ? 'pending_approval' : 'scheduled';
  const now = new Date().toISOString();
  const planId = crypto.randomUUID();
  const nextActionAt = steps[0]?.dueAt ?? now;

  db.prepare(`
    INSERT INTO crm_follow_up_plans (
      id, lead_id, score, tier, route, owner, status, next_action_at,
      created_at, updated_at, cancelled_at, cancel_reason, response_at, reasons
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    leadId,
      decision.score,
      decision.tier,
      decision.route,
      decision.owner,
      initialStatus,
      nextActionAt,
      now,
      now,
    null,
    null,
    null,
    JSON.stringify(decision.reasons),
  );

  const actions: CrmFollowUpActionRecord[] = [];
  for (const step of steps) {
    const actionId = crypto.randomUUID();
    const payload = {
      leadId,
      planId,
      step: step.step,
      route: decision.route,
      owner: decision.owner,
      score: decision.score,
      tier: decision.tier,
      summary: step.summary,
    };

    db.prepare(`
      INSERT INTO crm_follow_up_actions (
        id, plan_id, lead_id, step, due_at, channel, target, summary,
        status, payload, created_at, updated_at, executed_at, cancelled_at, cancel_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      planId,
      leadId,
      step.step,
      step.dueAt,
      step.channel,
      step.target,
      step.summary,
      initialStatus,
      JSON.stringify(payload),
      now,
      now,
      null,
      null,
      null,
    );

    actions.push({
      id: actionId,
      planId,
      leadId,
      step: step.step,
      dueAt: step.dueAt,
      channel: step.channel,
      target: step.target,
      summary: step.summary,
      status: initialStatus,
      payload,
      createdAt: now,
      updatedAt: now,
      executedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });
  }

  upsertLeadStatus(db, leadId, {
    status: 'follow_up',
    followUpState: initialStatus,
    responseState: 'pending',
    priorityScore: decision.score,
    assignedOwner: decision.owner,
  });

  insertLeadEvent(db, leadId, 'follow_up_planned', null, {
    planId,
    score: decision.score,
    tier: decision.tier,
    route: decision.route,
    owner: decision.owner,
    approvalRequired,
    reasons: decision.reasons,
    actions: steps,
    leadStatus: 'follow_up',
    followUpState: initialStatus,
    responseState: 'pending',
    priorityScore: decision.score,
  });

  return {
    plan: mapPlan(db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(planId) as CrmFollowUpPlanRow),
    lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
    decision,
    actions,
  };
}

export function cancelCrmFollowUpPlan(
  leadId: string,
  reason: string,
  options: { dbFilePath?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  cancelledActions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!leadRow) {
    return null;
  }

  const planRow = db.prepare('SELECT * FROM crm_follow_up_plans WHERE lead_id = ?').get(leadId) as
    | CrmFollowUpPlanRow
    | undefined;
  const now = new Date().toISOString();

  if (!planRow) {
    upsertLeadStatus(db, leadId, {
      followUpState: 'cancelled',
      status: leadRow.status === 'new' ? 'follow_up_cancelled' : leadRow.status,
    });

    insertLeadEvent(db, leadId, 'follow_up_cancelled', null, {
      planId: null,
      reason,
      previousPlanStatus: null,
      previousFollowUpState: leadRow.follow_up_state,
      previousResponseState: leadRow.response_state,
      recordedAt: now,
    });

    return {
      plan: {
        id: crypto.randomUUID(),
        leadId,
        score: leadRow.priority_score || 0,
        tier: 'nurture',
        route: 'email',
        owner: leadRow.assigned_owner,
        status: 'cancelled',
        nextActionAt: now,
        createdAt: leadRow.created_at,
        updatedAt: now,
        cancelledAt: now,
        cancelReason: reason,
        responseAt: leadRow.last_response_at,
        reasons: [],
      },
      lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
      cancelledActions: [],
    };
  }

  db.prepare(`
    UPDATE crm_follow_up_plans
    SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(now, reason, now, planRow.id);

  db.prepare(`
    UPDATE crm_follow_up_actions
    SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
    WHERE plan_id = ? AND status IN ('scheduled', 'pending_approval', 'paused', 'dispatching')
  `).run(now, reason, now, planRow.id);

  upsertLeadStatus(db, leadId, {
    followUpState: 'cancelled',
    status: leadRow.status === 'new' ? 'follow_up_cancelled' : leadRow.status,
  });

  insertLeadEvent(db, leadId, 'follow_up_cancelled', null, {
    planId: planRow.id,
    reason,
    previousPlanStatus: planRow.status,
    previousFollowUpState: leadRow.follow_up_state,
    previousResponseState: leadRow.response_state,
  });

  const plan = mapPlan(db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(planRow.id) as CrmFollowUpPlanRow);
  const cancelledActions = db
    .prepare('SELECT * FROM crm_follow_up_actions WHERE plan_id = ? ORDER BY due_at ASC')
    .all(planRow.id)
    .map((row) => mapAction(row as CrmFollowUpActionRow));

  return {
    plan,
    lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
    cancelledActions,
  };
}

export function recordCrmLeadResponse(
  leadId: string,
  input: { response?: unknown; reason: string },
  options: { dbFilePath?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  cancelledActions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow | undefined;
  if (!leadRow) {
    return null;
  }

  const planRow = db.prepare('SELECT * FROM crm_follow_up_plans WHERE lead_id = ?').get(leadId) as
    | CrmFollowUpPlanRow
    | undefined;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE crm_leads
    SET
      status = 'responded',
      follow_up_state = 'cancelled',
      response_state = 'responded',
      last_response_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(now, now, leadId);

  if (planRow) {
    db.prepare(`
      UPDATE crm_follow_up_plans
      SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ?), cancel_reason = COALESCE(cancel_reason, ?), response_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, input.reason, now, now, planRow.id);

    db.prepare(`
      UPDATE crm_follow_up_actions
      SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ?), cancel_reason = COALESCE(cancel_reason, ?), updated_at = ?
      WHERE plan_id = ? AND status IN ('scheduled', 'pending_approval', 'paused', 'dispatching')
    `).run(now, input.reason, now, planRow.id);
  }

  insertLeadEvent(db, leadId, 'response_recorded', null, {
    response: input.response ?? null,
    reason: input.reason,
    planId: planRow?.id ?? null,
    previousStatus: leadRow.status,
    previousFollowUpState: leadRow.follow_up_state,
    previousResponseState: leadRow.response_state,
    previousPriorityScore: leadRow.priority_score,
    recordedAt: now,
  });

  const cancelledActions = planRow
    ? db
        .prepare('SELECT * FROM crm_follow_up_actions WHERE plan_id = ? ORDER BY due_at ASC')
        .all(planRow.id)
        .map((row) => mapAction(row as CrmFollowUpActionRow))
    : [];

  return {
    plan: planRow
      ? mapPlan(db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(planRow.id) as CrmFollowUpPlanRow)
      : {
          id: crypto.randomUUID(),
          leadId,
          score: leadRow.priority_score || 0,
          tier: 'nurture',
          route: 'email',
          owner: leadRow.assigned_owner,
          status: 'cancelled',
          nextActionAt: now,
          createdAt: leadRow.created_at,
          updatedAt: now,
          cancelledAt: now,
          cancelReason: input.reason,
          responseAt: now,
          reasons: [],
        },
    lead: toRecord(db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(leadId) as CrmLeadRow),
    cancelledActions,
  };
}

export function listCrmFollowUpPlans(
  limit = 25,
  status?: string,
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
): Array<CrmFollowUpPlanRecord & { actionCount: number }> {
  const db = ensureDB(dbFilePath);
  const rows = db
    .prepare('SELECT * FROM crm_follow_up_plans ORDER BY updated_at DESC LIMIT ?')
    .all(Math.min(Math.max(limit, 1), 200)) as CrmFollowUpPlanRow[];

  return rows
    .filter((row) => !status || row.status === status)
    .map((row) => {
      const actionCount = db
        .prepare('SELECT COUNT(*) AS value FROM crm_follow_up_actions WHERE plan_id = ?')
        .get(row.id) as { value: number };

      return {
        ...mapPlan(row),
        actionCount: actionCount.value || 0,
      };
    });
}

export function listCrmFollowUpActions(
  limit = 25,
  filters: { status?: string; leadId?: string; planId?: string } = {},
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
): CrmFollowUpActionRecord[] {
  const db = ensureDB(dbFilePath);
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.leadId) {
    clauses.push('lead_id = ?');
    params.push(filters.leadId);
  }
  if (filters.planId) {
    clauses.push('plan_id = ?');
    params.push(filters.planId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM crm_follow_up_actions ${where} ORDER BY due_at ASC LIMIT ?`)
    .all(...params, Math.min(Math.max(limit, 1), 200)) as CrmFollowUpActionRow[];

  return rows.map(mapAction);
}

export async function dispatchCrmFollowUpAction(
  input: { actionId?: string; leadId?: string; note?: string },
  options: { dbFilePath?: string } = {},
): Promise<CrmFollowUpDispatchResult | null> {
  const db = ensureDB(options.dbFilePath);
  const now = new Date().toISOString();

  const actionRow = input.actionId
    ? (db.prepare('SELECT * FROM crm_follow_up_actions WHERE id = ?').get(input.actionId) as CrmFollowUpActionRow | undefined)
    : input.leadId
      ? (db
          .prepare("SELECT * FROM crm_follow_up_actions WHERE lead_id = ? AND status = 'scheduled' ORDER BY due_at ASC LIMIT 1")
          .get(input.leadId) as CrmFollowUpActionRow | undefined)
      : undefined;

  if (!actionRow) {
    return null;
  }

  const planRow = db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(actionRow.plan_id) as
    | CrmFollowUpPlanRow
    | undefined;
  const leadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(actionRow.lead_id) as CrmLeadRow | undefined;

  if (!planRow || !leadRow || planRow.status === 'cancelled' || actionRow.status !== 'scheduled') {
    return null;
  }

  const claimResult = db.prepare(`
    UPDATE crm_follow_up_actions
    SET status = 'dispatching', updated_at = ?
    WHERE id = ? AND status = 'scheduled'
  `).run(now, actionRow.id);
  if (claimResult.changes === 0) {
    return null;
  }

  const freshPlanRow = db.prepare('SELECT * FROM crm_follow_up_plans WHERE id = ?').get(actionRow.plan_id) as
    | CrmFollowUpPlanRow
    | undefined;
  const freshLeadRow = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(actionRow.lead_id) as
    | CrmLeadRow
    | undefined;
  if (!freshPlanRow || !freshLeadRow || freshPlanRow.status === 'cancelled' || freshLeadRow.response_state !== 'pending') {
    db.prepare(`
      UPDATE crm_follow_up_actions
      SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(now, 'cancelled before dispatch', now, actionRow.id);
    return null;
  }

  const delivery = await sendCrmFollowUpDelivery(mapPlan(freshPlanRow), toRecord(freshLeadRow), mapAction(actionRow), input.note);
  return finalizeCrmFollowUpDispatch(db, actionRow, freshPlanRow, freshLeadRow, delivery, input.note);
}

export async function dispatchDueCrmFollowUpActions(
  options: { dbFilePath?: string; limit?: number; note?: string } = {},
): Promise<{
  generatedAt: string;
  scanned: number;
  dispatched: Array<CrmFollowUpDispatchResult>;
}> {
  const db = ensureDB(options.dbFilePath);
  const generatedAt = new Date().toISOString();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = db
    .prepare(
      "SELECT * FROM crm_follow_up_actions WHERE status = 'scheduled' AND due_at <= ? ORDER BY due_at ASC LIMIT ?",
    )
    .all(generatedAt, limit) as CrmFollowUpActionRow[];

  const dispatched: CrmFollowUpDispatchResult[] = [];
  for (const row of rows) {
    const result = await dispatchCrmFollowUpAction(
      { actionId: row.id, note: options.note ?? 'scheduled dispatch' },
      { dbFilePath: options.dbFilePath },
    );
    if (result) {
      dispatched.push(result);
    }
  }

  return {
    generatedAt,
    scanned: rows.length,
    dispatched,
  };
}

export function approveCrmFollowUpPlan(
  leadId: string,
  options: { dbFilePath?: string; reason?: string; actor?: string; note?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  actions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  return updateCrmFollowUpPlanLifecycle(db, leadId, {
    planStatus: 'scheduled',
    leadFollowUpState: 'scheduled',
    actionStatuses: ['pending_approval', 'paused'],
    actionStatus: 'scheduled',
    eventType: 'follow_up_approved',
    eventPayload: {
      actor: options.actor ?? null,
      reason: options.reason ?? 'approved',
      note: options.note ?? null,
    },
  });
}

export function pauseCrmFollowUpPlan(
  leadId: string,
  options: { dbFilePath?: string; reason?: string; actor?: string; note?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  actions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  return updateCrmFollowUpPlanLifecycle(db, leadId, {
    planStatus: 'paused',
    leadFollowUpState: 'paused',
    actionStatuses: ['scheduled', 'pending_approval'],
    actionStatus: 'paused',
    eventType: 'follow_up_paused',
    eventPayload: {
      actor: options.actor ?? null,
      reason: options.reason ?? 'paused',
      note: options.note ?? null,
    },
  });
}

export function resumeCrmFollowUpPlan(
  leadId: string,
  options: { dbFilePath?: string; reason?: string; actor?: string; note?: string } = {},
): {
  plan: CrmFollowUpPlanRecord;
  lead: CrmLeadRecord;
  actions: CrmFollowUpActionRecord[];
} | null {
  const db = ensureDB(options.dbFilePath);
  return updateCrmFollowUpPlanLifecycle(db, leadId, {
    planStatus: 'scheduled',
    leadFollowUpState: 'scheduled',
    actionStatuses: ['paused', 'pending_approval'],
    actionStatus: 'scheduled',
    eventType: 'follow_up_resumed',
    eventPayload: {
      actor: options.actor ?? null,
      reason: options.reason ?? 'resumed',
      note: options.note ?? null,
    },
  });
}

export function listCrmFollowUpAuditTrail(
  limit = 25,
  filters: { leadId?: string } = {},
  dbFilePath: string = state.path ?? DEFAULT_DB_PATH,
): CrmLeadEventRecord[] {
  const db = ensureDB(dbFilePath);
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filters.leadId) {
    clauses.push('lead_id = ?');
    params.push(filters.leadId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM crm_lead_events ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(...params, Math.min(Math.max(limit, 1), 200)) as CrmEventRow[];

  return rows.map(mapLeadEvent);
}

export function getCrmFollowUpSummary(dbFilePath: string = state.path ?? DEFAULT_DB_PATH): CrmFollowUpSummaryRecord {
  const db = ensureDB(dbFilePath);
  const generatedAt = new Date().toISOString();
  const totalPlans = db.prepare('SELECT COUNT(*) AS value FROM crm_follow_up_plans').get() as { value: number };
  const activePlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status IN ('scheduled', 'pending_approval')")
    .get() as { value: number };
  const pendingApprovalPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'pending_approval'")
    .get() as { value: number };
  const pausedPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'paused'")
    .get() as { value: number };
  const cancelledPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'cancelled'")
    .get() as { value: number };
  const overdueActions = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_actions WHERE status IN ('scheduled', 'pending_approval', 'dispatching') AND due_at < ?")
    .get(generatedAt) as { value: number };
  const startOfDay = new Date(generatedAt);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(startOfDay);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dueTodayActions = db
    .prepare(
      "SELECT COUNT(*) AS value FROM crm_follow_up_actions WHERE status IN ('scheduled', 'pending_approval', 'dispatching') AND due_at >= ? AND due_at < ?",
    )
    .get(startOfDay.toISOString(), nextDay.toISOString()) as { value: number };
  const routeRows = db
    .prepare('SELECT route, COUNT(*) AS count FROM crm_follow_up_plans GROUP BY route')
    .all() as Array<{ route: string; count: number }>;
  const planRows = db
    .prepare('SELECT status, COUNT(*) AS count FROM crm_follow_up_plans GROUP BY status')
    .all() as Array<{ status: string; count: number }>;
  const actionRows = db
    .prepare('SELECT status, COUNT(*) AS count FROM crm_follow_up_actions GROUP BY status')
    .all() as Array<{ status: string; count: number }>;
  const eventRows = db
    .prepare(`
      SELECT event_type, COUNT(*) AS count
      FROM crm_lead_events
      WHERE event_type LIKE 'follow_up_%' OR event_type = 'response_recorded'
      GROUP BY event_type
    `)
    .all() as Array<{ event_type: string; count: number }>;

  const byRoute: Record<string, number> = {};
  for (const row of routeRows) {
    byRoute[row.route] = row.count;
  }

  const byPlanStatus: Record<string, number> = {};
  for (const row of planRows) {
    byPlanStatus[row.status] = row.count;
  }

  const byActionStatus: Record<string, number> = {};
  for (const row of actionRows) {
    byActionStatus[row.status] = row.count;
  }

  const manualEventCounts: Record<string, number> = {};
  for (const eventType of [
    'follow_up_scored',
    'follow_up_planned',
    'follow_up_approved',
    'follow_up_paused',
    'follow_up_resumed',
    'follow_up_cancelled',
    'follow_up_action_dispatched',
    'follow_up_action_skipped',
    'follow_up_action_failed',
    'follow_up_completed',
    'follow_up_failed',
    'response_recorded',
  ]) {
    manualEventCounts[eventType] = 0;
  }
  for (const row of eventRows) {
    manualEventCounts[row.event_type] = row.count;
  }

  return {
    generatedAt,
    totalPlans: totalPlans.value || 0,
    activePlans: activePlans.value || 0,
    pendingApprovalPlans: pendingApprovalPlans.value || 0,
    pausedPlans: pausedPlans.value || 0,
    cancelledPlans: cancelledPlans.value || 0,
    overdueActions: overdueActions.value || 0,
    dueTodayActions: dueTodayActions.value || 0,
    byRoute,
    byPlanStatus,
    byActionStatus,
    manualEventCounts,
  };
}

export function getCrmFollowUpStats(dbFilePath: string = state.path ?? DEFAULT_DB_PATH): {
  totalPlans: number;
  activePlans: number;
  pendingApprovalPlans: number;
  pausedPlans: number;
  cancelledPlans: number;
  byRoute: Record<string, number>;
} {
  const db = ensureDB(dbFilePath);
  const totalPlans = db.prepare('SELECT COUNT(*) AS value FROM crm_follow_up_plans').get() as { value: number };
  const activePlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status IN ('scheduled', 'pending_approval')")
    .get() as { value: number };
  const pendingApprovalPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'pending_approval'")
    .get() as { value: number };
  const pausedPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'paused'")
    .get() as { value: number };
  const cancelledPlans = db
    .prepare("SELECT COUNT(*) AS value FROM crm_follow_up_plans WHERE status = 'cancelled'")
    .get() as { value: number };
  const routeRows = db
    .prepare('SELECT route, COUNT(*) AS count FROM crm_follow_up_plans GROUP BY route')
    .all() as Array<{ route: string; count: number }>;

  const byRoute: Record<string, number> = {};
  for (const row of routeRows) {
    byRoute[row.route] = row.count;
  }

  return {
    totalPlans: totalPlans.value || 0,
    activePlans: activePlans.value || 0,
    pendingApprovalPlans: pendingApprovalPlans.value || 0,
    pausedPlans: pausedPlans.value || 0,
    cancelledPlans: cancelledPlans.value || 0,
    byRoute,
  };
}
