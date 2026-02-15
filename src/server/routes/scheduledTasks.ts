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
  created_at: string;
  updated_at: string;
}

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
      const { title, prompt, cron_expression, handler } = req.body;

      if (!title || !prompt || !cron_expression || !handler) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate cron expression
      if (!cron.validate(cron_expression)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, prompt, cron_expression, handler, now, now);

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
      const { title, prompt, cron_expression, handler, enabled } = req.body;
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
        updated_at: now,
      };

      db.prepare(`
        UPDATE scheduled_tasks 
        SET title = ?, prompt = ?, cron_expression = ?, handler = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updates.title,
        updates.prompt,
        updates.cron_expression,
        updates.handler,
        updates.enabled ? 1 : 0,
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

      // Execute based on handler type
      let result = {};
      if (task.handler === 'scan-todos') {
        // Trigger suggested tasks scan
        const scanResult = await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'scheduled', taskId: id }),
        });

        result = await scanResult.json();
      } else {
        result = { message: 'Unknown handler type' };
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
