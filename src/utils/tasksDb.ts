import type Database from 'better-sqlite3';
import { safeJsonParse } from './aiHelpers.js';
import type { BackgroundTask, TaskCheckpoint, TaskStep } from './backgroundTaskManager.js';
import type { ExecutionPlan } from './llmPlanner.js';

let db: Database.Database | null = null;
let pathModule: typeof import('path') | null = null;
let fsModule: typeof import('fs') | null = null;

interface TaskRow {
  id: number;
  agent: string;
  task: string;
  status: string;
  context: string | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

interface CountRow {
  count: number;
}

interface TaskStatsRow {
  total: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  cancelledCount: number;
  avgDurationMs: number | null;
}

interface BackgroundTaskRow {
  id: string;
  instruction: string;
  plan: string;
  status: string;
  progress: number;
  started_at: number;
  completed_at: number | null;
  steps: string;
  current_step_index: number;
  error: string | null;
  checkpoints: string;
}

type BackgroundTaskUpdate = Pick<
  BackgroundTask,
  'id' | 'status' | 'progress' | 'completedAt' | 'steps' | 'currentStepIndex' | 'error' | 'checkpoints'
>;

function createDefaultExecutionPlan(): ExecutionPlan {
  return {
    plan: [],
    estimatedDuration: 0,
    backgroundEligible: false,
  };
}

function isBackgroundTaskStatus(status: string): status is BackgroundTask['status'] {
  return status === 'running' || status === 'completed' || status === 'error' || status === 'cancelled';
}

async function ensureDeps(): Promise<void> {
  if (typeof process !== 'undefined' && process.versions?.node) {
    if (!pathModule) pathModule = await import('path');
    if (!fsModule) fsModule = await import('fs');
  }
}

async function getDb(): Promise<Database.Database | null> {
  if (db) return db;

  await ensureDeps();
  if (!pathModule || !fsModule) return null;

  const dbPath = pathModule.join(process.cwd(), 'data', 'tasks.db');

  if (!fsModule.existsSync(pathModule.dirname(dbPath))) {
    fsModule.mkdirSync(pathModule.dirname(dbPath), { recursive: true });
  }

  const { default: DatabaseConstructor } = await import('better-sqlite3');
  db = new DatabaseConstructor(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT,
      task TEXT,
      status TEXT DEFAULT 'pending',
      context TEXT,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS robotkez_background_tasks (
      id TEXT PRIMARY KEY,
      instruction TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      steps TEXT,
      current_step_index INTEGER DEFAULT 0,
      error TEXT,
      checkpoints TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_robotkez_status
    ON robotkez_background_tasks(status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_robotkez_started_at
    ON robotkez_background_tasks(started_at DESC)
  `);

  return db;
}

function mapBackgroundTaskRow(row: BackgroundTaskRow): BackgroundTask {
  return {
    id: row.id,
    instruction: row.instruction,
    plan: safeJsonParse<ExecutionPlan>(row.plan, createDefaultExecutionPlan()),
    status: isBackgroundTaskStatus(row.status) ? row.status : 'error',
    progress: row.progress,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    steps: safeJsonParse<TaskStep[]>(row.steps, []),
    currentStepIndex: row.current_step_index,
    error: row.error ?? undefined,
    checkpoints: safeJsonParse<TaskCheckpoint[]>(row.checkpoints, []),
  };
}

export async function initTasksDb(): Promise<void> {
  await getDb();
}

export async function saveTask(task: { agent: string; task: string; context?: string | null }): Promise<number | bigint | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<[string, string, string | null], unknown>(
    'INSERT INTO tasks (agent, task, context) VALUES (?, ?, ?)',
  );
  const result = stmt.run(task.agent, task.task, task.context ?? null);
  return result.lastInsertRowid;
}

export async function updateTaskStatus(id: number | bigint, status: string, result?: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const completedAt = ['done', 'error', 'cancelled'].includes(status) ? new Date().toISOString() : null;
  const stmt = database.prepare<[string, string | null, string | null, number | bigint], unknown>(
    'UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?',
  );
  stmt.run(status, result ?? null, completedAt, id);
}

/**
 * Loads unfinished tasks (pending + running) for queue rehydration on startup.
 * Running tasks are reset to pending by the caller after recovery.
 */
export async function loadQueuedTasksForHydration(): Promise<TaskRow[]> {
  const database = await getDb();
  if (!database) return [];

  const stmt = database.prepare<[], TaskRow>(
    "SELECT * FROM tasks WHERE status IN ('pending', 'running') ORDER BY id ASC",
  );
  return stmt.all();
}

export async function getTasks(limit: number = 20, offset: number = 0, status?: string): Promise<TaskRow[]> {
  const database = await getDb();
  if (!database) return [];

  if (status) {
    const stmt = database.prepare<[string, number, number], TaskRow>(
      'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    );
    return stmt.all(status, limit, offset);
  }

  const stmt = database.prepare<[number, number], TaskRow>(
    'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?',
  );
  return stmt.all(limit, offset);
}

export async function getTaskCount(status?: string): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  if (status) {
    const stmt = database.prepare<[string], CountRow>('SELECT COUNT(*) as count FROM tasks WHERE status = ?');
    const row = stmt.get(status) ?? { count: 0 };
    return row.count;
  }

  const stmt = database.prepare<[], CountRow>('SELECT COUNT(*) as count FROM tasks');
  const row = stmt.get() ?? { count: 0 };
  return row.count;
}

export async function getTaskById(id: number): Promise<TaskRow | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?');
  return stmt.get(id) ?? null;
}

export async function getTaskStats(): Promise<{
  total: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
  failedByAgent: Array<{ agent: string; count: number }>;
}> {
  const database = await getDb();
  if (!database) {
    return {
      total: 0,
      successCount: 0,
      errorCount: 0,
      pendingCount: 0,
      runningCount: 0,
      cancelledCount: 0,
      successRate: 0,
      avgDurationMs: 0,
      failedByAgent: [],
    };
  }

  const counts = database.prepare<[], TaskStatsRow>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as successCount,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as runningCount,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledCount,
      AVG(CASE WHEN completed_at IS NOT NULL THEN (julianday(completed_at) - julianday(created_at)) * 86400000 ELSE NULL END) as avgDurationMs
    FROM tasks
  `).get() ?? {
    total: 0,
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
    runningCount: 0,
    cancelledCount: 0,
    avgDurationMs: 0,
  };

  const failedByAgent = database.prepare<[], { agent: string; count: number }>(`
    SELECT agent, COUNT(*) as count
    FROM tasks
    WHERE status = 'error'
    GROUP BY agent
    ORDER BY count DESC
  `).all();

  const total = counts.total ?? 0;
  const successCount = counts.successCount ?? 0;
  const errorCount = counts.errorCount ?? 0;
  const successRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

  return {
    total,
    successCount,
    errorCount,
    pendingCount: counts.pendingCount ?? 0,
    runningCount: counts.runningCount ?? 0,
    cancelledCount: counts.cancelledCount ?? 0,
    successRate,
    avgDurationMs: Math.round(counts.avgDurationMs ?? 0),
    failedByAgent,
  };
}

// ============================================================
// RobotkezV2 Background Tasks Persistence (Phase 4.2)
// ============================================================

/**
 * Save a new background task to database.
 *
 * @param task - Background task state to persist.
 */
export async function saveBackgroundTask(task: BackgroundTask): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<
    [string, string, string, string, number, number, number | null, string, number, string | null, string],
    unknown
  >(`
    INSERT INTO robotkez_background_tasks (
      id, instruction, plan, status, progress, started_at, completed_at,
      steps, current_step_index, error, checkpoints
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    task.id,
    task.instruction,
    JSON.stringify(task.plan),
    task.status,
    task.progress,
    task.startedAt,
    task.completedAt ?? null,
    JSON.stringify(task.steps),
    task.currentStepIndex,
    task.error ?? null,
    JSON.stringify(task.checkpoints),
  );
}

/**
 * Update an existing background task.
 *
 * @param task - Background task fields to persist.
 */
export async function updateBackgroundTask(task: BackgroundTaskUpdate): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<
    [string, number, number | null, string, number, string | null, string, string],
    unknown
  >(`
    UPDATE robotkez_background_tasks
    SET status = ?, progress = ?, completed_at = ?, steps = ?,
        current_step_index = ?, error = ?, checkpoints = ?
    WHERE id = ?
  `);

  stmt.run(
    task.status,
    task.progress,
    task.completedAt ?? null,
    JSON.stringify(task.steps),
    task.currentStepIndex,
    task.error ?? null,
    JSON.stringify(task.checkpoints),
    task.id,
  );
}

/**
 * Load a background task by ID.
 *
 * @param id - Task ID.
 * @returns The persisted background task or null.
 */
export async function loadBackgroundTask(id: string): Promise<BackgroundTask | null> {
  const database = await getDb();
  if (!database) return null;

  const stmt = database.prepare<[string], BackgroundTaskRow>('SELECT * FROM robotkez_background_tasks WHERE id = ?');
  const row = stmt.get(id);

  return row ? mapBackgroundTaskRow(row) : null;
}

/**
 * Load all background tasks, optionally filtered by status.
 *
 * @param limit - Maximum number of tasks to return.
 * @param status - Optional status filter.
 * @returns Persisted background tasks.
 */
export async function loadAllBackgroundTasks(limit: number = 50, status?: string): Promise<BackgroundTask[]> {
  const database = await getDb();
  if (!database) return [];

  if (status) {
    const stmt = database.prepare<[string, number], BackgroundTaskRow>(
      'SELECT * FROM robotkez_background_tasks WHERE status = ? ORDER BY started_at DESC LIMIT ?',
    );
    return stmt.all(status, limit).map(mapBackgroundTaskRow);
  }

  const stmt = database.prepare<[number], BackgroundTaskRow>(
    'SELECT * FROM robotkez_background_tasks ORDER BY started_at DESC LIMIT ?',
  );
  return stmt.all(limit).map(mapBackgroundTaskRow);
}

/**
 * Delete a background task by ID.
 *
 * @param id - Task ID.
 */
export async function deleteBackgroundTask(id: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const stmt = database.prepare<[string], unknown>('DELETE FROM robotkez_background_tasks WHERE id = ?');
  stmt.run(id);
}

/**
 * Get background task statistics.
 *
 * @returns Stats object.
 */
export async function getBackgroundTaskStats(): Promise<{
  total: number;
  running: number;
  completed: number;
  error: number;
  cancelled: number;
  avgProgress: number;
}> {
  const database = await getDb();
  if (!database) {
    return { total: 0, running: 0, completed: 0, error: 0, cancelled: 0, avgProgress: 0 };
  }

  const counts = database.prepare<[], {
    total: number;
    running: number;
    completed: number;
    error: number;
    cancelled: number;
    avgProgress: number | null;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      AVG(progress) as avgProgress
    FROM robotkez_background_tasks
  `).get() ?? {
    total: 0,
    running: 0,
    completed: 0,
    error: 0,
    cancelled: 0,
    avgProgress: 0,
  };

  return {
    total: counts.total,
    running: counts.running,
    completed: counts.completed,
    error: counts.error,
    cancelled: counts.cancelled,
    avgProgress: Math.round(counts.avgProgress ?? 0),
  };
}
