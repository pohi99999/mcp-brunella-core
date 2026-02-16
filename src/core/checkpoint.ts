/**
 * Checkpoint System — Gold Protocol Phoenix (RULE-PH1, RULE-PH5)
 *
 * Partial-task state persistence via SQLite.
 * Enables resume-from-last-success after agent failure.
 *
 * Non-functional: < 5 ms per save (SQLite WAL mode).
 *
 * @version 1.0.0
 */

import { logInfo, logError } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Checkpoint {
  id?: number;
  taskId: string;
  stepIndex: number;
  stepName: string;
  stateJson: string;
  createdAt?: string;
}

export interface CheckpointState {
  /** Arbitrary agent-defined state blob */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// DATABASE (lazy singleton)
// ---------------------------------------------------------------------------

let db: any = null;

async function getDb(): Promise<any> {
  if (db) return db;

  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }

  const path = await import('path');
  const fs = await import('fs');

  const dbDir = path.default.join(process.cwd(), 'data');
  if (!fs.default.existsSync(dbDir)) {
    fs.default.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.default.join(dbDir, 'checkpoints.db');
  const Database = (await import('better-sqlite3')).default;
  db = new Database(dbPath);

  // WAL mode for concurrent reads + low-latency writes (spec: < 5ms)
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id ON checkpoints(task_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_task_step ON checkpoints(task_id, step_index);
  `);

  logInfo('Checkpoint', 'Database initialized (WAL mode)');
  return db;
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Save a checkpoint after a successful sub-step (RULE-PH1).
 */
export async function saveCheckpoint(
  taskId: string,
  stepIndex: number,
  stepName: string,
  state: CheckpointState
): Promise<number | null> {
  try {
    const database = await getDb();
    if (!database) return null;

    const stateJson = JSON.stringify(state);
    const stmt = database.prepare(
      'INSERT INTO checkpoints (task_id, step_index, step_name, state_json) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(taskId, stepIndex, stepName, stateJson);

    logInfo('Checkpoint', `Saved: task=${taskId} step=${stepIndex} (${stepName})`);
    return result.lastInsertRowid as number;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `Save failed: ${msg}`);
    return null;
  }
}

/**
 * Load the latest checkpoint for a task (RULE-PH5).
 * Returns the checkpoint with the highest step_index.
 */
export async function loadCheckpoint(taskId: string): Promise<Checkpoint | null> {
  try {
    const database = await getDb();
    if (!database) return null;

    const stmt = database.prepare(
      'SELECT * FROM checkpoints WHERE task_id = ? ORDER BY step_index DESC LIMIT 1'
    );
    const row = stmt.get(taskId) as any;

    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      stepIndex: row.step_index,
      stepName: row.step_name,
      stateJson: row.state_json,
      createdAt: row.created_at
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `Load failed: ${msg}`);
    return null;
  }
}

/**
 * Load all checkpoints for a task, ordered by step_index ascending.
 */
export async function loadAllCheckpoints(taskId: string): Promise<Checkpoint[]> {
  try {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare(
      'SELECT * FROM checkpoints WHERE task_id = ? ORDER BY step_index ASC'
    );
    const rows = stmt.all(taskId) as any[];

    return rows.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      stepIndex: row.step_index,
      stepName: row.step_name,
      stateJson: row.state_json,
      createdAt: row.created_at
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `LoadAll failed: ${msg}`);
    return [];
  }
}

/**
 * Clear all checkpoints for a completed task.
 */
export async function clearCheckpoints(taskId: string): Promise<boolean> {
  try {
    const database = await getDb();
    if (!database) return false;

    const stmt = database.prepare('DELETE FROM checkpoints WHERE task_id = ?');
    const result = stmt.run(taskId);

    logInfo('Checkpoint', `Cleared ${result.changes} checkpoints for task=${taskId}`);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `Clear failed: ${msg}`);
    return false;
  }
}

/**
 * List active checkpoints (latest per task).
 * Useful for dashboard /api/phoenix/checkpoints endpoint.
 */
export async function listActiveCheckpoints(): Promise<Checkpoint[]> {
  try {
    const database = await getDb();
    if (!database) return [];

    const stmt = database.prepare(`
      SELECT c.* FROM checkpoints c
      INNER JOIN (
        SELECT task_id, MAX(step_index) as max_step
        FROM checkpoints
        GROUP BY task_id
      ) latest ON c.task_id = latest.task_id AND c.step_index = latest.max_step
      ORDER BY c.created_at DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      stepIndex: row.step_index,
      stepName: row.step_name,
      stateJson: row.state_json,
      createdAt: row.created_at
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `ListActive failed: ${msg}`);
    return [];
  }
}

/**
 * Get checkpoint database stats.
 */
export async function getCheckpointStats(): Promise<{
  totalCheckpoints: number;
  activeTasks: number;
}> {
  try {
    const database = await getDb();
    if (!database) return { totalCheckpoints: 0, activeTasks: 0 };

    const total = database.prepare('SELECT COUNT(*) as count FROM checkpoints').get() as any;
    const tasks = database.prepare('SELECT COUNT(DISTINCT task_id) as count FROM checkpoints').get() as any;

    return {
      totalCheckpoints: total?.count || 0,
      activeTasks: tasks?.count || 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `Stats failed: ${msg}`);
    return { totalCheckpoints: 0, activeTasks: 0 };
  }
}

/**
 * Clean up old checkpoints (retention policy: 7 days).
 * Deletes checkpoints older than the specified number of days.
 */
export async function cleanupOldCheckpoints(retentionDays: number = 7): Promise<number> {
  try {
    const database = await getDb();
    if (!database) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    const stmt = database.prepare('DELETE FROM checkpoints WHERE created_at < ?');
    const result = stmt.run(cutoffIso);

    const deleted = result.changes || 0;
    if (deleted > 0) {
      logInfo('Checkpoint', `Cleaned up ${deleted} checkpoints older than ${retentionDays} days`);
    }

    return deleted;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `Cleanup failed: ${msg}`);
    return 0;
  }
}

/**
 * Start automatic checkpoint cleanup (daily at 3 AM).
 * Returns cleanup interval handle.
 */
export function startAutomaticCleanup(retentionDays: number = 7): NodeJS.Timeout {
  const DAILY_MS = 24 * 60 * 60 * 1000;

  logInfo('Checkpoint', `Starting automatic cleanup (retention: ${retentionDays} days)`);

  // Run cleanup immediately
  cleanupOldCheckpoints(retentionDays);

  // Schedule daily cleanup
  return setInterval(() => {
    cleanupOldCheckpoints(retentionDays);
  }, DAILY_MS);
}

/**
 * Clear ALL checkpoints (for testing purposes only).
 * WARNING: This deletes all checkpoint data!
 */
export async function clearAllCheckpoints(): Promise<number> {
  try {
    const database = await getDb();
    if (!database) return 0;

    const stmt = database.prepare('DELETE FROM checkpoints');
    const result = stmt.run();

    const deleted = result.changes || 0;
    if (deleted > 0) {
      logInfo('Checkpoint', `Cleared ALL ${deleted} checkpoints`);
    }

    return deleted;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logError('Checkpoint', `ClearAll failed: ${msg}`);
    return 0;
  }
}

/** Close checkpoint database (for tests / graceful shutdown). */
export async function closeCheckpointDb(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}
