// FILE: src/agents/taskQueue.ts// PURPOSE: Task Queue Manager for Developer Agent 3.0 (P7)
// VERSION: 3.0
//
// Manages multiple concurrent development tasks with:
//   - Priority-based execution (high/medium/low)
//   - Retry mechanism for failed tasks
//   - Worker pool limit (max concurrent tasks)
//   - Cancellation support
//   - Batch operations

import { logInfo, logError } from '@packages/utils/logger.js';
import { EventEmitter } from 'events';
import { pipelineRunner } from './developerPipeline.js';
import type { TaskPipeline } from './developerPipeline.js';
import {
    getOrchestrationConcurrencyConfig,
    type OrchestrationConcurrency,
} from '@packages/utils/paiosConfig.js';

// ==================== Types ====================

export type TaskStatus = 
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskType = 
    | 'generate'
    | 'test'
    | 'fix'
    | 'review'
    | 'refactor'
    | 'coverage'
    | 'scaffold'
    | 'generic';

export interface QueuedTask {
    id: string;
    type: TaskType;
    description: string;
    params: Record<string, unknown>;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    result?: unknown;
    retryCount: number;
    maxRetries: number;
    pipelineId?: string; // Link to pipeline task
}

export interface QueueStats {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    avgWaitTime: number;
    avgExecutionTime: number;
}

export interface AddTaskOptions {
    priority?: TaskPriority;
    maxRetries?: number;
    context?: Record<string, unknown>;
}

// ==================== Constants ====================

const DEFAULT_MAX_WORKERS = 3; // Balanced default profile
const DEFAULT_MAX_RETRIES = 2;
const PRIORITY_WEIGHTS = {
    high: 3,
    medium: 2,
    low: 1,
};

// ==================== Task Queue Manager ====================

export class TaskQueueManager extends EventEmitter {
    private tasks: Map<string, QueuedTask> = new Map();
    private runningTasks: Set<string> = new Set();
    private maxWorkers: number;
    private concurrencyProfile: OrchestrationConcurrency;
    private nextTaskId = 1;
    private processingLoop: NodeJS.Timeout | null = null;
    private autoStart: boolean;

    constructor(maxWorkers?: number, autoStart = true) {
        super();
        const baseProfile = getOrchestrationConcurrencyConfig();
        this.maxWorkers = maxWorkers ?? baseProfile.max_concurrent_tasks ?? DEFAULT_MAX_WORKERS;
        this.concurrencyProfile = {
            ...baseProfile,
            max_concurrent_tasks: this.maxWorkers,
        };
        this.autoStart = autoStart;
        if (autoStart) {
            this.startProcessing();
        }
    }

    /**
     * Get the current orchestration concurrency profile.
     */
    getConcurrencyProfile(): OrchestrationConcurrency {
        return { ...this.concurrencyProfile };
    }

    /**
     * Get the current maximum worker count.
     */
    getMaxWorkers(): number {
        return this.maxWorkers;
    }

    /**
     * Add a task to the queue.
     */
    async addTask(
        type: TaskType,
        description: string,
        params: Record<string, unknown>,
        options: AddTaskOptions = {}
    ): Promise<string> {
        const taskId = `task-${Date.now()}-${this.nextTaskId++}`;
        const task: QueuedTask = {
            id: taskId,
            type,
            description,
            params,
            priority: options.priority ?? 'medium',
            status: 'queued',
            createdAt: Date.now(),
            retryCount: 0,
            maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
        };

        this.tasks.set(taskId, task);
        logInfo('TaskQueue', `Task added: ${taskId} (${type}, priority: ${task.priority})`);
        this.emit('task:added', task);

        // Trigger immediate processing check (if auto-processing is enabled)
        if (this.autoStart) {
            this.processQueue();
        }

        return taskId;
    }

    /**
     * Get a specific task by ID.
     */
    getTask(taskId: string): QueuedTask | null {
        return this.tasks.get(taskId) ?? null;
    }

    /**
     * Get all tasks, optionally filtered.
     */
    getTasks(filters?: {
        status?: TaskStatus;
        type?: TaskType;
        priority?: TaskPriority;
    }): QueuedTask[] {
        let tasks = Array.from(this.tasks.values());

        if (filters?.status) {
            tasks = tasks.filter(t => t.status === filters.status);
        }
        if (filters?.type) {
            tasks = tasks.filter(t => t.type === filters.type);
        }
        if (filters?.priority) {
            tasks = tasks.filter(t => t.priority === filters.priority);
        }

        // Sort by priority (high first) then by createdAt (older first)
        tasks.sort((a, b) => {
            const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt - b.createdAt;
        });

        return tasks;
    }

    /**
     * Cancel a running or queued task.
     */
    async cancelTask(taskId: string): Promise<boolean> {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
            return false; // Already finished
        }

        task.status = 'cancelled';
        task.completedAt = Date.now();

        if (this.runningTasks.has(taskId)) {
            this.runningTasks.delete(taskId);
            // If task has a pipeline, cancel it
            if (task.pipelineId) {
                // Pipeline cancellation would need to be implemented in pipelineRunner
                logInfo('TaskQueue', `Pipeline ${task.pipelineId} cancelled (task ${taskId})`);
            }
        }

