/**
 * RobotkezV2 REST API Tests
 *
 * Test Coverage:
 * - API endpoint responses
 * - Error handling (400, 404, 500)
 * - Request validation
 *
 * Note: These are integration tests that test the route handlers
 * directly without starting the full server.
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 5 - REST API Endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createRobotkezRoutes } from '../src/server/routes/robotkez.js';

// Spies for agent methods
export const mockExecute = vi.fn().mockResolvedValue({ success: true, message: 'Task executed' });
export const mockExecuteTask = vi.fn().mockResolvedValue({ success: true, message: 'Task executed' });

// Mock RAG utilities
vi.mock('../src/utils/rag.js', () => ({
    searchRAG: vi.fn().mockResolvedValue([]),
    addToIndex: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock('../src/agents/RobotkezV2Agent.js', () => ({
    RobotkezV2Agent: class {
        name = 'RobotkezV2';
        role = 'Magyar Agentic Browser';
        capabilities = ['agentic_browsing', 'magyar_nyelv'];
        execute = mockExecute;
        executeTask = mockExecuteTask;
    }
}));

vi.mock('../src/utils/llmPlanner.js', () => ({
    generateExecutionPlan: vi.fn().mockResolvedValue({
        plan: [{ action: 'navigate', url: 'https://test.com', description: 'Test' }],
        estimatedDuration: 5000,
        backgroundEligible: false
    })
}));

vi.mock('../src/utils/browserEngine.js', () => ({
    getRobotkezBrowserEngine: vi.fn().mockReturnValue({
        isConnected: vi.fn().mockReturnValue(true),
        sendCommand: vi.fn().mockResolvedValue({ status: 'success' })
    }),
    getRobotkezEngineName: vi.fn().mockReturnValue('local')
}));

vi.mock('../src/utils/persistentBrowser.js', () => ({
    persistentBrowser: {
        sendCommand: vi.fn().mockResolvedValue({ status: 'success' })
    }
}));

vi.mock('../src/utils/backgroundTaskManager.js', () => ({
    backgroundTaskManager: {
        getAllTasks: vi.fn().mockReturnValue([]),
        getTaskStatus: vi.fn().mockReturnValue(null),
        cancelTask: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn()
}));

describe('RobotkezV2 REST API (Phase 5)', () => {
    let router: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let jsonSpy: any;
    let statusSpy: any;

    beforeEach(() => {
        router = createRobotkezRoutes();

        jsonSpy = vi.fn();
        statusSpy = vi.fn(() => ({ json: jsonSpy }));

        mockReq = {
            body: {},
            params: {},
            query: {}
        };

        mockRes = {
            json: jsonSpy,
            status: statusSpy
        };

        vi.clearAllMocks();
    });

    describe('POST /chat', () => {
        it('should return 400 if instruction is missing', async () => {
            mockReq.body = {};

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/chat' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(jsonSpy).toHaveBeenCalledWith({
                success: false,
                error: 'Missing or invalid "instruction" field'
            });
        });

        it('should execute task with valid instruction', async () => {
            mockReq.body = { instruction: 'Test instruction' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/chat' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith({
                success: true,
                message: 'Task executed'
            });
        });
    });

    describe('POST /plan', () => {
        it('should return 400 if instruction is missing', async () => {
            mockReq.body = {};

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/plan' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(400);
        });

        it('should generate plan with valid instruction', async () => {
            mockReq.body = { instruction: 'Navigate to google.com' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/plan' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                plan: expect.any(Object)
            }));
        });
    });

    describe('POST /exec', () => {
        it('should return 400 if action is missing', async () => {
            mockReq.body = {};

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/exec' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(jsonSpy).toHaveBeenCalledWith({
                success: false,
                error: 'Missing "action" field'
            });
        });

        it('should execute action with valid params', async () => {
            mockReq.body = { action: 'navigate', url: 'https://test.com' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/exec' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('navigate')
            }));
        });
    });

    describe('GET /status', () => {
        it('should return agent and browser status', async () => {
            const handler = router.stack.find((s: any) =>
                s.route?.path === '/status' && s.route.methods.get
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                agent: expect.any(Object),
                browser: expect.any(Object),
                tasks: expect.any(Object)
            }));
        });
    });

    describe('GET /tasks', () => {
        it('should return tasks list', async () => {
            const handler = router.stack.find((s: any) =>
                s.route?.path === '/tasks' && s.route.methods.get
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                tasks: expect.any(Array),
                count: expect.any(Number)
            }));
        });
    });

    describe('GET /tasks/:id', () => {
        it('should return 404 if task not found', async () => {
            mockReq.params = { id: 'nonexistent' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/tasks/:id' && s.route.methods.get
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(404);
        });
    });

    describe('DELETE /tasks/:id', () => {
        it('should return 400 if task cannot be cancelled', async () => {
            mockReq.params = { id: 'test_id' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/tasks/:id' && s.route.methods.delete
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(400);
        });
    });
});
