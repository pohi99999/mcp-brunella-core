import Database from 'better-sqlite3';
import path from 'path';
import { safeJsonParse } from './aiHelpers.js';
import { ensureError } from './ensureError.js';
import { logError } from './logger.js';
import type { BackgroundTask, TaskCheckpoint, TaskStep } from './backgroundTaskManager.js';
import type { ExecutionPlan } from './llmPlanner.js';

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

export class TasksDatabaseManager {
  private db: Database.Database | null = null;
  private pathModule: typeof import('path') | null = null;
  private fsModule: typeof import('fs') | null = null;

  constructor(private readonly dbPath: string = path.join(process.cwd(), 'data', 'tasks.db')) {}

  async getDb(): Promise<Database.Database | null> {
    if (this.db) return this.db;

    await this.ensureDeps();
    if (!this.pathModule || !this.fsModule) return null;

    const dir = this.pathModule.dirname(this.dbPath);
    if (!this.fsModule.existsSync(dir)) {
      this.fsModule.mkdirSync(dir, { recursive: true });
    }

    const { default: DatabaseConstructor } = await import('better-sqlite3');
    this.db = new DatabaseConstructor(this.dbPath);

    this.db.exec(`
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

    this.db.exec(`
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

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_robotkez_status
      ON robotkez_background_tasks(status)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_robotkez_started_at
      ON robotkez_background_tasks(started_at DESC)
    `);

    return this.db;
  }

  async open(): Promise<Database.Database | null> {
    return this.getDb();
  }

  close(): void {
    if (!this.db) return;

    try {
      this.db.close();
    } catch (error: unknown) {
      logError('TasksDb', `Failed to close SQLite database: ${ensureError(error).message}`);
    } finally {
      this.db = null;
    }
  }

  async saveTask(task: { agent: string; task: string; context?: string | null }): Promise<number | bigint | null> {
    const database = await this.getDb();
    if (!database) return null;

    const stmt = database.prepare<[string, string, string | null], unknown>(
      'INSERT INTO tasks (agent, task, context) VALUES (?, ?, ?)',
    );
    const result = stmt.run(task.agent, task.task, task.context ?? null);
    return result.lastInsertRowid;
  }

  async updateTaskStatus(id: number | bigint, status: string, result?: string): Promise<void> {
    const database = await this.getDb();
    if (!database) return;

    const completedAt = ['done', 'error', 'cancelled'].includes(status) ? new Date().toISOString() : null;
    const stmt = database.prepare<[string, string | null, string | null, number | bigint], unknown>(
      'UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?',
    );
    stmt.run(status, result ?? null, completedAt, id);
  }

  async loadQueuedTasksForHydration(): Promise<TaskRow[]> {
    const database = await this.getDb();
    if (!database) return [];

    const stmt = database.prepare<[], TaskRow>(
      "SELECT * FROM tasks WHERE status IN ('pending', 'running') ORDER BY id ASC",
    );
    return stmt.all();
  }

  async getTasks(limit: number = 20, offset: number = 0, status?: string): Promise<TaskRow[]> {
    const database = await this.getDb();
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

  async getTaskCount(status?: string): Promise<number> {
    const database = await this.getDb();
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

  async getTaskById(id: number): Promise<TaskRow | null> {
    const database = await this.getDb();
    if (!database) return null;

    const stmt = database.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?');
    return stmt.get(id) ?? null;
  }

  async getTaskStats(): Promise<{
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
    const database = await this.getDb();
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

  async saveBackgroundTask(task: BackgroundTask): Promise<void> {
    const database = await this.getDb();
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

  async updateBackgroundTask(task: BackgroundTaskUpdate): Promise<void> {
    const database = await this.getDb();
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

  async loadBackgroundTask(id: string): Promise<BackgroundTask | null> {
    const database = await this.getDb();
    if (!database) return null;

    const stmt = database.prepare<[string], BackgroundTaskRow>('SELECT * FROM robotkez_background_tasks WHERE id = ?');
    const row = stmt.get(id);

    return row ? this.mapBackgroundTaskRow(row) : null;
  }

  async loadAllBackgroundTasks(limit: number = 50, status?: string): Promise<BackgroundTask[]> {
    const database = await this.getDb();
    if (!database) return [];

    if (status) {
      const stmt = database.prepare<[string, number], BackgroundTaskRow>(
        'SELECT * FROM robotkez_background_tasks WHERE status = ? ORDER BY started_at DESC LIMIT ?',
      );
      return stmt.all(status, limit).map((row) => this.mapBackgroundTaskRow(row));
    }

    const stmt = database.prepare<[number], BackgroundTaskRow>(
      'SELECT * FROM robotkez_background_tasks ORDER BY started_at DESC LIMIT ?',
    );
    return stmt.all(limit).map((row) => this.mapBackgroundTaskRow(row));
  }

  async deleteBackgroundTask(id: string): Promise<void> {
    const database = await this.getDb();
    if (!database) return;

    const stmt = database.prepare<[string], unknown>('DELETE FROM robotkez_background_tasks WHERE id = ?');
    stmt.run(id);
  }

  async getBackgroundTaskStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    error: number;
    cancelled: number;
    avgProgress: number;
  }> {
    const database = await this.getDb();
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

  private async ensureDeps(): Promise<void> {
    if (typeof process !== 'undefined' && process.versions?.node) {
      if (!this.pathModule) this.pathModule = await import('path');
      if (!this.fsModule) this.fsModule = await import('fs');
    }
  }

  private mapBackgroundTaskRow(row: BackgroundTaskRow): BackgroundTask {
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
}

export const defaultTasksDatabaseManager = new TasksDatabaseManager();