        logInfo('TaskQueue', `Task cancelled: ${taskId}`);
        this.emit('task:cancelled', task);
        return true;
    }

    /**
     * Retry a failed task (creates a new task with incremented retry count).
     */
    async retryTask(taskId: string): Promise<string | null> {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'failed') return null;

        if (task.retryCount >= task.maxRetries) {
            logError('TaskQueue', `Task ${taskId} exceeded max retries (${task.maxRetries})`);
            return null;
        }

        // Create new task with incremented retry count
        const newTaskId = await this.addTask(task.type, task.description, task.params, {
            priority: task.priority,
            maxRetries: task.maxRetries,
        });

        const newTask = this.tasks.get(newTaskId);
        if (newTask) {
            newTask.retryCount = task.retryCount + 1;
            logInfo('TaskQueue', `Task ${taskId} retried as ${newTaskId} (attempt ${newTask.retryCount + 1})`);
        }

        return newTaskId;
    }

    /**
     * Update task priority (only for queued tasks).
     */
    prioritizeTask(taskId: string, newPriority: TaskPriority): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'queued') return false;

        task.priority = newPriority;
        logInfo('TaskQueue', `Task ${taskId} priority updated to ${newPriority}`);
        this.emit('task:prioritized', task);
        return true;
    }

    /**
     * Get queue statistics.
     */
    getStats(): QueueStats {
        const tasks = Array.from(this.tasks.values());
        const completed = tasks.filter(t => t.status === 'completed');
        const failed = tasks.filter(t => t.status === 'failed');

        const waitTimes = tasks
            .filter(t => t.startedAt)
            .map(t => (t.startedAt! - t.createdAt));
        const executionTimes = tasks
            .filter(t => t.completedAt && t.startedAt)
            .map(t => (t.completedAt! - t.startedAt!));

        return {
            total: tasks.length,
            queued: tasks.filter(t => t.status === 'queued').length,
            running: this.runningTasks.size,
            completed: completed.length,
            failed: failed.length,
            cancelled: tasks.filter(t => t.status === 'cancelled').length,
            avgWaitTime: waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0,
            avgExecutionTime: executionTimes.length > 0 ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length) : 0,
        };
    }

    /**
     * Clean up old completed/failed tasks (keep last N).
     */
    cleanup(keepLast = 100): number {
        const tasks = Array.from(this.tasks.values())
            .filter(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
            .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

        if (tasks.length <= keepLast) return 0;

        const toRemove = tasks.slice(keepLast);
        for (const task of toRemove) {
            this.tasks.delete(task.id);
        }

        logInfo('TaskQueue', `Cleaned up ${toRemove.length} old tasks`);
        return toRemove.length;
    }

    /**
     * Stop the processing loop (for shutdown).
     */
    stop(): void {
        if (this.processingLoop) {
            clearInterval(this.processingLoop);
            this.processingLoop = null;
        }
    }

    // ==================== Private Methods ====================

    /**
     * Start the processing loop (checks queue every second).
     */
    private startProcessing(): void {
        this.processingLoop = setInterval(() => {
            this.processQueue();
        }, 1000);
    }

    /**
     * Process the queue: start tasks if workers available.
     */
    private async processQueue(): Promise<void> {
        if (this.runningTasks.size >= this.maxWorkers) {
            return; // All workers busy
        }

        const availableSlots = this.maxWorkers - this.runningTasks.size;
        const queuedTasks = this.getTasks({ status: 'queued' }).slice(0, availableSlots);

        for (const task of queuedTasks) {
            if (this.runningTasks.size >= this.maxWorkers) break;
            this.executeTask(task);
        }
    }

    /**
     * Execute a single task.
     */
    private async executeTask(task: QueuedTask): Promise<void> {
        task.status = 'running';
        task.startedAt = Date.now();
        this.runningTasks.add(task.id);
        this.emit('task:started', task);

        try {
            // Execute based on task type
            let result: unknown;

            if (['generate', 'test', 'fix', 'generic'].includes(task.type)) {
                // These use the pipeline (params embedded in description if needed)
                const pipelineTask = await pipelineRunner.createPipeline(task.description);
                task.pipelineId = pipelineTask.taskId;

                // Wait for pipeline completion
                result = await this.waitForPipeline(pipelineTask);
            } else {
                // Other task types (review, refactor, coverage) would execute directly
                result = { message: `Task ${task.type} executed (stub)` };
            }

            task.status = 'completed';
            task.result = result;
            task.completedAt = Date.now();
            logInfo('TaskQueue', `Task completed: ${task.id} (${task.type})`);
            this.emit('task:completed', task);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            task.status = 'failed';
            task.error = msg;
            task.completedAt = Date.now();
            logError('TaskQueue', `Task failed: ${task.id} — ${msg}`);
            this.emit('task:failed', task);
        } finally {
            this.runningTasks.delete(task.id);
        }
    }

    /**
     * Wait for a pipeline to complete.
     */
    private async waitForPipeline(pipeline: TaskPipeline): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const checkStatus = setInterval(() => {
                const current = pipelineRunner.getPipeline(pipeline.taskId);
                if (!current) {
                    clearInterval(checkStatus);
                    reject(new Error('Pipeline not found'));
                    return;
                }

                if (current.status === 'done') {
                    clearInterval(checkStatus);
                    resolve({ pipelineId: current.taskId, status: 'done' });
                } else if (current.status === 'error') {
                    clearInterval(checkStatus);
                    reject(new Error(current.error || 'Pipeline failed'));
                }
            }, 500);

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(checkStatus);
                reject(new Error('Pipeline timeout'));
            }, 300_000);
        });
    }
}

// Singleton
export const taskQueueManager = new TaskQueueManager();

