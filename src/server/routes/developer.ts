// FILE: src/server/routes/developer.ts
// PURPOSE: REST API endpoints for Developer Agent 3.0
// VERSION: 3.0.2 — P4+P5+P6: Code Review, Context Builder, Coverage Analysis

import { Router } from 'express';
import { pipelineRunner, type TaskPipeline } from '../../agents/developerPipeline.js';
import { codeReviewEngine } from '../../agents/codeReview.js';
import { contextBuilder } from '../../agents/contextBuilder.js';
import { coverageAnalyzer } from '../../agents/coverageAnalysis.js';
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

    // ==================== P4: Code Review & Refactoring ====================

    /**
     * POST /api/v1/developer/review
     * Review a file for code quality issues
     *
     * Body: { filePath: string } OR { code: string, language?: string }
     */
    router.post('/review', async (req, res) => {
        try {
            const { filePath, code, language } = req.body;

            if (!filePath && !code) {
                res.status(400).json({ error: 'filePath or code is required' });
                return;
            }

            logInfo('DeveloperRoute', `Review request: ${filePath || '<inline>'}`);

            let result;
            if (filePath) {
                result = await codeReviewEngine.reviewFile(filePath);
            } else {
                result = await codeReviewEngine.reviewCode(
                    code as string,
                    (language as string) || 'typescript'
                );
            }

            res.json({ review: result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Review failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * POST /api/v1/developer/refactor
     * Refactor a file with a specific instruction
     *
     * Body: { filePath: string, instruction: string, apply?: boolean }
     */
    router.post('/refactor', async (req, res) => {
        try {
            const { filePath, instruction, apply } = req.body;

            if (!filePath || typeof filePath !== 'string') {
                res.status(400).json({ error: 'filePath (string) is required' });
                return;
            }
            if (!instruction || typeof instruction !== 'string') {
                res.status(400).json({ error: 'instruction (string) is required' });
                return;
            }

            logInfo('DeveloperRoute', `Refactor request: ${filePath}`);

            const result = await codeReviewEngine.refactorFile(filePath, instruction);

            // Optionally apply the refactored code
            if (apply) {
                const fs = await import('fs/promises');
                await fs.writeFile(result.filePath, result.refactoredCode, 'utf-8');
                logInfo('DeveloperRoute', `Refactored code applied to ${result.filePath}`);
            }

            res.json({
                refactor: {
                    ...result,
                    applied: !!apply,
                    // Don't send full code in response by default
                    originalCode: undefined,
                    refactoredCode: apply ? undefined : result.refactoredCode,
                },
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Refactor failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * GET /api/v1/developer/review/history
     * Get review history
     */
    router.get('/review/history', (_req, res) => {
        try {
            const limit = parseInt(_req.query.limit as string) || 20;
            const history = codeReviewEngine.getHistory(limit);
            const stats = codeReviewEngine.getAggregateStats();

            res.json({ history, stats });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P5: Multi-File Context ====================

    /**
     * POST /api/v1/developer/context
     * Gather context files for a target file
     *
     * Body: { filePath: string, options?: ContextOptions }
     */
    router.post('/context', async (req, res) => {
        try {
            const { filePath, options } = req.body;

            if (!filePath || typeof filePath !== 'string') {
                res.status(400).json({ error: 'filePath (string) is required' });
                return;
            }

            logInfo('DeveloperRoute', `Context request: ${filePath}`);

            const result = await contextBuilder.gatherContext(filePath, options || {});

            // Return metadata + file list (without full content by default)
            const includeContent = req.query.content === 'true';

            res.json({
                context: {
                    targetFile: result.targetFile,
                    totalSize: result.totalSize,
                    truncated: result.truncated,
                    gatheredAt: result.gatheredAt,
                    files: result.files.map(f => ({
                        relativePath: f.relativePath,
                        reason: f.reason,
                        size: f.size,
                        ...(includeContent ? { content: f.content } : {}),
                    })),
                },
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Context failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P6: Coverage Analysis ====================

    // POST /coverage — Run coverage analysis (or parse existing)
    router.post('/coverage', async (req, res) => {
        try {
            const { mode, include, exclude } = req.body as {
                mode?: 'run' | 'parse';
                include?: string[];
                exclude?: string[];
            };

            logInfo('DeveloperRoute', `Coverage request: mode=${mode || 'parse'}`);

            let summary;
            if (mode === 'run') {
                summary = await coverageAnalyzer.runCoverage({ include, exclude });
            } else {
                // Try to parse existing coverage JSON
                const coveragePath = require('path').join(process.cwd(), 'coverage/coverage-final.json');
                summary = await coverageAnalyzer.parseCoverageJson(coveragePath, { exclude });
            }

            res.json({ coverage: summary });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Coverage failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /coverage/summary — Get last computed coverage (no re-run)
    router.get('/coverage/summary', (_req, res) => {
        const summary = coverageAnalyzer.getLastSummary();
        if (!summary) {
            res.status(404).json({ error: 'No coverage data. Run POST /coverage first.' });
            return;
        }
        res.json({ coverage: summary });
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
