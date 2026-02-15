/**
 * Background Task Manager Unit Tests
 *
 * Test Coverage:
 * - Task creation and lifecycle (running → completed/error/cancelled)
 * - Progress tracking
 * - Checkpoint system (Phoenix Protocol)
 * - Error handling (critical vs non-critical errors)
 * - Task cancellation
 * - Checkpoint recovery (replay)
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 4 - Background Task Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { backgroundTaskManager, BackgroundTask, TaskStatus } from '../src/utils/backgroundTaskManager.js';
import { ExecutionPlan } from '../src/utils/llmPlanner.js';
import * as persistentBrowserModule from '../src/utils/persistentBrowser.js';

// Mock persistentBrowser
const mockSendCommand = vi.fn();
vi.mock('../src/utils/persistentBrowser.js', () => ({
    persistentBrowser: {
        sendCommand: (...args: any[]) => mockSendCommand(...args)
    }
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn()
}));

// Mock tasksDb (Phase 4.2 persistence)
vi.mock('../src/utils/tasksDb.js', () => ({
    saveBackgroundTask: vi.fn().mockResolvedValue(undefined),
    updateBackgroundTask: vi.fn().mockResolvedValue(undefined),
    loadBackgroundTask: vi.fn().mockResolvedValue(null),
    loadAllBackgroundTasks: vi.fn().mockResolvedValue([])
}));

describe('BackgroundTaskManager (Phase 4)', () => {
    beforeEach(() => {
        mockSendCommand.mockClear();
        mockSendCommand.mockResolvedValue({ status: 'success' });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Task Creation and Lifecycle', () => {
        it('should create and start a background task', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://google.com', description: 'Google megnyitása' },
                    { action: 'screenshot', description: 'Képernyőkép' }
                ],
                estimatedDuration: 10000,
                backgroundEligible: false
            };

            const taskId = await backgroundTaskManager.startTask('Keress rá az AI hírekre', plan);

            expect(taskId).toBeDefined();
            expect(taskId).toContain('task_');

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task).toBeDefined();
            expect(task!.instruction).toBe('Keress rá az AI hírekre');
            expect(task!.plan).toEqual(plan);
            expect(task!.status).toBe('running');
            expect(task!.progress).toBeGreaterThanOrEqual(0);
        });

        it('should complete task successfully when all steps succeed', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Test' },
                    { action: 'screenshot', description: 'Screenshot' }
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Test task', plan);

            // Wait for task to complete (async execution)
            await new Promise(resolve => setTimeout(resolve, 200));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task!.status).toBe('completed');
            expect(task!.progress).toBe(100);
            expect(task!.steps).toHaveLength(2);
            expect(task!.completedAt).toBeDefined();
        });

        it('should track progress correctly during execution', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'click', selector: '.button', description: 'Step 2' },
                    { action: 'screenshot', description: 'Step 3' }
                ],
                estimatedDuration: 10000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Multi-step task', plan);

            // Wait for partial completion
            await new Promise(resolve => setTimeout(resolve, 100));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            // Progress should be updating
            expect(task!.progress).toBeGreaterThanOrEqual(0);
            expect(task!.progress).toBeLessThanOrEqual(100);
        });

        it('should mark task as error when critical step fails', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Navigate' },
                    { action: 'click', selector: '.nonexistent', description: 'Click (will fail)' }
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            // First step succeeds, second step fails
            mockSendCommand
                .mockResolvedValueOnce({ status: 'success' })
                .mockRejectedValueOnce(new Error('Selector not found'));

            const taskId = await backgroundTaskManager.startTask('Failing task', plan);

            // Wait for task to fail
            await new Promise(resolve => setTimeout(resolve, 200));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task!.status).toBe('error');
            expect(task!.error).toContain('Critical step failed');
            expect(task!.steps).toHaveLength(2); // Both steps recorded (1 success, 1 error)
            expect(task!.steps[1].status).toBe('error');
        });

        it('should continue on non-critical errors (screenshot, scroll)', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Navigate' },
                    { action: 'screenshot', description: 'Screenshot (will fail)' },
                    { action: 'scroll', description: 'Scroll' }
                ],
                estimatedDuration: 8000,
                backgroundEligible: false
            };

            mockSendCommand
                .mockResolvedValueOnce({ status: 'success' }) // navigate
                .mockRejectedValueOnce(new Error('Screenshot failed')) // screenshot fails
                .mockResolvedValueOnce({ status: 'success' }); // scroll

            const taskId = await backgroundTaskManager.startTask('Non-critical error task', plan);

            await new Promise(resolve => setTimeout(resolve, 250));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            // Should complete despite screenshot error
            expect(task!.status).toBe('completed');
            expect(task!.steps).toHaveLength(3);
            expect(task!.steps[1].status).toBe('error'); // Screenshot step failed
            expect(task!.steps[2].status).toBe('completed'); // But scroll continued
        });
    });

    describe('Task Cancellation', () => {
        it('should cancel a running task', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'wait', selector: 'body', timeout: 10000, description: 'Long wait' }
                ],
                estimatedDuration: 15000,
                backgroundEligible: true
            };

            mockSendCommand.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 100)));

            const taskId = await backgroundTaskManager.startTask('Long task', plan);

            // Cancel immediately
            const cancelled = backgroundTaskManager.cancelTask(taskId);
            expect(cancelled).toBe(true);

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task!.status).toBe('cancelled');
            expect(task!.completedAt).toBeDefined();
        });

        it('should return false when cancelling non-running task', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'screenshot', description: 'Screenshot' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            const taskId = await backgroundTaskManager.startTask('Quick task', plan);

            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 150));

            // Try to cancel completed task
            const cancelled = backgroundTaskManager.cancelTask(taskId);
            expect(cancelled).toBe(false);
        });

        it('should return false when cancelling non-existent task', () => {
            const cancelled = backgroundTaskManager.cancelTask('non_existent_task_id');
            expect(cancelled).toBe(false);
        });
    });

    describe('Checkpoint System (Phoenix Protocol)', () => {
        it('should create checkpoint every 3 steps', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'click', selector: '.button1', description: 'Step 2' },
                    { action: 'type', selector: 'input', text: 'text', description: 'Step 3' },
                    { action: 'click', selector: '.button2', description: 'Step 4' }
                ],
                estimatedDuration: 12000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Checkpoint task', plan);

            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 300));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task!.checkpoints).toHaveLength(1); // Checkpoint after step 3
            expect(task!.checkpoints[0].stepIndex).toBe(2); // Index 2 = 3rd step
            expect(task!.checkpoints[0].completedSteps).toHaveLength(3);
        });

        it('should load last checkpoint', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'click', selector: '.b1', description: 'Step 2' },
                    { action: 'type', selector: 'input', text: 't', description: 'Step 3' }
                ],
                estimatedDuration: 9000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Checkpoint load test', plan);
            await new Promise(resolve => setTimeout(resolve, 250));

            const checkpoint = backgroundTaskManager.loadLastCheckpoint(taskId);
            expect(checkpoint).toBeDefined();
            expect(checkpoint!.stepIndex).toBe(2); // 3rd step (index 2)
        });

        it('should return null when loading checkpoint from task with no checkpoints', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Only 1 step' }
                ],
                estimatedDuration: 3000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('No checkpoint task', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            const checkpoint = backgroundTaskManager.loadLastCheckpoint(taskId);
            expect(checkpoint).toBeNull(); // No checkpoint created (< 3 steps)
        });

        it('should replay steps from last checkpoint', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'click', selector: '.b1', description: 'Step 2' },
                    { action: 'type', selector: 'input', text: 't', description: 'Step 3' },
                    { action: 'click', selector: '.b2', description: 'Step 4' }
                ],
                estimatedDuration: 12000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Replay test', plan);
            await new Promise(resolve => setTimeout(resolve, 250));

            // Simulate crash/error after checkpoint
            const task = backgroundTaskManager.getTaskStatus(taskId);
            task!.status = 'error';

            // Replay from checkpoint
            const replayed = await backgroundTaskManager.replaySteps(taskId);
            expect(replayed).toBe(true);

            // Wait for replay to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            const replayedTask = backgroundTaskManager.getTaskStatus(taskId);
            expect(replayedTask!.status).toBe('completed'); // Should complete after replay
        });
    });

    describe('Task Retrieval', () => {
        it('should get task status by ID', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'screenshot', description: 'Test' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            const taskId = await backgroundTaskManager.startTask('Status test', plan);
            const task = backgroundTaskManager.getTaskStatus(taskId);

            expect(task).toBeDefined();
            expect(task!.id).toBe(taskId);
        });

        it('should return null for non-existent task', () => {
            const task = backgroundTaskManager.getTaskStatus('non_existent_id');
            expect(task).toBeNull();
        });

        it('should get all tasks sorted by startedAt desc', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'screenshot', description: 'Test' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            const taskId1 = await backgroundTaskManager.startTask('Task 1', plan);
            await new Promise(resolve => setTimeout(resolve, 50)); // Ensure different timestamps
            const taskId2 = await backgroundTaskManager.startTask('Task 2', plan);

            const allTasks = backgroundTaskManager.getAllTasks();
            expect(allTasks.length).toBeGreaterThanOrEqual(2);
            // Most recent task should be first
            expect(allTasks[0].id).toBe(taskId2);
        });
    });

    describe('Step Execution', () => {
        it('should execute navigate action correctly', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'navigate', url: 'https://example.com', description: 'Navigate' }],
                estimatedDuration: 3000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Navigate test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'navigate',
                url: 'https://example.com'
            });
        });

        it('should execute click action correctly', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'click', selector: '.my-button', description: 'Click' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Click test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'click',
                selector: '.my-button'
            });
        });

        it('should execute type action correctly', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'type', selector: 'input#email', text: 'test@example.com', description: 'Type' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Type test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'type',
                selector: 'input#email',
                text: 'test@example.com'
            });
        });

        it('should execute scroll with default values', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'scroll', description: 'Scroll' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Scroll test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'scroll',
                direction: 'down',
                amount: 300
            });
        });

        it('should execute wait action correctly', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'wait', selector: 'h1', timeout: 8000, description: 'Wait' }],
                estimatedDuration: 10000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Wait test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'wait',
                selector: 'h1',
                timeout: 8000
            });
        });

        it('should execute extract action with defaults', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'extract', selector: '.content', description: 'Extract' }],
                estimatedDuration: 3000,
                backgroundEligible: false
            };

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Extract test', plan);
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'extract',
                selector: '.content',
                type: 'text',
                attribute: undefined
            });
        });
    });

    describe('Database Persistence (Phase 4.2)', () => {
        it('should save task to database on creation', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'navigate', url: 'https://test.com', description: 'Test' }],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            const tasksDb = await import('../src/utils/tasksDb.js');
            const saveBackgroundTaskSpy = vi.spyOn(tasksDb, 'saveBackgroundTask');

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('DB test', plan);

            // Should have called saveBackgroundTask
            expect(saveBackgroundTaskSpy).toHaveBeenCalled();
            const savedTask = saveBackgroundTaskSpy.mock.calls[0][0];
            expect(savedTask.id).toBe(taskId);
            expect(savedTask.instruction).toBe('DB test');
        });

        it('should update task in database on progress change', async () => {
            const plan: ExecutionPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'screenshot', description: 'Step 2' }
                ],
                estimatedDuration: 5000,
                backgroundEligible: false
            };

            const tasksDb = await import('../src/utils/tasksDb.js');
            const updateBackgroundTaskSpy = vi.spyOn(tasksDb, 'updateBackgroundTask');

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Progress test', plan);

            // Wait for at least one step to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should have called updateBackgroundTask for progress
            expect(updateBackgroundTaskSpy).toHaveBeenCalled();
        });

        it('should update task in database on completion', async () => {
            const plan: ExecutionPlan = {
                plan: [{ action: 'screenshot', description: 'Quick task' }],
                estimatedDuration: 2000,
                backgroundEligible: false
            };

            const tasksDb = await import('../src/utils/tasksDb.js');
            const updateBackgroundTaskSpy = vi.spyOn(tasksDb, 'updateBackgroundTask');

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const taskId = await backgroundTaskManager.startTask('Completion test', plan);

            // Wait for completion
            await new Promise(resolve => setTimeout(resolve, 200));

            const task = backgroundTaskManager.getTaskStatus(taskId);
            expect(task!.status).toBe('completed');

            // Should have updated DB
            expect(updateBackgroundTaskSpy).toHaveBeenCalled();
        });

        it('should initialize and recover tasks from database', async () => {
            const tasksDb = await import('../src/utils/tasksDb.js');

            const mockRecoveredTask = {
                id: 'recovered_task_123',
                instruction: 'Recovered task',
                plan: {
                    plan: [{ action: 'navigate', url: 'https://test.com', description: 'Test' }],
                    estimatedDuration: 5000,
                    backgroundEligible: false
                },
                status: 'running',
                progress: 50,
                startedAt: Date.now() - 10000,
                steps: [],
                currentStepIndex: 0,
                checkpoints: []
            };

            vi.spyOn(tasksDb, 'loadAllBackgroundTasks').mockResolvedValue([mockRecoveredTask]);

            await backgroundTaskManager.initialize();

            const task = backgroundTaskManager.getTaskStatus('recovered_task_123');
            expect(task).toBeDefined();
            expect(task!.instruction).toBe('Recovered task');
            expect(task!.status).toBe('running');
        });
    });
});
