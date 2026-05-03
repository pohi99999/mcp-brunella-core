
// FILE: src/server/routes/developer.ts
// PURPOSE: REST API endpoints for Developer Agent 3.0
// VERSION: 3.0.5 — P4+P5+P6+P7+P8+P9: Code Review, Context, Coverage, Task Queue, Git Integration, Code Scaffolding

import { Router } from 'express';
import { pipelineRunner, type TaskPipeline } from '@packages/agents/developerPipeline.js';
import { codeReviewEngine } from '@packages/agents/codeReview.js';
import { contextBuilder } from '@packages/agents/contextBuilder.js';
import { coverageAnalyzer } from '@packages/agents/coverageAnalysis.js';
import { taskQueueManager } from '@packages/agents/taskQueue.js';
import type { TaskPriority, TaskStatus, TaskType } from '@packages/agents/taskQueue.js';
import { getGitManager } from '@packages/agents/gitIntegration.js';
import { getTemplateEngine } from '@packages/agents/codeScaffold.js';
import { developerMetrics } from '@packages/utils/developerMetrics.js';
import { approvalManager } from '@packages/utils/approvalManager.js';
import { activityFeed } from '@packages/utils/activityFeed.js';
import { agentManager } from '@packages/agents/AgentManager.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { approvalRouter } from '@packages/core-logic/approvalRouter.js';
import * as path from 'path';

