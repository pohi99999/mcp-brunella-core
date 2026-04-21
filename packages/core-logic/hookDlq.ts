/**
 * Hook Dead Letter Queue (DLQ) — SQLite-backed retry queue for failed hooks.
 *
 * When a hook handler fails and is configured with retryOnFail=true,
 * the failed invocation is stored here with exponential backoff scheduling.
 *
 * Backoff formula (base=60s, factor=5):
 *   attempt 1 → 60s
 *   attempt 2 → 300s
 *   attempt 3 → 1500s
 *   attempt 4 → 7500s
 *   attempt 5 → 37500s (max, then permanently failed)
 *
 * @version 1.0.0
 */

import { getGlobalDb } from '@packages/utils/globalDb.js';
import { logError, logInfo } from '@packages/utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DlqEntry {
  id?: number;
  event: string;
  contextJson: string;
  reason: string;
  attempts: number;
  nextRetryAt: number;
  createdAt: number;
}

export interface DlqRow {
  id: number;
  event: string;
  context_json: string;
  reason: string;
  attempts: number;
  next_retry_at: number;
  created_at: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DLQ_MAX_ATTEMPTS = 5;
const DLQ_BASE_DELAY_S = 60;
const DLQ_BACKOFF_FACTOR = 5;

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
      CREATE TABLE IF NOT EXISTS hook_dlq (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        event         TEXT    NOT NULL,
        context_json  TEXT    NOT NULL DEFAULT '{}',
        reason        TEXT    NOT NULL,
        attempts      INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER NOT NULL,
        created_at    INTEGER NOT NULL
      )
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_dlq_next_retry
        ON hook_dlq(next_retry_at)
    `).run();

    schemaInitialized = true;
    logInfo('HookDlq', 'Schema initialized: hook_dlq');
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `Schema init failed: ${msg}`);
    return false;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate next retry timestamp (epoch ms) given attempt count.
 * Formula: now + base * factor^attempts * 1000
 *
 * @param attempts - Number of attempts already made (0-based)
 * @returns Epoch milliseconds of next retry
 */
function calculateNextRetry(attempts: number): number {
  const delaySec = DLQ_BASE_DELAY_S * Math.pow(DLQ_BACKOFF_FACTOR, attempts);
  return Date.now() + delaySec * 1000;
}

function mapRow(row: DlqRow): DlqEntry {
  return {
    id: row.id,
    event: row.event,
    contextJson: row.context_json,
    reason: row.reason,
    attempts: row.attempts,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Push a failed hook invocation onto the DLQ.
 *
 * @param event       - Hook name (e.g. 'BeforeTool')
 * @param context     - Original context payload (will be JSON-serialized)
 * @param reason      - Reason for failure
 */
export function pushToDlq(
  event: string,
  context: unknown,
  reason: string
): void {
  if (!ensureSchema()) return;
  try {
    const db = getGlobalDb();
    if (!db) return;

    const now = Date.now();
    const contextJson = JSON.stringify(context ?? {});

    db.prepare(`
      INSERT INTO hook_dlq (event, context_json, reason, attempts, next_retry_at, created_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(event, contextJson, reason, calculateNextRetry(0), now);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `pushToDlq failed: ${msg}`);
  }
}

/**
 * List all DLQ entries.
 *
 * @returns Array of DlqEntry
 */
export function listDlqEntries(): DlqEntry[] {
  if (!ensureSchema()) return [];
  try {
    const db = getGlobalDb();
    if (!db) return [];

    const rows = db
      .prepare(
        `SELECT id, event, context_json, reason, attempts, next_retry_at, created_at
         FROM hook_dlq
         ORDER BY created_at DESC`
      )
      .all() as DlqRow[];

    return rows.map(mapRow);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `listDlqEntries failed: ${msg}`);
    return [];
  }
}

/**
 * Get the count of DLQ entries that are ready for retry (nextRetryAt <= now).
 *
 * @returns Number of retryable entries
 */
export function getRetryableCount(): number {
  if (!ensureSchema()) return 0;
  try {
    const db = getGlobalDb();
    if (!db) return 0;

    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM hook_dlq WHERE next_retry_at <= ? AND attempts < ?`
      )
      .get(Date.now(), DLQ_MAX_ATTEMPTS) as { count: number } | undefined;

    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Process the DLQ: for each retryable entry, invoke the provided retry function.
 * On success: remove from DLQ.
 * On failure: increment attempts and reschedule, or delete if max attempts reached.
 *
 * @param retryFn - Async function receiving (event, context). Should throw on failure.
 */
export async function processDlqQueue(
  retryFn: (event: string, context: unknown) => Promise<void>
): Promise<void> {
  if (!ensureSchema()) return;
  try {
    const db = getGlobalDb();
    if (!db) return;

    const now = Date.now();
    const rows = db
      .prepare(
        `SELECT id, event, context_json, reason, attempts, next_retry_at, created_at
         FROM hook_dlq
         WHERE next_retry_at <= ? AND attempts < ?
         ORDER BY created_at ASC`
      )
      .all(now, DLQ_MAX_ATTEMPTS) as DlqRow[];

    for (const row of rows) {
      let context: unknown;
      try {
        context = JSON.parse(row.context_json);
      } catch {
        context = {};
      }

      try {
        await retryFn(row.event, context);
        // Success: remove from DLQ
        db.prepare(`DELETE FROM hook_dlq WHERE id = ?`).run(row.id);
        logInfo('HookDlq', `Retry succeeded for entry ${row.id} (${row.event})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const newAttempts = row.attempts + 1;

        if (newAttempts >= DLQ_MAX_ATTEMPTS) {
          db.prepare(`DELETE FROM hook_dlq WHERE id = ?`).run(row.id);
          logError('HookDlq', `Max attempts reached for entry ${row.id} (${row.event}): ${msg}`);
        } else {
          const nextRetry = calculateNextRetry(newAttempts);
          db.prepare(
            `UPDATE hook_dlq SET attempts = ?, next_retry_at = ?, reason = ? WHERE id = ?`
          ).run(newAttempts, nextRetry, msg, row.id);
          logInfo('HookDlq', `Retry failed for entry ${row.id} (${row.event}), attempt ${newAttempts}/${DLQ_MAX_ATTEMPTS}`);
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `processDlqQueue failed: ${msg}`);
  }
}

/**
 * Reset all DLQ entries so they are immediately eligible for retry.
 */
export function retryAllDlq(): void {
  if (!ensureSchema()) return;
  try {
    const db = getGlobalDb();
    if (!db) return;

    db.prepare(`UPDATE hook_dlq SET next_retry_at = ?, attempts = 0`).run(Date.now());
    logInfo('HookDlq', 'All DLQ entries reset for immediate retry');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `retryAllDlq failed: ${msg}`);
  }
}

/**
 * Delete all entries from the DLQ.
 */
export function clearDlq(): void {
  if (!ensureSchema()) return;
  try {
    const db = getGlobalDb();
    if (!db) return;

    const result = db.prepare(`DELETE FROM hook_dlq`).run();
    logInfo('HookDlq', `DLQ cleared: ${result.changes} entries removed`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookDlq', `clearDlq failed: ${msg}`);
  }
}

