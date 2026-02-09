// FILE: src/agents/developerPipeline.ts
// PURPOSE: Task Pipeline architecture for DeveloperAgent 3.0
// VERSION: 3.0

import { logInfo, logError } from '../utils/logger.js';
import { developerMetrics } from '../utils/developerMetrics.js';
import { EventEmitter } from 'events';

// ==================== Types ====================

export type PipelinePhaseId = 'plan' | 'generate' | 'validate' | 'save' | 'test';

export type PipelinePhaseStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface PipelinePhase {
    id: PipelinePhaseId;
    label: string;
    status: PipelinePhaseStatus;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    output?: unknown;
}

export type TaskStatus = 'queued' | 'planning' | 'generating' | 'validating' | 'saving' | 'testing' | 'done' | 'error';

export interface TaskPipeline {
    taskId: string;
    task: string;
    status: TaskStatus;
    phases: PipelinePhase[];
    createdAt: number;
    completedAt?: number;
    result?: unknown;
    error?: string;
}

export interface ProgressEvent {
    taskId: string;
    phaseId: PipelinePhaseId;
    status: PipelinePhaseStatus;
    overallStatus: TaskStatus;
    progress: number; // 0-100
    message: string;
    timestamp: number;
}

// Phase definitions in order
const PHASE_DEFINITIONS: Array<{ id: PipelinePhaseId; label: string }> = [
    { id: 'plan', label: 'Planning' },
    { id: 'generate', label: 'Generating' },
    { id: 'validate', label: 'Validating' },
    { id: 'save', label: 'Saving' },
    { id: 'test', label: 'Testing' },
];

// Map phase ID to task status
const PHASE_TO_STATUS: Record<PipelinePhaseId, TaskStatus> = {
    plan: 'planning',
    generate: 'generating',
    validate: 'validating',
    save: 'saving',
    test: 'testing',
};

// ==================== PipelineRunner ====================

/**
 * PipelineRunner manages task execution through phases with progress events.
 * Emits 'progress' events for real-time streaming (Socket.IO).
 */
export class PipelineRunner extends EventEmitter {
    private pipelines: Map<string, TaskPipeline> = new Map();
    private taskCounter = 0;

    /**
     * Create a new pipeline for a task
     */
    createPipeline(task: string): TaskPipeline {
        const taskId = `dev-${Date.now()}-${++this.taskCounter}`;
        const pipeline: TaskPipeline = {
            taskId,
            task,
            status: 'queued',
            phases: PHASE_DEFINITIONS.map(def => ({
                id: def.id,
                label: def.label,
                status: 'pending',
            })),
            createdAt: Date.now(),
        };

        this.pipelines.set(taskId, pipeline);
        logInfo('PipelineRunner', `Pipeline created: ${taskId} → "${task.slice(0, 60)}"`);
        return pipeline;
    }

    /**
     * Get pipeline by task ID
     */
    getPipeline(taskId: string): TaskPipeline | undefined {
        return this.pipelines.get(taskId);
    }

    /**
     * Get recent pipelines (for history)
     */
    getHistory(limit = 20): TaskPipeline[] {
        const all = Array.from(this.pipelines.values());
        return all
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    /**
     * Start a phase
     */
    startPhase(taskId: string, phaseId: PipelinePhaseId): void {
        const pipeline = this.pipelines.get(taskId);
        if (!pipeline) return;

        const phase = pipeline.phases.find(p => p.id === phaseId);
        if (!phase) return;

        phase.status = 'running';
        phase.startedAt = Date.now();
        pipeline.status = PHASE_TO_STATUS[phaseId];

        this.emitProgress(pipeline, phaseId, 'running', `${phase.label}...`);
    }

    /**
     * Complete a phase
     */
    completePhase(taskId: string, phaseId: PipelinePhaseId, output?: unknown): void {
        const pipeline = this.pipelines.get(taskId);
        if (!pipeline) return;

        const phase = pipeline.phases.find(p => p.id === phaseId);
        if (!phase) return;

        phase.status = 'done';
        phase.completedAt = Date.now();
        phase.output = output;

        this.emitProgress(pipeline, phaseId, 'done', `${phase.label} complete`);
    }

    /**
     * Fail a phase (and entire pipeline)
     */
    failPhase(taskId: string, phaseId: PipelinePhaseId, error: string): void {
        const pipeline = this.pipelines.get(taskId);
        if (!pipeline) return;

        const phase = pipeline.phases.find(p => p.id === phaseId);
        if (!phase) return;

        phase.status = 'error';
        phase.completedAt = Date.now();
        phase.error = error;

        pipeline.status = 'error';
        pipeline.error = error;
        pipeline.completedAt = Date.now();

        // P10: Record metrics
        developerMetrics.recordTask(taskId, false, pipeline.completedAt - pipeline.createdAt).catch(err => 
            console.error('Failed to record metrics:', err)
        );

        this.emitProgress(pipeline, phaseId, 'error', `Error: ${error.slice(0, 100)}`);
        logError('PipelineRunner', `Pipeline ${taskId} failed at ${phaseId}: ${error}`);
    }

    /**
     * Skip a phase
     */
    skipPhase(taskId: string, phaseId: PipelinePhaseId): void {
        const pipeline = this.pipelines.get(taskId);
        if (!pipeline) return;

        const phase = pipeline.phases.find(p => p.id === phaseId);
        if (!phase) return;

        phase.status = 'skipped';
        this.emitProgress(pipeline, phaseId, 'skipped', `${phase.label} skipped`);
    }

    /**
     * Mark pipeline as done
     */
    completePipeline(taskId: string, result?: unknown): void {
        const pipeline = this.pipelines.get(taskId);
        if (!pipeline) return;

        pipeline.status = 'done';
        pipeline.completedAt = Date.now();
        pipeline.result = result;

        const totalMs = pipeline.completedAt - pipeline.createdAt;
        
        // P10: Record metrics
        developerMetrics.recordTask(taskId, true, totalMs).catch(err => 
            console.error('Failed to record metrics:', err)
        );

        logInfo('PipelineRunner', `Pipeline ${taskId} done in ${totalMs}ms`);

        this.emitProgress(pipeline, 'test', 'done', `Task completed (${totalMs}ms)`);
    }

    /**
     * Calculate progress percentage (0-100)
     */
    private calculateProgress(pipeline: TaskPipeline): number {
        const total = pipeline.phases.length;
        const completed = pipeline.phases.filter(p => p.status === 'done' || p.status === 'skipped').length;
        const running = pipeline.phases.filter(p => p.status === 'running').length;
        return Math.round(((completed + running * 0.5) / total) * 100);
    }

    /**
     * Emit a progress event
     */
    private emitProgress(
        pipeline: TaskPipeline,
        phaseId: PipelinePhaseId,
        status: PipelinePhaseStatus,
        message: string
    ): void {
        const event: ProgressEvent = {
            taskId: pipeline.taskId,
            phaseId,
            status,
            overallStatus: pipeline.status,
            progress: this.calculateProgress(pipeline),
            message,
            timestamp: Date.now(),
        };

        this.emit('progress', event);
    }

    /**
     * Cleanup old pipelines (keep last N)
     */
    cleanup(keepLast = 50): number {
        const all = Array.from(this.pipelines.entries())
            .sort((a, b) => b[1].createdAt - a[1].createdAt);

        let removed = 0;
        for (let i = keepLast; i < all.length; i++) {
            this.pipelines.delete(all[i][0]);
            removed++;
        }
        return removed;
    }
}

// Singleton instance
export const pipelineRunner = new PipelineRunner();
