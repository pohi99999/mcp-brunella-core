/**
 * psales_db.ts — Persistent SQLite store for P-Sales Strategy Plans & Audit Events.
 *
 * Follows the same conventions as crm_db.ts:
 *   - synchronous better-sqlite3 API
 *   - explicit schema, indexes
 *   - initPSalesDb / closePSalesDb helpers for test-time lifecycle control
 *   - :memory: for VITEST / test environments
 */

import DatabaseConstructor, { Database } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logError, logInfo } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'paused';

export interface StrategyChannel {
  name: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

/** Persisted strategy plan row (camelCase for application layer). */
export interface StrategyPlanRecord {
  planId: string;
  propertyType: string;
  location: string;
  estimatedValue: number;
  approvalState: ApprovalState;
  channels: StrategyChannel[];
  targetSegments: string[];
  approvalSteps: string[];
  summary: string;
  generatedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  resumeToken: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single audit entry for human-in-loop state changes. */
export interface PSalesAuditEvent {
  id: number;
  planId: string;
  eventType: string;
  actor: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Summary counts returned by the weekly-status endpoint. */
export interface PSalesStatusSummary {
  generatedAt: string;
  totalPlans: number;
  byApprovalState: {
    pending: number;
    approved: number;
    rejected: number;
    paused: number;
  };
  recentAuditEvents: PSalesAuditEvent[];
}

// ---------------------------------------------------------------------------
// Internal Row Types
// ---------------------------------------------------------------------------

interface StrategyPlanRow {
  plan_id: string;
  property_type: string;
  location: string;
  estimated_value: number;
  approval_state: string;
  channels_json: string;
  target_segments_json: string;
  approval_steps_json: string;
  summary: string;
  generated_at: string;
  decided_at: string | null;
  decided_by: string | null;
  resume_token: string | null;
  paused_at: string | null;
  pause_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditEventRow {
  id: number;
  plan_id: string;
  event_type: string;
  actor: string | null;
  note: string | null;
  payload_json: string;
  created_at: string;
}

interface CountByStateRow {
  approval_state: string;
  cnt: number;
}

// ---------------------------------------------------------------------------
// Module-level DB state (matches crm_db.ts pattern)
// ---------------------------------------------------------------------------

const DEFAULT_DB_PATH = 'data/psales.db';

interface PSalesDbState {
  db: Database | null;
  path: string | null;
}

const state: PSalesDbState = {
  db: null,
  path: null,
};

// ---------------------------------------------------------------------------
// Schema DDL
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS psales_strategy_plans (
    plan_id           TEXT PRIMARY KEY,
    property_type     TEXT NOT NULL,
    location          TEXT NOT NULL DEFAULT 'Budapest',
    estimated_value   REAL NOT NULL DEFAULT 0,
    approval_state    TEXT NOT NULL DEFAULT 'pending'
                        CHECK (approval_state IN ('pending','approved','rejected','paused')),
    channels_json     TEXT NOT NULL DEFAULT '[]',
    target_segments_json TEXT NOT NULL DEFAULT '[]',
    approval_steps_json  TEXT NOT NULL DEFAULT '[]',
    summary           TEXT NOT NULL DEFAULT '',
    generated_at      TEXT NOT NULL,
    decided_at        TEXT,
    decided_by        TEXT,
    resume_token      TEXT,
    paused_at         TEXT,
    pause_reason      TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_psales_plans_state
    ON psales_strategy_plans (approval_state);

  CREATE INDEX IF NOT EXISTS idx_psales_plans_generated
    ON psales_strategy_plans (generated_at);

  CREATE TABLE IF NOT EXISTS psales_audit_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id      TEXT NOT NULL,
    event_type   TEXT NOT NULL,
    actor        TEXT,
    note         TEXT,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_psales_audit_plan_id
    ON psales_audit_events (plan_id);

  CREATE INDEX IF NOT EXISTS idx_psales_audit_created
    ON psales_audit_events (created_at);
`;

// ---------------------------------------------------------------------------
// DB open / init
// ---------------------------------------------------------------------------

function resolveDbPath(provided?: string): string {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  if (provided) return provided;
  if (isTestEnv) return ':memory:';
  return DEFAULT_DB_PATH;
}

function openDB(dbFilePath: string): Database {
  if (state.db) {
    state.db.close();
    state.db = null;
    state.path = null;
  }

  if (dbFilePath !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(dbFilePath)), { recursive: true });
  }

  const db = new DatabaseConstructor(dbFilePath);

  if (dbFilePath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.exec(SCHEMA_SQL);

  state.db = db;
  state.path = dbFilePath;

  const mode = dbFilePath === ':memory:' ? 'in-memory' : `WAL @ ${dbFilePath}`;
  logInfo('psales_db', `P-Sales DB initialized (${mode})`);
  return db;
}

function ensureDB(): Database {
  if (state.db) return state.db;
  return openDB(resolveDbPath());
}

// ---------------------------------------------------------------------------
// Lifecycle helpers (for tests and server startup)
// ---------------------------------------------------------------------------

/**
 * Initialize the P-Sales database.
 * Call with a file path to use persistent storage, or omit in test environments
 * (auto-selects :memory: when VITEST or NODE_ENV=test is set).
 */
export function initPSalesDb(dbFilePath?: string): void {
  try {
    openDB(resolveDbPath(dbFilePath));
  } catch (error: unknown) {
    logError('psales_db', 'Failed to initialize P-Sales database');
    throw error;
  }
}

/** Close the database and reset state. Use in afterEach/afterAll for clean test teardown. */
export function closePSalesDb(): void {
  if (!state.db) return;
  state.db.close();
  state.db = null;
  state.path = null;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapPlan(row: StrategyPlanRow): StrategyPlanRecord {
  return {
    planId: row.plan_id,
    propertyType: row.property_type,
    location: row.location,
    estimatedValue: Number(row.estimated_value) || 0,
    approvalState: row.approval_state as ApprovalState,
    channels: JSON.parse(row.channels_json) as StrategyChannel[],
    targetSegments: JSON.parse(row.target_segments_json) as string[],
    approvalSteps: JSON.parse(row.approval_steps_json) as string[],
    summary: row.summary,
    generatedAt: row.generated_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    resumeToken: row.resume_token,
    pausedAt: row.paused_at,
    pauseReason: row.pause_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditEvent(row: AuditEventRow): PSalesAuditEvent {
  return {
    id: row.id,
    planId: row.plan_id,
    eventType: row.event_type,
    actor: row.actor,
    note: row.note,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Plan CRUD
// ---------------------------------------------------------------------------

/**
 * Persist a newly generated strategy plan.
 * Idempotent: uses INSERT OR REPLACE (planId is the PK).
 */
export function insertStrategyPlan(plan: Omit<StrategyPlanRecord, 'decidedAt' | 'decidedBy' | 'resumeToken' | 'pausedAt' | 'pauseReason' | 'createdAt' | 'updatedAt'>): StrategyPlanRecord {
  const db = ensureDB();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO psales_strategy_plans
      (plan_id, property_type, location, estimated_value, approval_state,
       channels_json, target_segments_json, approval_steps_json, summary, generated_at,
       decided_at, decided_by, resume_token, paused_at, pause_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
    ON CONFLICT(plan_id) DO NOTHING
  `).run(
    plan.planId,
    plan.propertyType,
    plan.location,
    plan.estimatedValue,
    plan.approvalState,
    JSON.stringify(plan.channels),
    JSON.stringify(plan.targetSegments),
    JSON.stringify(plan.approvalSteps),
    plan.summary,
    plan.generatedAt,
    now,
    now,
  );