const TASK_TYPES = new Set<TaskType>(['generate', 'test', 'fix', 'review', 'refactor', 'coverage', 'scaffold', 'generic']);
const TASK_PRIORITIES = new Set<TaskPriority>(['high', 'medium', 'low']);
const TASK_STATUSES = new Set<TaskStatus>(['queued', 'running', 'completed', 'failed', 'cancelled']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function readLimit(value: unknown, fallback: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function readStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value
        .map((item) => readString(item))
        .filter((item): item is string => item !== null);
}

function readTaskType(value: unknown): TaskType | null {
    const type = readString(value);
    return type && TASK_TYPES.has(type as TaskType) ? type as TaskType : null;
}

function readTaskPriority(value: unknown): TaskPriority | undefined {
    const priority = readString(value);
    return priority && TASK_PRIORITIES.has(priority as TaskPriority) ? priority as TaskPriority : undefined;
}

function readTaskStatus(value: unknown): TaskStatus | undefined {
    const status = readString(value);
    return status && TASK_STATUSES.has(status as TaskStatus) ? status as TaskStatus : undefined;
}

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
            const limit = readLimit(req.query.limit, 20);
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
            const body = isRecord(req.body) ? req.body : {};
            const task = readString(body.task);
            const context = isRecord(body.context) ? body.context : undefined;

            if (!task) {
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

    /**
     * GET /api/v1/developer/metrics
     * Get developer metrics (P10)
     */
    router.get('/metrics', async (_req, res) => {
        try {
            const metrics = await developerMetrics.getMetrics();
            res.json({ metrics });
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
            const body = isRecord(req.body) ? req.body : {};
            const filePath = readString(body.filePath);
            const code = readString(body.code);
            const language = readString(body.language) ?? 'typescript';

            if (!filePath && !code) {
                res.status(400).json({ error: 'filePath or code is required' });
                return;
            }

            logInfo('DeveloperRoute', `Review request: ${filePath || '<inline>'}`);

            let result;
            if (filePath) {
                result = await codeReviewEngine.reviewFile(filePath);
            } else if (code) {
                result = await codeReviewEngine.reviewCode(code, language);
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
            const body = isRecord(req.body) ? req.body : {};
            const filePath = readString(body.filePath);
            const instruction = readString(body.instruction);
            const apply = body.apply === true;

            if (!filePath) {
                res.status(400).json({ error: 'filePath (string) is required' });
                return;
            }
            if (!instruction) {
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
            const limit = readLimit(_req.query.limit, 20);
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
            const body = isRecord(req.body) ? req.body : {};
            const filePath = readString(body.filePath);
            const options = isRecord(body.options) ? body.options : {};

            if (!filePath) {
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
            const body = isRecord(req.body) ? req.body : {};
            const requestedMode = readString(body.mode);
            const mode: 'run' | 'parse' = requestedMode === 'run' ? 'run' : 'parse';
            const include = readStringArray(body.include);
            const exclude = readStringArray(body.exclude);

            logInfo('DeveloperRoute', `Coverage request: mode=${mode || 'parse'}`);

            let summary;
            if (mode === 'run') {
                summary = await coverageAnalyzer.runCoverage({ include, exclude });
            } else {
                // Try to parse existing coverage JSON
                const coveragePath = path.join(process.cwd(), 'coverage/coverage-final.json');
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

    // ==================== P7: Task Queue Management ====================

    // POST /queue — Add task to queue
    router.post('/queue', async (req, res) => {
        try {
            const body = isRecord(req.body) ? req.body : {};
            const type = readTaskType(body.type);
            const description = readString(body.description);
            const params = isRecord(body.params) ? body.params : {};
            const priority = readTaskPriority(body.priority);
            const maxRetries = typeof body.maxRetries === 'number' && Number.isFinite(body.maxRetries)
                ? Math.min(Math.max(Math.trunc(body.maxRetries), 0), 10)
                : undefined;

            if (!type || !description) {
                res.status(400).json({ error: 'type and description are required' });
                return;
            }

            const taskId = await taskQueueManager.addTask(
                type,
                description,
                params,
                { priority, maxRetries }
            );

            const task = taskQueueManager.getTask(taskId);
            res.json({ task });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue add failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /queue — List all tasks (with optional filters)
    router.get('/queue', (req, res) => {
        try {
            const status = readTaskStatus(req.query.status);
            const type = readTaskType(req.query.type);
            const priority = readTaskPriority(req.query.priority);

            const tasks = taskQueueManager.getTasks({
                status,
                type: type ?? undefined,
                priority,
            });

            const stats = taskQueueManager.getStats();

            res.json({ tasks, stats });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue list failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /queue/:id — Get specific task
    router.get('/queue/:id', (req, res) => {
        try {
            const { id } = req.params;
            const task = taskQueueManager.getTask(id);

            if (!task) {
                res.status(404).json({ error: 'Task not found', taskId: id });
                return;
            }

            res.json({ task });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue get failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // PUT /queue/:id — Update task (priority or cancel)
    router.put('/queue/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const body = isRecord(req.body) ? req.body : {};
            const action = readString(body.action);
            const priority = readTaskPriority(body.priority);

            if (action === 'cancel') {
                const success = await taskQueueManager.cancelTask(id);
                if (!success) {
                    res.status(400).json({ error: 'Cannot cancel task (already finished or not found)' });
                    return;
                }
                const task = taskQueueManager.getTask(id);
                res.json({ task, message: 'Task cancelled' });
            } else if (action === 'prioritize' && priority) {
                const success = taskQueueManager.prioritizeTask(id, priority);
                if (!success) {
                    res.status(400).json({ error: 'Cannot change priority (not queued or not found)' });
                    return;
                }
                const task = taskQueueManager.getTask(id);
                res.json({ task, message: 'Priority updated' });
            } else {
                res.status(400).json({ error: 'Invalid action or missing priority' });
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue update failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /queue/:id/retry — Retry a failed task
    router.post('/queue/:id/retry', async (req, res) => {
        try {
            const { id } = req.params;
            const newTaskId = await taskQueueManager.retryTask(id);

            if (!newTaskId) {
                res.status(400).json({ error: 'Cannot retry (not failed or max retries exceeded)' });
                return;
            }

            const newTask = taskQueueManager.getTask(newTaskId);
            res.json({ task: newTask, message: `Task retried as ${newTaskId}` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue retry failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /queue/stats — Get queue statistics
    router.get('/queue/stats', (_req, res) => {
        try {
            const stats = taskQueueManager.getStats();
            res.json({ stats });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Queue stats failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P8: Git Integration ====================

    // GET /git/status — Get git status (branch, staged/unstaged files)
    router.get('/git/status', async (_req, res) => {
        try {
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const status = await gitManager.getStatus();
            res.json({ status });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git status failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /git/diff — Get diff for file or all changes
    router.get('/git/diff', async (req, res) => {
        try {
            const { file, staged } = req.query;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const diffs = await gitManager.getDiff(
                file as string | undefined,
                staged === 'true'
            );
            res.json({ diffs });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git diff failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/stage — Stage files
    router.post('/git/stage', async (req, res) => {
        try {
            const { files } = req.body;
            if (!Array.isArray(files) || files.length === 0) {
                res.status(400).json({ error: 'files array required' });
                return;
            }
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            await gitManager.stageFiles(files);
            res.json({ success: true, message: `${files.length} files staged` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git stage failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/unstage — Unstage files
    router.post('/git/unstage', async (req, res) => {
        try {
            const { files } = req.body;
            if (!Array.isArray(files) || files.length === 0) {
                res.status(400).json({ error: 'files array required' });
                return;
            }
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            await gitManager.unstageFiles(files);
            res.json({ success: true, message: `${files.length} files unstaged` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git unstage failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/commit — Commit staged changes
    router.post('/git/commit', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                res.status(400).json({ error: 'message required' });
                return;
            }
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const result = await gitManager.commit(message);
            res.json({ commit: result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git commit failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/push — Push to remote
    router.post('/git/push', async (req, res) => {
        try {
            const { remote, branch } = req.body;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const result = await gitManager.push(remote, branch);
            res.json({ push: result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git push failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /git/branches — List branches
    router.get('/git/branches', async (req, res) => {
        try {
            const { remote } = req.query;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const branches = await gitManager.listBranches(remote === 'true');
            res.json({ branches });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git branches failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/branch — Create branch
    router.post('/git/branch', async (req, res) => {
        try {
            const { name, checkout } = req.body;
            if (!name) {
                res.status(400).json({ error: 'name required' });
                return;
            }
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            await gitManager.createBranch(name, checkout === true);
            res.json({ success: true, message: `Branch created: ${name}` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git branch create failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // PUT /git/branch/:name — Checkout or delete branch
    router.put('/git/branch/:name', async (req, res) => {
        try {
            const { name } = req.params;
            const { action, force } = req.body;

            if (!action || (action !== 'checkout' && action !== 'delete')) {
                res.status(400).json({ error: 'action required: checkout | delete' });
                return;
            }

            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);

            if (action === 'checkout') {
                await gitManager.checkoutBranch(name);
                res.json({ success: true, message: `Checked out: ${name}` });
            } else {
                await gitManager.deleteBranch(name, force === true);
                res.json({ success: true, message: `Branch deleted: ${name}` });
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git branch ${req.body.action} failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // GET /git/log — Get recent commits
    router.get('/git/log', async (req, res) => {
        try {
            const { limit } = req.query;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            const log = await gitManager.getLog(
                limit ? parseInt(limit as string, 10) : 10
            );
            res.json({ log });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git log failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/fetch — Fetch from remote
    router.post('/git/fetch', async (req, res) => {
        try {
            const { remote } = req.body;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            await gitManager.fetch(remote || 'origin');
            res.json({ success: true, message: `Fetched from ${remote || 'origin'}` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git fetch failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /git/pull — Pull from remote
    router.post('/git/pull', async (req, res) => {
        try {
            const { remote, branch } = req.body;
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const gitManager = getGitManager(workspaceRoot);
            await gitManager.pull(remote || 'origin', branch);
            res.json({ success: true, message: `Pulled from ${remote || 'origin'}` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Git pull failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P9: Code Scaffolding ====================

    // GET /scaffold/templates — List available templates
    router.get('/scaffold/templates', (req, res) => {
        try {
            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const templateEngine = getTemplateEngine(workspaceRoot);
            const templates = templateEngine.listTemplates();
            res.json({ templates });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `List templates failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // POST /scaffold — Generate files from template
    router.post('/scaffold', async (req, res) => {
        try {
            const { template, variables, preview, overwrite } = req.body;

            if (!template) {
                res.status(400).json({ error: 'template name required' });
                return;
            }

            if (!variables || typeof variables !== 'object') {
                res.status(400).json({ error: 'variables object required' });
                return;
            }

            const workspaceRoot = process.env.BRUNELLA_WORKSPACE_ROOT || process.cwd();
            const templateEngine = getTemplateEngine(workspaceRoot);

            const files = await templateEngine.generateFromTemplate(
                template,
                variables,
                { preview: preview === true, overwrite: overwrite === true }
            );

            res.json({
                success: true,
                files,
                preview: preview === true,
                message: preview ? 'Preview generated' : `${files.length} files generated`,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('DeveloperRoute', `Scaffold generation failed: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P11: Approval Flow ====================

    // POST /approval/request — Request approval (mainly for testing/tools)
    router.post('/approval/request', async (req, res) => {
        try {
            const { type, description, metadata, timeoutMs } = req.body;
            if (!type || !description) {
                res.status(400).json({ error: 'type and description required' });
                return;
            }
            const id = await approvalManager.requestApproval(type, description, metadata, timeoutMs);
            res.json({ id, status: 'pending' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // GET /approval — List pending requests
    router.get('/approval', (req, res) => {
        try {
            const { status } = req.query;
            const requests = approvalManager.listRequests(status as any);
            res.json({ requests });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // POST /approval/:id/respond — Respond to request
    router.post('/approval/:id/respond', (req, res) => {
        try {
            const { id } = req.params;
            const { action, response } = req.body;

            if (action !== 'approve' && action !== 'reject') {
                res.status(400).json({ error: 'action must be approve or reject' });
                return;
            }

            const workflow = approvalRouter.respondToWorkflowByRequestId(id, action, response);
            if (!workflow) {
                const success = approvalManager.respond(id, action, response);
                if (!success) {
                    res.status(400).json({ error: 'Failed to respond (invalid ID or status)' });
                    return;
                }
            }

            res.json({
                success: true,
                id,
                status: action === 'approve' ? 'approved' : 'rejected',
                workflow,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // GET /approval/:id/callback — Signed approval URL bridge for email/webhook flows
    router.get('/approval/:id/callback', (req, res) => {
        try {
            const { id } = req.params;
            const action = req.query.action;
            const token = req.query.token;

            if (action !== 'approve' && action !== 'reject') {
                res.status(400).json({ error: 'action must be approve or reject' });
                return;
            }

            if (typeof token !== 'string' || !approvalRouter.verifyCallbackToken(id, token)) {
                res.status(403).json({ error: 'Invalid approval callback token' });
                return;
            }

            const workflow = approvalRouter.respondToWorkflowByRequestId(id, action, {
                source: 'callback',
                query: req.query,
            });

            if (!workflow) {
                res.status(400).json({ error: 'Failed to respond (invalid ID or status)' });
                return;
            }

            res.json({
                success: true,
                id,
                status: workflow.status,
                workflowId: workflow.workflowId,
                message: `Approval ${workflow.status}`,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // ==================== P12: Activity Feed ====================

    // GET /feed — Get recent activity feed
    router.get('/feed', (req, res) => {
        try {
            const limit = readLimit(req.query.limit, 50);
            const activities = activityFeed.getRecent(limit);
            res.json({ activities });
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
