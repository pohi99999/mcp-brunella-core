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
import { createRobotkezRoutes } from '@apps/mcp-core/server/routes/robotkez.js';
import { generateExecutionPlan } from '@packages/utils/llmPlanner.js';
import { getRobotkezBrowserEngine } from '@packages/utils/browserEngine.js';

// Spies for agent methods
export const mockExecute = vi.fn().mockResolvedValue({ success: true, message: 'Task executed' });
export const mockExecuteTask = vi.fn().mockResolvedValue({ success: true, message: 'Task executed' });

// Mock RAG utilities
vi.mock('@packages/utils/rag.js', () => ({
    searchRAG: vi.fn().mockResolvedValue([]),
    addToIndex: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock('@packages/agents/RobotkezV2Agent.js', () => ({
    RobotkezV2Agent: class {
        name = 'RobotkezV2';
        role = 'Magyar Agentic Browser';
        capabilities = ['agentic_browsing', 'magyar_nyelv'];
        execute = mockExecute;
        executeTask = mockExecuteTask;
    }
}));

vi.mock('@packages/utils/llmPlanner.js', () => ({
    generateExecutionPlan: vi.fn().mockResolvedValue({
        plan: [{ action: 'navigate', url: 'https://test.com', description: 'Test' }],
        estimatedDuration: 5000,
        backgroundEligible: false
    })
}));

vi.mock('@packages/utils/browserEngine.js', () => ({
    getRobotkezBrowserEngine: vi.fn().mockReturnValue({
        isConnected: vi.fn().mockReturnValue(true),
        sendCommand: vi.fn().mockResolvedValue({ status: 'success' })
    }),
    getRobotkezEngineName: vi.fn().mockReturnValue('local')
}));

vi.mock('@packages/utils/persistentBrowser.js', () => ({
    persistentBrowser: {
        sendCommand: vi.fn().mockResolvedValue({ status: 'success' })
    }
}));

vi.mock('@packages/utils/backgroundTaskManager.js', () => ({
    backgroundTaskManager: {
        getAllTasks: vi.fn().mockReturnValue([]),
        getTaskStatus: vi.fn().mockReturnValue(null),
        cancelTask: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('@packages/utils/logger.js', () => ({
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
            mockReq.body = { instruction: '  Test instruction  ' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/chat' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith({
                success: true,
                message: 'Task executed'
            });
            expect(mockExecute).toHaveBeenCalledWith('Test instruction', expect.any(Object));
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
            mockReq.body = { instruction: '  Navigate to google.com  ' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/plan' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                plan: expect.any(Object)
            }));
            expect(generateExecutionPlan).toHaveBeenCalledWith('Navigate to google.com');
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
                error: 'Missing or invalid "action" field'
            });
        });

        it('should execute action with valid params', async () => {
            mockReq.body = { action: '  navigate  ', url: 'https://test.com' };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/exec' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('navigate')
            }));
            expect(getRobotkezBrowserEngine().sendCommand).toHaveBeenCalledWith({
                action: 'navigate',
                url: 'https://test.com'
            });
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

    describe('POST /computer/click-pct', () => {
        it('should reject out-of-range percentage coordinates', async () => {
            mockReq.body = { x_pct: 1.4, y_pct: 0.5 };

            const handler = router.stack.find((s: any) =>
                s.route?.path === '/computer/click-pct' && s.route.methods.post
            ).route.stack[0].handle;

            await handler(mockReq, mockRes);

            expect(statusSpy).toHaveBeenCalledWith(400);
            expect(jsonSpy).toHaveBeenCalledWith({
                success: false,
                error: 'x_pct és y_pct megadása kötelező (0.0-1.0)'
            });
        });
    });
});