  const row = db
    .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
    .get(plan.planId) as StrategyPlanRow;

  return mapPlan(row);
}

/** Retrieve a plan by ID, or null if not found. */
export function getStrategyPlan(planId: string): StrategyPlanRecord | null {
  const db = ensureDB();
  const row = db
    .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
    .get(planId) as StrategyPlanRow | undefined;
  return row ? mapPlan(row) : null;
}

/** List plans, optionally filtered by approval state, with a row limit. */
export function listStrategyPlans(
  limit = 50,
  approvalState?: ApprovalState | string,
): StrategyPlanRecord[] {
  const db = ensureDB();
  let rows: StrategyPlanRow[];
  if (approvalState) {
    rows = db
      .prepare('SELECT * FROM psales_strategy_plans WHERE approval_state = ? ORDER BY generated_at DESC LIMIT ?')
      .all(approvalState, limit) as StrategyPlanRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM psales_strategy_plans ORDER BY generated_at DESC LIMIT ?')
      .all(limit) as StrategyPlanRow[];
  }
  return rows.map(mapPlan);
}

// ---------------------------------------------------------------------------
// Approval / Rejection
// ---------------------------------------------------------------------------

/**
 * Update a plan's approval state to 'approved' or 'rejected'.
 * Records decidedAt and optionally decidedBy.
 */
export function updatePlanApprovalState(
  planId: string,
  newState: 'approved' | 'rejected',
  options: { actor?: string } = {},
): StrategyPlanRecord | null {
  const db = ensureDB();
  const now = new Date().toISOString();

  const changes = db.prepare(`
    UPDATE psales_strategy_plans
    SET approval_state = ?, decided_at = ?, decided_by = ?, updated_at = ?
    WHERE plan_id = ? AND approval_state IN ('pending', 'paused')
  `).run(newState, now, options.actor ?? null, now, planId);

  if (changes.changes === 0) {
    // Maybe already decided or not found — re-fetch to distinguish
    const existing = db
      .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
      .get(planId) as StrategyPlanRow | undefined;
    return existing ? mapPlan(existing) : null;
  }

  const row = db
    .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
    .get(planId) as StrategyPlanRow;
  return mapPlan(row);
}

// ---------------------------------------------------------------------------
// Pause / Resume (human-in-loop gates)
// ---------------------------------------------------------------------------

/**
 * Pause an active/pending plan, generating a unique resumeToken for webhook callback.
 */
export function pauseStrategyPlan(
  planId: string,
  options: { reason?: string; actor?: string } = {},
): StrategyPlanRecord | null {
  const db = ensureDB();
  const now = new Date().toISOString();
  const token = randomUUID();

  const changes = db.prepare(`
    UPDATE psales_strategy_plans
    SET approval_state = 'paused', paused_at = ?, pause_reason = ?,
        resume_token = ?, updated_at = ?
    WHERE plan_id = ? AND approval_state = 'pending'
  `).run(now, options.reason ?? null, token, now, planId);

  if (changes.changes === 0) {
    const existing = db
      .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
      .get(planId) as StrategyPlanRow | undefined;
    return existing ? mapPlan(existing) : null;
  }

  const row = db
    .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
    .get(planId) as StrategyPlanRow;
  return mapPlan(row);
}

/**
 * Resume a paused plan.
 * Accepts planId directly (dashboard usage) or resumeToken (webhook usage).
 */
export function resumeStrategyPlan(
  identifier: { planId?: string; resumeToken?: string },
  options: { actor?: string; note?: string } = {},
): StrategyPlanRecord | null {
  const db = ensureDB();
  const now = new Date().toISOString();

  const whereClause = identifier.resumeToken
    ? 'resume_token = ? AND approval_state = \'paused\''
    : 'plan_id = ? AND approval_state = \'paused\'';
  const whereValue = identifier.resumeToken ?? identifier.planId;

  if (!whereValue) return null;

  const changes = db.prepare(`
    UPDATE psales_strategy_plans
    SET approval_state = 'pending', paused_at = NULL, pause_reason = NULL,
        resume_token = NULL, updated_at = ?
    WHERE ${whereClause}
  `).run(now, whereValue);

  if (changes.changes === 0) {
    return null;
  }

  // Retrieve updated record — need to find it without the token (now cleared)
  let row: StrategyPlanRow | undefined;
  if (identifier.planId) {
    row = db
      .prepare('SELECT * FROM psales_strategy_plans WHERE plan_id = ?')
      .get(identifier.planId) as StrategyPlanRow | undefined;
  } else {
    // token was cleared; find by updated_at which we just set
    row = db
      .prepare('SELECT * FROM psales_strategy_plans WHERE updated_at = ? ORDER BY rowid DESC LIMIT 1')
      .get(now) as StrategyPlanRow | undefined;
  }

  return row ? mapPlan(row) : null;
}

// ---------------------------------------------------------------------------
// Audit Events
// ---------------------------------------------------------------------------

/**
 * Insert an audit event for a plan (fire-and-forget, synchronous).
 */
export function insertPSalesAuditEvent(
  planId: string,
  eventType: string,
  options: { actor?: string; note?: string; payload?: Record<string, unknown> } = {},
): void {
  try {
    const db = ensureDB();
    db.prepare(`
      INSERT INTO psales_audit_events (plan_id, event_type, actor, note, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      planId,
      eventType,
      options.actor ?? null,
      options.note ?? null,
      JSON.stringify(options.payload ?? {}),
    );
  } catch (error: unknown) {
    logError('psales_db', `Failed to insert audit event for plan ${planId}: ${String(error)}`);
    // Non-fatal: audit writes must not break the main flow
  }
}

/**
 * List audit events, optionally filtered by planId, newest first.
 */
export function listPSalesAuditEvents(
  limit = 50,
  options: { planId?: string } = {},
): PSalesAuditEvent[] {
  const db = ensureDB();
  let rows: AuditEventRow[];
  if (options.planId) {
    rows = db
      .prepare('SELECT * FROM psales_audit_events WHERE plan_id = ? ORDER BY id DESC LIMIT ?')
      .all(options.planId, limit) as AuditEventRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM psales_audit_events ORDER BY id DESC LIMIT ?')
      .all(limit) as AuditEventRow[];
  }
  return rows.map(mapAuditEvent);
}

// ---------------------------------------------------------------------------
// Summary / Weekly Status
// ---------------------------------------------------------------------------

/**
 * Build a weekly status summary with count breakdowns and recent audit events.
 */
export function getPSalesStatusSummary(recentAuditLimit = 20): PSalesStatusSummary {
  const db = ensureDB();

  const totalRow = db
    .prepare('SELECT COUNT(*) AS cnt FROM psales_strategy_plans')
    .get() as { cnt: number };

  const stateCounts = db
    .prepare(`
      SELECT approval_state, COUNT(*) AS cnt
      FROM psales_strategy_plans
      GROUP BY approval_state
    `)
    .all() as CountByStateRow[];

  const byState: PSalesStatusSummary['byApprovalState'] = {
    pending: 0,
    approved: 0,
    rejected: 0,
    paused: 0,
  };

  for (const row of stateCounts) {
    const s = row.approval_state as ApprovalState;
    if (s in byState) {
      byState[s] = row.cnt;
    }
  }

  const recentEvents = listPSalesAuditEvents(recentAuditLimit);

  return {
    generatedAt: new Date().toISOString(),
    totalPlans: totalRow.cnt,
    byApprovalState: byState,
    recentAuditEvents: recentEvents,
  };
}
