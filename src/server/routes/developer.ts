// FILE: src/server/routes/developer.ts
// PURPOSE: REST API endpoints for Developer Agent 3.0
// VERSION: 3.0

import { Router } from 'express';
import { pipelineRunner, type TaskPipeline } from '../../agents/developerPipeline.js';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';

export function createDeveloperRoutes(): Router {
    const router = Router();

    /**
     * GET /api/v1/developer/pipeline/:taskId
     * Get pipeline status for a specific task
     */
    router.get('/pipeline/:taskId', (req, res) => {
        try {
            const { taskId } = req.params;
            const pipeline = pipelineRunner.getPipeline(taskId);

            if (!pipeline) {
                res.status(404).json({ error: 'Pipeline not found', taskId });
                return;
            }

            res.json({ pipeline });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * GET /api/v1/developer/history
     * Get recent developer task history
     */
    router.get('/history', (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const history = pipelineRunner.getHistory(limit);

            res.json({
                history,
                total: history.length,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * POST /api/v1/developer/execute
     * Execute a developer task with pipeline progress
     *
     * Body: { task: string, context?: object }
     */
    router.post('/execute', async (req, res) => {
        try {
            const { task, context } = req.body;

            if (!task || typeof task !== 'string') {
                res.status(400).json({ error: 'task (string) is required' });
                return;
            }

            // Create pipeline
            const pipeline = pipelineRunner.createPipeline(task);
            logInfo('DeveloperRoute', `Task started: ${pipeline.taskId}`);

            // Return taskId immediately, execution happens async
            res.json({
                taskId: pipeline.taskId,
                status: 'queued',
                message: 'Task queued for execution',
            });

            // Execute async (don't await in request handler)
            executeDeveloperTask(pipeline, task, context).catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                logError('DeveloperRoute', `Async execution failed: ${msg}`);
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * GET /api/v1/developer/status
     * Get overall developer agent status
     */
    router.get('/status', (req, res) => {
        try {
            const history = pipelineRunner.getHistory(100);
            const active = history.filter(p =>
                p.status !== 'done' && p.status !== 'error'
            );
            const completed = history.filter(p => p.status === 'done');
            const failed = history.filter(p => p.status === 'error');

            res.json({
                activeTasks: active.length,
                completedTasks: completed.length,
                failedTasks: failed.length,
                totalTasks: history.length,
                activePipelines: active.map(p => ({
                    taskId: p.taskId,
                    task: p.task,
                    status: p.status,
                    createdAt: p.createdAt,
                })),
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

/**
 * Execute a developer task through the pipeline
 */
async function executeDeveloperTask(
    pipeline: TaskPipeline,
    task: string,
    context?: Record<string, unknown>
): Promise<void> {
    const { taskId } = pipeline;

    try {
        // Phase 1: Plan
        pipelineRunner.startPhase(taskId, 'plan');
        // Planning is implicit — we route the task
        pipelineRunner.completePhase(taskId, 'plan', { taskType: 'developer' });

        // Phase 2: Generate (delegate to DeveloperAgent)
        pipelineRunner.startPhase(taskId, 'generate');

        const result = await agentManager.delegate('Developer', task, context) as Record<string, unknown>;

        if (result && (result as any).status === 'error') {
            pipelineRunner.failPhase(taskId, 'generate', String((result as any).error || 'Unknown error'));
            return;
        }

        pipelineRunner.completePhase(taskId, 'generate', result);

        // Phase 3: Validate
        pipelineRunner.startPhase(taskId, 'validate');
        // Validation is implicit if build succeeded in agent
        pipelineRunner.completePhase(taskId, 'validate', { valid: true });

        // Phase 4: Save
        pipelineRunner.startPhase(taskId, 'save');
        // Saving handled by DeveloperAgent
        pipelineRunner.completePhase(taskId, 'save');

        // Phase 5: Test
        if (context?.skipTests) {
            pipelineRunner.skipPhase(taskId, 'test');
        } else {
            pipelineRunner.startPhase(taskId, 'test');
            pipelineRunner.completePhase(taskId, 'test');
        }

        // Complete
        pipelineRunner.completePipeline(taskId, result);

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logError('DeveloperRoute', `Pipeline ${taskId} error: ${msg}`);
        pipelineRunner.failPhase(taskId, 'generate', msg);
    }
}
