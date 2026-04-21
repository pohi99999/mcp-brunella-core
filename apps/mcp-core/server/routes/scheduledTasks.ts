import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';
import * as cron from 'node-cron';

interface ScheduledTaskRecord {
  id: string;
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_status?: string;
  last_result?: string;
  metadata?: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeMetadata(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim() ? value : '{}';
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return '{}';
}

const manualTriggerHandlers = new Set([
  'agent',
  'scan-todos',
  'python_script',
  'crm_follow_up_dispatch',
  'hr_timesheet_monthly_export',
  'hr_timesheet_daily_alerts',
  'jules_automation',
  'learning_loop_cycle',
  'self_modification_cycle',
  'world_perception_cycle',
  'predictive_decision',
  'project_maintainer',
]);

export function createScheduledTasksRoutes(db: Database.Database): Router {
  const router = Router();

  /**
   * GET /api/v1/scheduled-tasks
   * List all scheduled tasks
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const tasks = db
        .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
        .all() as ScheduledTaskRecord[];

      res.json({
        success: true,
        count: tasks.length,
        data: tasks,
      });
    } catch (error) {
      logError('ScheduledTasksRoute', `Failed to list tasks: ${error}`);
      res.status(500).json({ error: 'Failed to fetch scheduled tasks' });
    }
  });

  /**
   * GET /api/v1/scheduled-tasks/:id
   * Get a specific scheduled task
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const task = db
        .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
        .get(req.params.id) as ScheduledTaskRecord | undefined;

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ success: true, data: task });
    } catch (error) {
      logError('ScheduledTasksRoute', `Failed to get task: ${error}`);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  /**
   * POST /api/v1/scheduled-tasks
   * Create a new scheduled task
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const { title, prompt, cron_expression, handler, metadata } = req.body;

      if (!title || !prompt || !cron_expression || !handler) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate cron expression
      if (!cron.validate(cron_expression)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();
      const normalizedMetadata = normalizeMetadata(metadata);

      // Some installations (tests) may have a scheduled_tasks schema without the `metadata` column.
      // Check table info and adapt the INSERT statement accordingly to remain compatible.
      const tableInfo = db.prepare("PRAGMA table_info(scheduled_tasks)").all() as Array<{ name: string }>;
      const hasMetadata = tableInfo.some((c) => c.name === 'metadata');

      if (hasMetadata) {
        db.prepare(`
          INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, prompt, cron_expression, handler, normalizedMetadata, now, now);
      } else {
        db.prepare(`
          INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, title, prompt, cron_expression, handler, now, now);
      }

      const task = db
        .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
        .get(id) as ScheduledTaskRecord;

      logInfo('ScheduledTasksRoute', `Task created: ${title}`);

      res.status(201).json({
        success: true,
        message: 'Scheduled task created',
        data: task,
      });
    } catch (error) {
      logError('ScheduledTasksRoute', `Failed to create task: ${error}`);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  /**
   * PATCH /api/v1/scheduled-tasks/:id
   * Update a scheduled task
   */
  router.patch('/:id', (req: Request, res: Response) => {
    try {
      const { title, prompt, cron_expression, handler, enabled, metadata } = req.body;
      const { id } = req.params;

      const task = db
        .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
        .get(id) as ScheduledTaskRecord | undefined;

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Validate cron if provided
      if (cron_expression && !cron.validate(cron_expression)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }

      const now = new Date().toISOString();
      const updates = {
        title: title ?? task.title,
        prompt: prompt ?? task.prompt,
        cron_expression: cron_expression ?? task.cron_expression,
        handler: handler ?? task.handler,
        enabled: enabled !== undefined ? enabled : task.enabled,
        metadata: metadata !== undefined ? normalizeMetadata(metadata) : task.metadata ?? '{}',
        updated_at: now,
      };

      db.prepare(`
        UPDATE scheduled_tasks 
        SET title = ?, prompt = ?, cron_expression = ?, handler = ?, enabled = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updates.title,
        updates.prompt,
        updates.cron_expression,
        updates.handler,
        updates.enabled ? 1 : 0,
        updates.metadata,
        updates.updated_at,
        id,
      );

      const updated = db
        .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
        .get(id) as ScheduledTaskRecord;

      logInfo('ScheduledTasksRoute', `Task updated: ${id}`);

      res.json({
        success: true,
        message: 'Task updated',
        data: updated,
      });
    } catch (error) {
      logError('ScheduledTasksRoute', `Failed to update task: ${error}`);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  /**
   * DELETE /api/v1/scheduled-tasks/:id
   * Delete a scheduled task
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      logInfo('ScheduledTasksRoute', `Task deleted: ${id}`);

      res.json({
        success: true,
        message: 'Task deleted',
      });
    } catch (error) {
      logError('ScheduledTasksRoute', `Failed to delete task: ${error}`);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  /**
   * POST /api/v1/scheduled-tasks/:id/trigger
   * Manually trigger a scheduled task immediately
   */
  router.post('/:id/trigger', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const task = db
        .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
        .get(id) as ScheduledTaskRecord | undefined;

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (!manualTriggerHandlers.has(task.handler)) {
        return res.status(422).json({ error: `Unsupported handler: ${task.handler}` });
      }

      const { scheduledTasksRunner } = await import('../schedulers/scheduledTasksRunner.js');
      const result = await scheduledTasksRunner.executeTask({
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        cron_expression: task.cron_expression,
        handler: task.handler,
        enabled: task.enabled,
        metadata: task.metadata ?? null,
      });

      const resultRecord = result && typeof result === 'object' ? result as Record<string, unknown> : null;
      if (resultRecord && (resultRecord.success === false || resultRecord.status === 'failed')) {
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE scheduled_tasks
          SET last_run_at = ?, last_status = ?, last_result = ?
          WHERE id = ?
        `).run(now, 'failed', JSON.stringify(result), id);

        return res.status(500).json({
          success: false,
          error: 'Task execution failed',
          result,
        });
      }

      // Update last run
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE scheduled_tasks 
        SET last_run_at = ?, last_status = ?, last_result = ?
        WHERE id = ?
      `).run(now, 'success', JSON.stringify(result), id);

      logInfo('ScheduledTasksRoute', `Task triggered: ${id}`);

      res.json({
        success: true,
        message: 'Task executed',
        result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('ScheduledTasksRoute', `Failed to trigger task: ${errorMsg}`);

      // Update last run with error
      db.prepare(`
        UPDATE scheduled_tasks 
        SET last_run_at = ?, last_status = ?, last_result = ?
        WHERE id = ?
      `).run(new Date().toISOString(), 'failed', errorMsg, req.params.id);

      res.status(500).json({ error: 'Failed to trigger task' });
    }
  });

  return router;
}

export default createScheduledTasksRoutes;
