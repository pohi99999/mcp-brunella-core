import { Router } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import {
  getAllSuggestedTasks,
  getSuggestedTasksByStatus,
  updateSuggestedTaskStatus,
  deleteSuggestedTask,
  scanCodebaseForTodos,
} from '../../core/suggestedTasksScanner.js';

export const suggestedTasksRouter = Router();

/**
 * GET /api/suggested-tasks
 * Get all non-archived suggested tasks
 */
suggestedTasksRouter.get('/', (req, res) => {
  try {
    const tasks = getAllSuggestedTasks();
    logInfo('suggestedTasksAPI', `Retrieved ${tasks.length} suggested tasks`);
    res.json({ success: true, data: tasks });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('suggestedTasksAPI', error);
    res.status(500).json({ success: false, error });
  }
});

/**
 * GET /api/suggested-tasks/:status
 * Get suggested tasks by status (pending, in_progress, completed, archived)
 */
suggestedTasksRouter.get('/:status', (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const tasks = getSuggestedTasksByStatus(status);
    logInfo('suggestedTasksAPI', `Retrieved ${tasks.length} tasks with status: ${status}`);
    res.json({ success: true, data: tasks });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('suggestedTasksAPI', error);
    res.status(500).json({ success: false, error });
  }
});

/**
 * POST /api/suggested-tasks/scan
 * Scan codebase for TODOs/FIXMEs and store in database
 */
suggestedTasksRouter.post('/scan', async (req, res) => {
  try {
    const codebasePath = process.env.BRUNELLA_WORKSPACE_ROOT || '.';
    logInfo('suggestedTasksAPI', `Scanning codebase at: ${codebasePath}`);

    const newTasks = await scanCodebaseForTodos(codebasePath);
    logInfo('suggestedTasksAPI', `Scan complete: ${newTasks.length} new/updated tasks`);

    res.json({ success: true, data: { count: newTasks.length, tasks: newTasks } });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('suggestedTasksAPI', error);
    res.status(500).json({ success: false, error });
  }
});

/**
 * PATCH /api/suggested-tasks/:taskId/status
 * Update a suggested task's status
 */
suggestedTasksRouter.patch('/:taskId/status', (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = updateSuggestedTaskStatus(taskId, status);

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    logInfo('suggestedTasksAPI', `Updated task ${taskId} status to: ${status}`);
    res.json({ success: true, data: { taskId, status } });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('suggestedTasksAPI', error);
    res.status(500).json({ success: false, error });
  }
});

/**
 * DELETE /api/suggested-tasks/:taskId
 * Archive/delete a suggested task
 */
suggestedTasksRouter.delete('/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;

    const deleted = deleteSuggestedTask(taskId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    logInfo('suggestedTasksAPI', `Archived task: ${taskId}`);
    res.json({ success: true, data: { taskId, archived: true } });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('suggestedTasksAPI', error);
    res.status(500).json({ success: false, error });
  }
});
