import { Router } from 'express';
import { getTasks, getTaskCount, getTaskById, getTaskStats } from '@packages/utils/tasksDb.js';
import { agentManager } from '@packages/agents/AgentManager.js';
import { decomposeToDAGAsync } from '@packages/agents/taskDecomposerCore.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logDebug } from '@packages/utils/logger.js';

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

    router.get('/workflow/status', async (_req, res) => {
        try {
            res.json({ workflows: agentManager.listWorkflowExecutions() });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/workflow/preview', async (req, res) => {
        try {
            const { task, defaultAgent } = req.body as { task?: string; defaultAgent?: string };
            if (!task) {
                res.status(400).json({ error: 'task is required' });
                return;
            }

            const workflow = await decomposeToDAGAsync(task, { defaultAgent });
            res.json({ success: true, workflow });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/workflow/run', async (req, res) => {
        try {
            const { task, workflow, defaultAgent, initialContext } = req.body as {
                task?: string;
                workflow?: Parameters<typeof agentManager.executeWorkflow>[0];
                defaultAgent?: string;
                initialContext?: Record<string, unknown>;
            };

            const resolvedWorkflow = workflow ?? (task ? await decomposeToDAGAsync(task, { defaultAgent }) : undefined);
            if (!resolvedWorkflow) {
                res.status(400).json({ error: 'task or workflow is required' });
                return;
            }

            const result = await agentManager.executeWorkflow(resolvedWorkflow, initialContext);
            res.json({ success: true, workflow: resolvedWorkflow, result });
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

            // If the task result contains a traceId, fetch trace spans for deeper logs
            let logs: Array<{ timestamp: string; level: string; message: string; details?: any }> = [];
            try {
                if (task.result) {
                    let parsed: any = null;
                    try { parsed = JSON.parse(task.result); } catch (error: unknown) {
                        logDebug('TasksRoutes', `Task result parse skipped: ${ensureError(error).message}`);
                        parsed = null;
                    }
                    const traceId = parsed?.metadata?.traceId || parsed?.traceId || (parsed?.data && parsed.data.traceId);
                    if (traceId) {
                        const { getTraceSpans } = await import('@packages/utils/agentTracer.js');
                        const spans = getTraceSpans(traceId);
                        logs = spans.map(s => ({
                            timestamp: new Date(s.startTime).toISOString(),
                            level: s.status === 'error' ? 'error' : 'info',
                            message: `${s.agentName} ${s.operation}`,
                            details: s,
                        }));
                    }
                }
            } catch (error: unknown) {
                logDebug('TasksRoutes', `Trace lookup skipped: ${ensureError(error).message}`);
            }

            res.json({ task: { ...task, logs } });
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
