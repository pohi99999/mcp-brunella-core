import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthRoutes } from '../src/server/routes/health.js';
import { globalErrorHandler, asyncHandler } from '../src/server/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';

// Mocks
vi.mock('../src/utils/health.js', () => ({
  checkOllamaHealth: vi.fn().mockResolvedValue({ status: 'ok', model: 'llama3' }),
  checkAnythingLLMHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkPythonHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkN8nHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkLangflowHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkCloudflareHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
  checkWabHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  buildHealthResponse: vi.fn().mockImplementation((ol, al, py, n8n, lf, wab, cf, ac, mc, rid) => ({
    status: 'ok',
    components: { ollama: ol, anythingllm: al, python: py, n8n, langflow: lf, wab, cloudflare: cf },
    stats: { agents: ac, mcp: mc },
    requestId: rid
  }))
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    listAgents: vi.fn().mockReturnValue(['agent1', 'agent2'])
  }
}));

vi.mock('../src/server/McpProcessManager.js', () => ({
  mcpProcessManager: {
    getServersStatus: vi.fn().mockReturnValue([{ name: 'server1', status: 'connected' }])
  }
}));

describe('API v1 Route Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Add dummy requestId middleware for testing header/id propagation
    app.use((req, res, next) => {
      (req as any).id = 'test-request-id';
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
        requestId: 'test-request-id',
        runtime: expect.objectContaining({
          pid: expect.any(Number),
          memory: expect.objectContaining({
            rssMb: expect.any(Number),
            heapUsedMb: expect.any(Number),
            state: expect.any(String)
          })
        })
      }));
    });

    it('should return liveness payload', async () => {
      const response = await request(app).get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: 'alive',
        process: 'brunella-core',
        runtime: expect.objectContaining({
          pid: expect.any(Number),
          memory: expect.objectContaining({
            rssMb: expect.any(Number)
          })
        })
      }));
    });

    it('should return readiness payload', async () => {
      const response = await request(app).get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: 'ready',
        ready: true,
        agents: 2,
        mcpServers: 1,
        runtime: expect.objectContaining({
          memory: expect.objectContaining({
            heapUtilizationPercent: expect.any(Number)
          })
        })
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
