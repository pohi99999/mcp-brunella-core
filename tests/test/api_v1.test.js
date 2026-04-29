import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthRoutes } from '@apps/mcp-core/server/routes/health.js';
import { globalErrorHandler, asyncHandler } from '@apps/mcp-core/server/middleware/errorHandler.js';
import { AppError } from '@packages/utils/AppError.js';
// Mocks
vi.mock('@packages/utils/health.js', () => ({
    checkOllamaHealth: vi.fn().mockResolvedValue({ status: 'ok', model: 'llama3' }),
    checkAnythingLLMHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
    checkPythonHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
    checkCloudflareHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
    buildHealthResponse: vi.fn().mockImplementation((ol, al, py, cf, ac, mc, rid) => ({
        status: 'ok',
        components: { ollama: ol, anythingllm: al, python: py, cloudflare: cf },
        stats: { agents: ac, mcp: mc },
        requestId: rid
    }))
}));
vi.mock('@packages/agents/AgentManager.js', () => ({
    agentManager: {
        listAgents: vi.fn().mockReturnValue(['agent1', 'agent2'])
    }
}));
vi.mock('@apps/mcp-core/server/McpProcessManager.js', () => ({
    mcpProcessManager: {
        getServersStatus: vi.fn().mockReturnValue([{ name: 'server1', status: 'connected' }])
    }
}));
describe('API v1 Route Tests', () => {
    let app;
    beforeEach(() => {
        app = express();
        app.use(express.json());
        // Add dummy requestId middleware for testing header/id propagation
        app.use((req, res, next) => {
            req.id = 'test-request-id';
            next();
        });
        app.use('/api/health', createHealthRoutes());
        // Error test route
        app.get('/api/trigger-error', asyncHandler(async () => {
            throw AppError.badRequest('Test triggered error');
        }));
        app.use(globalErrorHandler);
    });
    describe('GET /api/health', () => {
        it('should return 200 and health payload', async () => {
            const response = await request(app).get('/api/health');
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({
                status: 'ok',
                stats: expect.objectContaining({
                    agents: 2,
                    mcp: 1
                }),
                requestId: 'test-request-id'
            }));
        });
    });
    describe('Error Handling Integration', () => {
        it('should catch AppError and return formatted JSON', async () => {
            const response = await request(app).get('/api/trigger-error');
            expect(response.status).toBe(400);
            expect(response.body).toEqual(expect.objectContaining({
                error: 'Test triggered error',
                statusCode: 400
            }));
        });
        it('should return 404 for unknown routes', async () => {
            const response = await request(app).get('/api/not-exists');
            expect(response.status).toBe(404);
            // Express default 404 since we didn't add a custom 404 handler before globalErrorHandler
        });
    });
});
