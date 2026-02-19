import * as cron from 'node-cron';
import Database from 'better-sqlite3';
import { logInfo, logError } from '../utils/logger.js';

interface ScheduledTaskRecord {
  id: string;
  task_name: string;
  cron_pattern: string;
  api_endpoint: string;
  method: 'GET' | 'POST';
  payload?: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
}

interface ScheduleResult {
  success: boolean;
  taskId?: string;
  message: string;
  nextRun?: string;
}

export class ScheduledTasksEngine {
  private db: Database.Database;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    logInfo('ScheduledTasksEngine', 'Initialized');
  }

  /**
   * Schedule a new task with cron pattern
   */
  scheduleTask(record: ScheduledTaskRecord): ScheduleResult {
    try {
      // Validate cron pattern
      if (!cron.validate(record.cron_pattern)) {
        return { success: false, message: 'Invalid cron pattern' };
      }

      // Create scheduled task
      const task = cron.schedule(record.cron_pattern, async () => {
        await this.executeTask(record);
      });

      // Store in memory
      this.tasks.set(record.id, task);

      // Calculate next run time
      const nextRun = `Scheduled for: ${record.cron_pattern}`;

      logInfo('ScheduledTasksEngine', `Task scheduled: ${record.task_name} → ${record.cron_pattern}`);

      return {
        success: true,
        taskId: record.id,
        message: `Task "${record.task_name}" scheduled`,
        nextRun,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ScheduledTasksEngine', error);
      return { success: false, message: error };
    }
  }

  /**
   * Execute a task (HTTP call to API endpoint)
   */
  private async executeTask(record: ScheduledTaskRecord): Promise<void> {
    try {
      const url = `http://localhost:3000${record.api_endpoint}`;
      const options: RequestInit = {
        method: record.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (record.method === 'POST' && record.payload) {
        options.body = record.payload;
      }

      const response = await fetch(url, options);
      const status = response.ok ? 'success' : 'failed';

      // Calculate actual next run from cron
      let nextRun = '';
      try {
        // Use dynamic import to avoid static import issues in non-Node environments (e.g. Workers build)
        const cronParser = await import('cron-parser');
        // Handle cron-parser v5 exports which might be wrapped or namespaced differently
        // In v5 CJS, default export is CronExpressionParser class which has static 'parse'
        const parser = cronParser.default;

        let interval;
        if (parser && typeof parser.parse === 'function') {
            interval = parser.parse(record.cron_pattern);
        } else if (cronParser.parseExpression) {
            // Check named export
            interval = cronParser.parseExpression(record.cron_pattern);
        } else if ((cronParser as any).CronExpressionParser && typeof (cronParser as any).CronExpressionParser.parse === 'function') {
            // Check nested named export
            interval = (cronParser as any).CronExpressionParser.parse(record.cron_pattern);
        }

        if (interval) {
             nextRun = interval.next().toDate().toISOString();
        } else {
             // If we can't parse, it might be that imports failed or structure is weird.
             // We fallback gracefully.
             logError('ScheduledTasksEngine', 'Could not resolve cron-parser method');
        }

      } catch (cronError) {
        logError('ScheduledTasksEngine', `Failed to calculate next run for ${record.task_name}: ${cronError}`);
      }

      if (nextRun) {
        // Update last_run in DB
        this.db.prepare(`
          UPDATE scheduled_tasks
          SET last_run = datetime('now'),
              next_run = datetime(?)
          WHERE id = ?
        `).run(nextRun, record.id);
      } else {
        // Fallback: If calculation failed, add 1 hour to avoid infinite loop
         this.db.prepare(`
          UPDATE scheduled_tasks
          SET last_run = datetime('now'),
              next_run = datetime(datetime('now'), '+3600s')
          WHERE id = ?
        `).run(record.id);
      }

      logInfo('ScheduledTasksEngine', `Task executed: ${record.task_name} → ${status} (${response.status})`);
    } catch (error) {
      logError('ScheduledTasksEngine', `Failed to execute ${record.task_name}: ${error}`);
    }
  }

  /**
   * Stop a scheduled task
   */
  stopTask(taskId: string): ScheduleResult {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        return { success: false, message: 'Task not found' };
      }

      task.stop();
      this.tasks.delete(taskId);

      // Mark as disabled in DB
      this.db.prepare('UPDATE scheduled_tasks SET enabled = 0 WHERE id = ?').run(taskId);

      logInfo('ScheduledTasksEngine', `Task stopped: ${taskId}`);
      return { success: true, message: 'Task stopped' };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, message: error };
    }
  }

  /**
   * Load all enabled tasks from DB and schedule them
   */
  loadScheduledTasks(): ScheduleResult {
    try {
      const tasks = this.db
        .prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1')
        .all() as ScheduledTaskRecord[];

      let scheduled = 0;
      for (const task of tasks) {
        const result = this.scheduleTask(task);
        if (result.success) scheduled++;
      }

      logInfo('ScheduledTasksEngine', `Loaded and scheduled ${scheduled}/${tasks.length} tasks`);
      return { success: true, message: `Scheduled ${scheduled} tasks` };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logError('ScheduledTasksEngine', error);
      return { success: false, message: error };
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks(): void {
    for (const [id, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
    logInfo('ScheduledTasksEngine', 'All tasks stopped');
  }

  /**
   * Get status of a task
   */
  getTaskStatus(taskId: string): any {
    const record = this.db
      .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
      .get(taskId) as ScheduledTaskRecord | undefined;

    if (!record) return null;

    return {
      ...record,
      isRunning: this.tasks.has(taskId),
    };
  }

  /**
   * Get all scheduled tasks with status
   */
  getAllTasks(): any[] {
    const records = this.db
      .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
      .all() as ScheduledTaskRecord[];

    return records.map((r) => ({
      ...r,
      isRunning: this.tasks.has(r.id),
    }));
  }
}

export default ScheduledTasksEngine;
