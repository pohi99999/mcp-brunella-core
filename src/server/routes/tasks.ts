import { Router } from 'express';
import { getTasks, getTaskCount, getTaskById, getTaskStats } from '../../utils/tasksDb.js';
import { agentManager } from '../../agents/AgentManager.js';

export function createTaskRoutes(): Router {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;
            const status = typeof req.query.status === 'string' ? req.query.status : undefined;
            const tasks = await getTasks(limit, offset, status);
            const total = await getTaskCount(status);
            res.json({ tasks, total, limit, offset, status });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/stats', async (req, res) => {
        try {
            const stats = await getTaskStats();
            res.json({ stats });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) {
                res.status(400).json({ error: 'Invalid task id' });
                return;
            }
            const task = await getTaskById(id);
            if (!task) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ task });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { description, agentName, context, parentId } = req.body;

            if (!description || !agentName) {
                res.status(400).json({ error: 'Description and agentName are required' });
                return;
            }

            const taskId = agentManager.queueTask(description, agentName, context, parentId);
            res.json({ taskId, status: 'queued' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/execute', async (req, res) => {
        try {
            const result = await agentManager.processPendingTasks();
            if (!result) {
                res.status(404).json({ error: 'No pending tasks' });
                return;
            }
            res.json({ result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/cancel', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.cancelTask(taskId);
            if (!ok) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ status: 'cancelled', taskId });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/retry', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            const debugMode = Boolean(req.body.debugMode);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.retryTask(taskId, debugMode);
            if (!ok) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ status: 'pending', taskId, debugMode });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/pause', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.pauseTask(taskId);
            if (!ok) {
                res.status(404).json({ error: 'Task not found or not resumable' });
                return;
            }
            res.json({ status: 'paused', taskId });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/resume', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.resumeTask(taskId);
            if (!ok) {
                res.status(404).json({ error: 'Task not found or not resumable' });
                return;
            }
            res.json({ status: 'pending', taskId });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/reorder', async (req, res) => {
        try {
            const { taskIds } = req.body;
            if (!Array.isArray(taskIds) || taskIds.some(isNaN)) {
                res.status(400).json({ error: 'taskIds must be an array of numbers' });
                return;
            }
            agentManager.updateTaskOrder(taskIds);
            res.json({ status: 'reordered', taskIds });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
