import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineRunner } from '../src/agents/developerPipeline.js';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));

describe('PipelineRunner', () => {
    let runner: PipelineRunner;

    beforeEach(() => {
        runner = new PipelineRunner();
    });

    describe('createPipeline', () => {
        it('should create a pipeline with 5 phases', () => {
            const pipeline = runner.createPipeline('generate a utility module');

            expect(pipeline.taskId).toMatch(/^dev-\d+-\d+$/);
            expect(pipeline.task).toBe('generate a utility module');
            expect(pipeline.status).toBe('queued');
            expect(pipeline.phases).toHaveLength(5);
            expect(pipeline.phases.map(p => p.id)).toEqual([
                'plan', 'generate', 'validate', 'save', 'test'
            ]);
            expect(pipeline.phases.every(p => p.status === 'pending')).toBe(true);
        });

        it('should generate unique task IDs', () => {
            const p1 = runner.createPipeline('task 1');
            const p2 = runner.createPipeline('task 2');

            expect(p1.taskId).not.toBe(p2.taskId);
        });
    });

    describe('getPipeline', () => {
        it('should return a pipeline by taskId', () => {
            const created = runner.createPipeline('test task');
            const fetched = runner.getPipeline(created.taskId);

            expect(fetched).toBeDefined();
            expect(fetched!.taskId).toBe(created.taskId);
        });

        it('should return undefined for non-existent taskId', () => {
            const result = runner.getPipeline('non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('startPhase', () => {
        it('should mark phase as running and update pipeline status', () => {
            const pipeline = runner.createPipeline('test');
            runner.startPhase(pipeline.taskId, 'plan');

            const updated = runner.getPipeline(pipeline.taskId)!;
            expect(updated.status).toBe('planning');
            const planPhase = updated.phases.find(p => p.id === 'plan');
            expect(planPhase!.status).toBe('running');
            expect(planPhase!.startedAt).toBeDefined();
        });

        it('should emit progress event', () => {
            const emitSpy = vi.fn();
            runner.on('progress', emitSpy);

            const pipeline = runner.createPipeline('test');
            runner.startPhase(pipeline.taskId, 'plan');

            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
                taskId: pipeline.taskId,
                phaseId: 'plan',
                status: 'running',
            }));
        });
    });

    describe('completePhase', () => {
        it('should mark phase as done', () => {
            const pipeline = runner.createPipeline('test');
            runner.startPhase(pipeline.taskId, 'plan');
            runner.completePhase(pipeline.taskId, 'plan');

            const updated = runner.getPipeline(pipeline.taskId)!;
            const planPhase = updated.phases.find(p => p.id === 'plan');
            expect(planPhase!.status).toBe('done');
            expect(planPhase!.completedAt).toBeDefined();
        });
    });

    describe('failPhase', () => {
        it('should mark phase as error with message', () => {
            const pipeline = runner.createPipeline('test');
            runner.startPhase(pipeline.taskId, 'generate');
            runner.failPhase(pipeline.taskId, 'generate', 'LLM timeout');

            const updated = runner.getPipeline(pipeline.taskId)!;
            expect(updated.status).toBe('error');
            expect(updated.error).toBe('LLM timeout');
            const phase = updated.phases.find(p => p.id === 'generate');
            expect(phase!.status).toBe('error');
            expect(phase!.error).toBe('LLM timeout');
        });
    });

    describe('skipPhase', () => {
        it('should mark phase as skipped', () => {
            const pipeline = runner.createPipeline('test');
            runner.skipPhase(pipeline.taskId, 'test');

            const updated = runner.getPipeline(pipeline.taskId)!;
            const phase = updated.phases.find(p => p.id === 'test');
            expect(phase!.status).toBe('skipped');
        });
    });

    describe('completePipeline', () => {
        it('should mark pipeline as done with completedAt', () => {
            const pipeline = runner.createPipeline('test');
            runner.completePipeline(pipeline.taskId);

            const updated = runner.getPipeline(pipeline.taskId)!;
            expect(updated.status).toBe('done');
            expect(updated.completedAt).toBeDefined();
        });
    });

    describe('getHistory', () => {
        it('should return all pipelines', () => {
            runner.createPipeline('task A');
            runner.createPipeline('task B');
            runner.createPipeline('task C');

            const history = runner.getHistory(10);
            expect(history).toHaveLength(3);
        });

        it('should respect limit parameter', () => {
            for (let i = 0; i < 10; i++) {
                runner.createPipeline(`task ${i}`);
            }

            const history = runner.getHistory(3);
            expect(history).toHaveLength(3);
        });
    });

    describe('cleanup', () => {
        it('should remove old pipelines beyond keepLast count', () => {
            // Create 5 pipelines
            for (let i = 0; i < 5; i++) {
                runner.createPipeline(`task ${i}`);
            }

            const removed = runner.cleanup(3); // Keep last 3
            expect(removed).toBe(2);

            const history = runner.getHistory(10);
            expect(history).toHaveLength(3);
        });

        it('should not remove anything if under keepLast limit', () => {
            runner.createPipeline('task A');
            runner.createPipeline('task B');

            const removed = runner.cleanup(50); // default keepLast
            expect(removed).toBe(0);
        });
    });

    describe('full pipeline lifecycle', () => {
        it('should progress through all phases', () => {
            const pipeline = runner.createPipeline('build a REST API');
            const phases = ['plan', 'generate', 'validate', 'save', 'test'] as const;

            for (const phase of phases) {
                runner.startPhase(pipeline.taskId, phase);
                runner.completePhase(pipeline.taskId, phase);
            }
            runner.completePipeline(pipeline.taskId);

            const final = runner.getPipeline(pipeline.taskId)!;
            expect(final.status).toBe('done');
            expect(final.completedAt).toBeDefined();
            expect(final.phases.every(p => p.status === 'done')).toBe(true);
        });
    });
});
