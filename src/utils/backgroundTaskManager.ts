/**
 * Background Task Manager
 *
 * Manages long-running browser automation tasks in the background.
 * Tasks > 30s estimated duration are executed asynchronously with:
 * - Progress tracking
 * - Checkpoint-based recovery (Phoenix Protocol)
 * - Real-time status updates (Socket.IO)
 *
 * @author Claude Code + Pohánka Péter
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 4 - Background Task Manager
 */

import { persistentBrowser } from './persistentBrowser.js';
import { ExecutionPlan, ExecutionStep } from './llmPlanner.js';
import { logInfo, logWarn, logError } from './logger.js';

/**
 * Background Task Status
 */
export type TaskStatus = 'running' | 'completed' | 'error' | 'cancelled';

/**
 * Task Step (completed step with status)
 */
export interface TaskStep extends ExecutionStep {
    status: 'completed' | 'error';
    error?: string;
    completedAt?: number; // timestamp
}

/**
 * Background Task Interface
 */
export interface BackgroundTask {
    id: string;
    instruction: string; // Original magyar instruction
    plan: ExecutionPlan;
    status: TaskStatus;
    progress: number; // 0-100
    startedAt: number; // timestamp
    completedAt?: number; // timestamp
    steps: TaskStep[]; // Completed steps
    currentStepIndex: number;
    error?: string;
    checkpoints: TaskCheckpoint[]; // Phoenix recovery checkpoints
}

/**
 * Task Checkpoint (Phoenix Protocol)
 * Created every 3 steps for recovery
 */
export interface TaskCheckpoint {
    stepIndex: number;
    timestamp: number;
    completedSteps: TaskStep[];
}

/**
 * Background Task Manager
 * Singleton class managing async browser automation tasks
 */
class BackgroundTaskManager {
    private tasks: Map<string, BackgroundTask> = new Map();
    private runningTasks: Set<string> = new Set();

    /**
     * Start a new background task
     *
     * @param instruction - Original magyar instruction
     * @param plan - ExecutionPlan from LLM
     * @returns Task ID
     */
    async startTask(instruction: string, plan: ExecutionPlan): Promise<string> {
        const taskId = this.generateTaskId();

        const task: BackgroundTask = {
            id: taskId,
            instruction,
            plan,
            status: 'running',
            progress: 0,
            startedAt: Date.now(),
            steps: [],
            currentStepIndex: 0,
            checkpoints: []
        };

        this.tasks.set(taskId, task);
        this.runningTasks.add(taskId);

        logInfo('BackgroundTaskManager', `▶️ Started task ${taskId}: "${instruction}" (${plan.plan.length} steps)`);

        // Execute in background (non-blocking)
        this.executeTaskInBackground(taskId).catch((error) => {
            logError('BackgroundTaskManager', `Task ${taskId} failed: ${error.message}`);
            this.updateTaskStatus(taskId, 'error', error.message);
        });

        return taskId;
    }

    /**
     * Get task status
     *
     * @param taskId - Task ID
     * @returns BackgroundTask or null if not found
     */
    getTaskStatus(taskId: string): BackgroundTask | null {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Get all tasks (sorted by startedAt desc)
     *
     * @returns Array of BackgroundTask
     */
    getAllTasks(): BackgroundTask[] {
        return Array.from(this.tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
    }

    /**
     * Cancel a running task
     *
     * @param taskId - Task ID
     * @returns boolean - true if cancelled, false if not running
     */
    cancelTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'running') {
            return false;
        }

        task.status = 'cancelled';
        task.completedAt = Date.now();
        this.runningTasks.delete(taskId);

        logWarn('BackgroundTaskManager', `❌ Task ${taskId} cancelled by user`);
        return true;
    }

    /**
     * Execute task in background (async)
     * Non-blocking - runs independently of main thread
     *
     * @param taskId - Task ID
     */
    private async executeTaskInBackground(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const { plan } = task;

        try {
            for (let i = 0; i < plan.plan.length; i++) {
                // Check if task was cancelled
                if (task.status === 'cancelled') {
                    logWarn('BackgroundTaskManager', `Task ${taskId} cancelled at step ${i}`);
                    break;
                }

                const step = plan.plan[i];
                task.currentStepIndex = i;

                logInfo('BackgroundTaskManager', `▶️ Task ${taskId} - Step ${i + 1}/${plan.plan.length}: ${step.description}`);

                try {
                    // Execute step
                    await this.executeStep(step);

                    // Mark step as completed
                    const completedStep: TaskStep = {
                        ...step,
                        status: 'completed',
                        completedAt: Date.now()
                    };
                    task.steps.push(completedStep);

                    // Update progress (percentage)
                    task.progress = Math.round(((i + 1) / plan.plan.length) * 100);

                    logInfo('BackgroundTaskManager', `✅ Task ${taskId} - Step ${i + 1} completed (${task.progress}%)`);

                    // Create checkpoint every 3 steps (Phoenix Protocol)
                    if ((i + 1) % 3 === 0) {
                        this.createCheckpoint(taskId, i, task.steps);
                    }

                } catch (stepError: any) {
                    logError('BackgroundTaskManager', `❌ Task ${taskId} - Step ${i + 1} failed: ${stepError.message}`);

                    const errorStep: TaskStep = {
                        ...step,
                        status: 'error',
                        error: stepError.message,
                        completedAt: Date.now()
                    };
                    task.steps.push(errorStep);

                    // Decide: continue or stop on error?
                    // For now: stop on critical errors (navigate, click, type)
                    if (['navigate', 'click', 'type'].includes(step.action)) {
                        throw new Error(`Critical step failed: ${step.description} - ${stepError.message}`);
                    }
                    // Non-critical errors (screenshot, scroll): continue
                    logWarn('BackgroundTaskManager', `⚠️ Non-critical error, continuing...`);
                }
            }

            // All steps completed successfully
            this.updateTaskStatus(taskId, 'completed');
            logInfo('BackgroundTaskManager', `✅ Task ${taskId} completed (${task.steps.length} steps)`);

        } catch (error: any) {
            logError('BackgroundTaskManager', `❌ Task ${taskId} failed: ${error.message}`);
            this.updateTaskStatus(taskId, 'error', error.message);
        }
    }

