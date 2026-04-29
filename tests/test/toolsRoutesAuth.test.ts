import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeToolMock = vi.fn();
const getToolDefinitionsMock = vi.fn(() => []);

vi.mock('@apps/mcp-core/server/ToolManager.js', () => ({
  toolManager: {
    executeTool: executeToolMock,
    getToolDefinitions: getToolDefinitionsMock,
  },
}));

describe('tool routes operator access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BRUNELLA_API_KEY;
  });

  function createApp(remoteAddress = '203.0.113.10') {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      Object.defineProperty(req.socket, 'remoteAddress', {
        value: remoteAddress,
        configurable: true,
      });
      next();
    });
    return app;
  }

  it('rejects non-loopback tool execution without operator auth', async () => {
    const { createToolRoutes } = await import('@apps/mcp-core/server/routes/tools.js');
    const app = createApp();
    app.use('/', createToolRoutes());

    const response = await request(app)
      .post('/example/execute')
      .send({ ok: true });

    expect(response.status).toBe(401);
    expect(executeToolMock).not.toHaveBeenCalled();
  });

  it('exposes registry and stats routes without operator auth', async () => {
    getToolDefinitionsMock.mockReturnValue([
      {
        id: 'ping',
        name: 'ping',
        description: 'Ping tool',
        enabled: true,
        category: 'server',
        parameters: [],
      },
    ]);

    const { createToolRoutes } = await import('@apps/mcp-core/server/routes/tools.js');
    const app = createApp();
    app.use('/', createToolRoutes());

    const [registryResponse, statsResponse] = await Promise.all([
      request(app).get('/registry'),
      request(app).get('/stats'),
    ]);

    expect(registryResponse.status).toBe(200);
    expect(registryResponse.body).toEqual([
      expect.objectContaining({
        id: 'ping',
        name: 'ping',
        publishedBy: 'brunella-core',
      }),
    ]);
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body).toEqual(
      expect.objectContaining({
        totalTools: 1,
        totalCalls: 0,
      }),
    );
  });

  it('allows non-loopback tool execution with BRUNELLA_API_KEY', async () => {
    process.env.BRUNELLA_API_KEY = 'secret-key';
    executeToolMock.mockResolvedValue({ ok: true });

    const { createToolRoutes } = await import('@apps/mcp-core/server/routes/tools.js');
    const app = createApp();
    app.use('/', createToolRoutes());

    const response = await request(app)
      .post('/example/execute')
      .set('x-api-key', 'secret-key')
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(executeToolMock).toHaveBeenCalledWith(
      'example',
      { ok: true },
      expect.objectContaining({
        requestId: undefined,
        metadata: expect.objectContaining({ source: 'http-tools-route' }),
      }),
    );
  });

  it('rejects non-loopback tool chain execution without operator auth', async () => {
    const { createToolRoutes } = await import('@apps/mcp-core/server/routes/tools.js');
    const app = createApp();
    app.use('/', createToolRoutes());

    const response = await request(app)
      .post('/chain')
      .send({ steps: ['ping'], input: {} });

    expect(response.status).toBe(401);
    expect(executeToolMock).not.toHaveBeenCalled();
  });

  it('executes tool chains through the compatibility route', async () => {
    process.env.BRUNELLA_API_KEY = 'secret-key';
    executeToolMock
      .mockResolvedValueOnce({ task: 'middle' })
      .mockResolvedValueOnce({ done: true });

    const { createToolRoutes } = await import('@apps/mcp-core/server/routes/tools.js');
    const app = createApp();
    app.use('/', createToolRoutes());

    const response = await request(app)
      .post('/chain')
      .set('x-api-key', 'secret-key')
      .send({ steps: ['tool-a', 'tool-b'], input: { task: 'start' } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      completedSteps: 2,
      totalSteps: 2,
      result: { done: true },
    });
    expect(executeToolMock).toHaveBeenNthCalledWith(
      1,
      'tool-a',
      { task: 'start' },
      expect.objectContaining({
        metadata: expect.objectContaining({ source: 'http-tools-chain-route', stepIndex: 0 }),
      }),
    );
    expect(executeToolMock).toHaveBeenNthCalledWith(
      2,
      'tool-b',
      { task: 'middle' },
      expect.objectContaining({
        metadata: expect.objectContaining({ source: 'http-tools-chain-route', stepIndex: 1 }),
      }),
    );
  });
});
