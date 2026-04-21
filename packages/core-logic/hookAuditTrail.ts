/**
 * Hook Audit Trail — SQLite-backed execution log for the hook pipeline.
 *
 * Stores every hook execution (fired/skipped/failed/timeout) in the
 * `hook_executions` table in data/brunella.db via getGlobalDb().
 *
 * Usage:
 *   recordHookExecution({ event: 'BeforeTool', status: 'fired', durationMs: 12 })
 *   getRecentExecutions({ event: 'BeforeTool', limit: 20 })
 *   getFailureStats()
 *
 * @version 1.0.0
 */

import { getGlobalDb } from '@packages/utils/globalDb.js';
import { logError, logInfo } from '@packages/utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type HookExecutionStatus = 'fired' | 'skipped' | 'failed' | 'timeout';

export interface HookExecutionRecord {
  id?: number;
  event: string;
  status: HookExecutionStatus;
  durationMs: number;
  error?: string;
  contextSummary?: string;
  timestamp?: string;
}

export interface RecentExecutionsQuery {
  event?: string;
  limit?: number;
}

export interface HookFailureStat {
  event: string;
  status: HookExecutionStatus;
  count: number;
}

// ============================================================================
// INTERNAL: RAW DB ROW
// ============================================================================

interface HookExecutionRow {
  id: number;
  event: string;
  status: HookExecutionStatus;
  duration_ms: number;
  error: string | null;
  context_summary: string | null;
  timestamp: string;
}

interface CountRow {
  event: string;
  status: HookExecutionStatus;
  count: number;
}

// ============================================================================
// SCHEMA INIT
// ============================================================================

let schemaInitialized = false;

function ensureSchema(): boolean {
  if (schemaInitialized) return true;
  try {
    const db = getGlobalDb();
    if (!db) return false;

    db.prepare(`
      CREATE TABLE IF NOT EXISTS hook_executions (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        event          TEXT    NOT NULL,
        status         TEXT    NOT NULL CHECK(status IN ('fired','skipped','failed','timeout')),
        duration_ms    INTEGER NOT NULL DEFAULT 0,
        error          TEXT,
        context_summary TEXT,
        timestamp      TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_hook_exec_event
        ON hook_executions(event)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_hook_exec_status
        ON hook_executions(status)
    `).run();

    schemaInitialized = true;
    logInfo('HookAuditTrail', 'Schema initialized: hook_executions');
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookAuditTrail', `Schema init failed: ${msg}`);
    return false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Record a single hook execution event to the audit trail.
 *
 * @param record - Execution record to persist
 */
export function recordHookExecution(record: HookExecutionRecord): void {
  if (!ensureSchema()) return;
  try {
    const db = getGlobalDb();
    if (!db) return;

    db.prepare(`
      INSERT INTO hook_executions (event, status, duration_ms, error, context_summary)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      record.event,
      record.status,
      record.durationMs,
      record.error ?? null,
      record.contextSummary ?? null,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookAuditTrail', `recordHookExecution failed: ${msg}`);
  }
}

/**
 * Retrieve recent hook execution records.
 *
 * @param query - Optional filter by event name and limit
 * @returns Array of HookExecutionRecord
 */
export function getRecentExecutions(
  query: RecentExecutionsQuery = {}
): HookExecutionRecord[] {
  if (!ensureSchema()) return [];
  try {
    const db = getGlobalDb();
    if (!db) return [];

    const limit = query.limit ?? 50;

    let rows: HookExecutionRow[];
    if (query.event) {
      rows = db
        .prepare(
          `SELECT id, event, status, duration_ms, error, context_summary, timestamp
           FROM hook_executions
           WHERE event = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(query.event, limit) as HookExecutionRow[];
    } else {
      rows = db
        .prepare(
          `SELECT id, event, status, duration_ms, error, context_summary, timestamp
           FROM hook_executions
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(limit) as HookExecutionRow[];
    }

    return rows.map((row) => ({
      id: row.id,
      event: row.event,
      status: row.status,
      durationMs: row.duration_ms,
      error: row.error ?? undefined,
      contextSummary: row.context_summary ?? undefined,
      timestamp: row.timestamp,
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookAuditTrail', `getRecentExecutions failed: ${msg}`);
    return [];
  }
}

/**
 * Get failure statistics grouped by event and status.
 *
 * @returns Array of { event, status, count }
 */
export function getFailureStats(): HookFailureStat[] {
  if (!ensureSchema()) return [];
  try {
    const db = getGlobalDb();
    if (!db) return [];

    const rows = db
      .prepare(
        `SELECT event, status, COUNT(*) as count
         FROM hook_executions
         WHERE status IN ('failed', 'timeout')
         GROUP BY event, status
         ORDER BY count DESC`
      )
      .all() as CountRow[];

    return rows.map((row) => ({
      event: row.event,
      status: row.status,
      count: row.count,
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookAuditTrail', `getFailureStats failed: ${msg}`);
    return [];
  }
}