    /**
     * Execute a single step (browser action)
     *
     * @param step - ExecutionStep
     */
    private async executeStep(step: ExecutionStep): Promise<void> {
        switch (step.action) {
            case 'navigate':
                await persistentBrowser.sendCommand({
                    action: 'navigate',
                    url: step.url!
                });
                break;

            case 'click':
                await persistentBrowser.sendCommand({
                    action: 'click',
                    selector: step.selector!
                });
                break;

            case 'type':
                await persistentBrowser.sendCommand({
                    action: 'type',
                    selector: step.selector!,
                    text: step.text!
                });
                break;

            case 'scroll':
                await persistentBrowser.sendCommand({
                    action: 'scroll',
                    direction: step.direction || 'down',
                    amount: step.amount || 300
                });
                break;

            case 'wait':
                await persistentBrowser.sendCommand({
                    action: 'wait',
                    selector: step.selector!,
                    timeout: step.timeout || 5000
                });
                break;

            case 'screenshot':
                await persistentBrowser.sendCommand({
                    action: 'screenshot'
                });
                break;

            case 'extract':
                await persistentBrowser.sendCommand({
                    action: 'extract',
                    selector: step.selector!,
                    type: step.type || 'text',
                    attribute: step.attribute
                });
                break;

            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }

    /**
     * Update task status
     *
     * @param taskId - Task ID
     * @param status - New status
     * @param error - Optional error message
     */
    private updateTaskStatus(taskId: string, status: TaskStatus, error?: string): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.status = status;
        task.completedAt = Date.now();
        if (error) {
            task.error = error;
        }

        this.runningTasks.delete(taskId);
    }

    /**
     * Create checkpoint (Phoenix Protocol)
     *
     * @param taskId - Task ID
     * @param stepIndex - Current step index
     * @param completedSteps - Completed steps so far
     */
    private createCheckpoint(taskId: string, stepIndex: number, completedSteps: TaskStep[]): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const checkpoint: TaskCheckpoint = {
            stepIndex,
            timestamp: Date.now(),
            completedSteps: [...completedSteps] // Deep copy
        };

        task.checkpoints.push(checkpoint);
        logInfo('BackgroundTaskManager', `📌 Checkpoint created for task ${taskId} at step ${stepIndex + 1}`);
    }

    /**
     * Load last checkpoint (Phoenix recovery)
     *
     * @param taskId - Task ID
     * @returns TaskCheckpoint or null if no checkpoints
     */
    loadLastCheckpoint(taskId: string): TaskCheckpoint | null {
        const task = this.tasks.get(taskId);
        if (!task || task.checkpoints.length === 0) {
            return null;
        }

        return task.checkpoints[task.checkpoints.length - 1];
    }

    /**
     * Replay steps from last checkpoint (Phoenix recovery)
     *
     * @param taskId - Task ID
     * @returns boolean - true if replay started, false if no checkpoint
     */
    async replaySteps(taskId: string): Promise<boolean> {
        const checkpoint = this.loadLastCheckpoint(taskId);
        if (!checkpoint) {
            logWarn('BackgroundTaskManager', `No checkpoint found for task ${taskId}`);
            return false;
        }

        const task = this.tasks.get(taskId);
        if (!task) return false;

        logInfo('BackgroundTaskManager', `🔄 Replaying task ${taskId} from step ${checkpoint.stepIndex + 1}`);

        // Restore task state from checkpoint
        task.steps = [...checkpoint.completedSteps];
        task.currentStepIndex = checkpoint.stepIndex + 1; // Resume from next step
        task.status = 'running';
        task.progress = Math.round(((checkpoint.stepIndex + 1) / task.plan.plan.length) * 100);

        this.runningTasks.add(taskId);

        // Continue execution from checkpoint
        this.executeTaskInBackground(taskId).catch((error) => {
            logError('BackgroundTaskManager', `Replay failed for task ${taskId}: ${error.message}`);
            this.updateTaskStatus(taskId, 'error', error.message);
        });

        return true;
    }

    /**
     * Generate unique task ID
     *
     * @returns string - UUID-like task ID
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}

// Export singleton instance
export const backgroundTaskManager = new BackgroundTaskManager();
