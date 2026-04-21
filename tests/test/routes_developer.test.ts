import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDeveloperRoutes } from '../src/server/routes/developer.js';

// Mock pipelineRunner
vi.mock('../src/agents/developerPipeline.js', () => {
    const mockPhases = [
        { id: 'plan', label: 'Planning', status: 'pending' },
        { id: 'generate', label: 'Code Generation', status: 'pending' },
        { id: 'validate', label: 'Validation', status: 'pending' },
        { id: 'save', label: 'Save', status: 'pending' },
        { id: 'test', label: 'Testing', status: 'pending' },
    ];

    return {
        pipelineRunner: {
            createPipeline: vi.fn().mockReturnValue({
                taskId: 'dev-1234-1',
                task: 'test task',
                status: 'queued',
                phases: mockPhases,
                createdAt: Date.now(),
            }),
            getPipeline: vi.fn().mockImplementation((taskId: string) => {
                if (taskId === 'dev-1234-1') {
                    return {
                        taskId: 'dev-1234-1',
                        task: 'test task',
                        status: 'running',
                        phases: mockPhases,
                        createdAt: Date.now(),
                    };
                }
                return undefined;
            }),
            getHistory: vi.fn().mockReturnValue([
                { taskId: 'dev-1234-1', task: 'task 1', status: 'done', createdAt: Date.now() },
                { taskId: 'dev-1234-2', task: 'task 2', status: 'error', createdAt: Date.now() },
            ]),
            startPhase: vi.fn(),
            completePhase: vi.fn(),
            failPhase: vi.fn(),
            completePipeline: vi.fn(),
        },
    };
});

// Mock AgentManager
vi.mock('../src/agents/AgentManager.js', () => ({
    agentManager: {
        executeAgent: vi.fn().mockResolvedValue({
            status: 'success',
            data: { code: '// generated' },
        }),
    },
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn(),
}));

describe('Developer Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/v1/developer', createDeveloperRoutes());
    });

    describe('GET /api/v1/developer/status', () => {
        it('should return developer agent status', async () => {
            const response = await request(app).get('/api/v1/developer/status');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('activeTasks');
            expect(response.body).toHaveProperty('completedTasks');
            expect(response.body).toHaveProperty('totalTasks');
        });
    });

    describe('GET /api/v1/developer/history', () => {
        it('should return task history', async () => {
            const response = await request(app).get('/api/v1/developer/history?limit=10');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('history');
            expect(Array.isArray(response.body.history)).toBe(true);
            expect(response.body.history).toHaveLength(2);
        });
    });

    describe('GET /api/v1/developer/pipeline/:taskId', () => {
        it('should return pipeline for existing task', async () => {
            const response = await request(app).get('/api/v1/developer/pipeline/dev-1234-1');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('pipeline');
            expect(response.body.pipeline.taskId).toBe('dev-1234-1');
        });

        it('should return 404 for non-existent task', async () => {
            const response = await request(app).get('/api/v1/developer/pipeline/non-existent');

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/v1/developer/execute', () => {
        it('should create a pipeline and return taskId', async () => {
            const response = await request(app)
                .post('/api/v1/developer/execute')
                .send({ task: 'generate a REST API module' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('taskId');
            expect(response.body.status).toBe('queued');
        });

        it('should return 400 when task is missing', async () => {
            const response = await request(app)
                .post('/api/v1/developer/execute')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });
});
