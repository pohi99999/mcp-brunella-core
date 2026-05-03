import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  handleReadFile: vi.fn(),
  handleWriteFile: vi.fn(),
  handleListDirectory: vi.fn(),
  handleSearchFiles: vi.fn(),
  executeTool: vi.fn(),
  getTools: vi.fn(() => [
    { name: 'read_file', description: 'Read file', inputSchema: { type: 'object', properties: {} } },
  ]),
  checkHealth: vi.fn(async () => []),
  getEnabledProviders: vi.fn(() => []),
  getStats: vi.fn(() => ({ total: 0 })),
  generate: vi.fn(async () => ({ success: true })),
  getAuditLog: vi.fn(() => []),
  checkAccess: vi.fn(() => ({ allowed: true })),
  executeCode: vi.fn(async () => ({ success: true })),
  loadConfig: vi.fn(async () => []),
  getServersStatus: vi.fn(() => [
    {
      name: 'brunella-core',
      status: 'running',
      transport: 'self',
      autoStart: true,
      pid: 1234,
      description: 'Core server',
    },
    {
      name: 'github',
      status: 'error',
      transport: 'stdio',
      autoStart: true,
      pid: null,
      error: 'Missing required environment',
    },
  ]),
  getServersReadiness: vi.fn(() => [
    {
      name: 'brunella-core',
      transport: 'self',
      autoStart: true,
      required: true,
      disabled: false,
      canStart: true,
      readinessState: 'ready',
      platformSupported: true,
      requiredEnv: [],
      missingRequiredEnv: [],
      blockers: [],
      actionableBlockers: [],
      description: 'Core server',
    },
    {
      name: 'github',
      transport: 'stdio',
      autoStart: true,
      required: false,
      disabled: false,
      canStart: false,
      readinessState: 'action_required',
      platformSupported: true,
      requiredEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
      missingRequiredEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
      blockers: ['missing required env: GITHUB_PERSONAL_ACCESS_TOKEN'],
      actionableBlockers: ['missing required env: GITHUB_PERSONAL_ACCESS_TOKEN'],
    },
    {
      name: 'vscode-placeholder',
      transport: 'stdio',
      autoStart: false,
      required: false,
      disabled: true,
      canStart: false,
      readinessState: 'disabled',
      platformSupported: true,
      requiredEnv: [],
      missingRequiredEnv: [],
      blockers: ['disabled in mcp_servers.json'],
      actionableBlockers: [],
      inactiveReason: 'Disabled intentionally in mcp_servers.json',
    },
  ]),
  startServer: vi.fn(async () => true),
  stopServer: vi.fn(async () => undefined),
}));

vi.mock('@packages/core-logic/bifrost_gateway.js', () => ({
  getBifrostGateway: () => ({
    checkHealth: routeMocks.checkHealth,
    getEnabledProviders: routeMocks.getEnabledProviders,
    getStats: routeMocks.getStats,
    generate: routeMocks.generate,
  }),
}));

vi.mock('@packages/core-logic/safe_zone_validator.js', () => ({
  getSafeZoneValidator: () => ({
    getAuditLog: routeMocks.getAuditLog,
    config: {
      safe_zones: [],
      blacklist: [],
      rate_limiting: {},
    },
    checkAccess: routeMocks.checkAccess,
  }),
}));

vi.mock('@packages/core-logic/e2b_sandbox_manager.js', () => ({
  getE2BSandboxManager: () => ({
    getStats: vi.fn(() => ({ totalRuns: 0 })),
    executeCode: routeMocks.executeCode,
  }),
}));

vi.mock('@apps/mcp-core/server/mcp_server.js', () => ({
  MCPFilesystemServer: vi.fn().mockImplementation(() => ({
    getTools: routeMocks.getTools,
    executeTool: routeMocks.executeTool,
  })),
}));

vi.mock('@apps/mcp-core/server/McpProcessManager.js', () => ({
  mcpProcessManager: {
    loadConfig: routeMocks.loadConfig,
    getServersStatus: routeMocks.getServersStatus,
    getServersReadiness: routeMocks.getServersReadiness,
    startServer: routeMocks.startServer,
    stopServer: routeMocks.stopServer,
  },
}));

import mcpRouter from '@apps/mcp-core/server/routes/mcp.js';

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/mcp', mcpRouter);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start test server');
  }

  return { server, baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}` };
}

async function stopServer(server: ReturnType<typeof express.application.listen>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

describe('MCP API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.executeTool.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'read_file') return await routeMocks.handleReadFile(args);
      if (name === 'write_file') return await routeMocks.handleWriteFile(args);
      if (name === 'list_directory') return await routeMocks.handleListDirectory(args);
      if (name === 'search_files') return await routeMocks.handleSearchFiles(args);
      throw new Error(`Unknown tool: ${name}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 500 when a tool handler throws', async () => {
    routeMocks.executeTool.mockRejectedValueOnce(new Error('boom'));

    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/tools/read_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args: { path: 'missing.txt' } }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('boom');
    } finally {
      await stopServer(server);
    }
  });

  it('returns parsed JSON tool results', async () => {
    routeMocks.executeTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"success":true,"data":"ok"}' }],
    });

    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/tools/read_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args: { path: 'readme.txt' } }),
      });

      const payload = (await response.json()) as { success?: boolean; data?: string };

      expect(response.status).toBe(200);
      expect(payload).toEqual({ success: true, data: 'ok' });
      expect(routeMocks.executeTool).toHaveBeenCalledWith('read_file', { path: 'readme.txt' });
    } finally {
      await stopServer(server);
    }
  });

  it('returns non-JSON MCP text content without hiding the raw result', async () => {
    routeMocks.executeTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'plain output' }],
      isError: false,
    });

    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/tools/read_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ args: { path: 'readme.txt' } }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        isError?: boolean;
        content?: Array<{ type: string; text: string }>;
      };

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.isError).toBe(false);
      expect(payload.content?.[0]).toEqual({ type: 'text', text: 'plain output' });
    } finally {
      await stopServer(server);
    }
  });

  it('returns configured MCP server runtime statuses', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/servers`);
      const payload = (await response.json()) as {
        success?: boolean;
        servers?: Array<{ name: string; status: string; transport: string; autoStart: boolean }>;
        summary?: { total: number; running: number; error: number; autoStart: number };
      };

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.servers).toEqual([
        expect.objectContaining({
          name: 'brunella-core',
          status: 'running',
          transport: 'self',
          autoStart: true,
        }),
        expect.objectContaining({
          name: 'github',
          status: 'error',
          transport: 'stdio',
          autoStart: true,
        }),
      ]);
      expect(payload.summary).toEqual(expect.objectContaining({
        total: 2,
        running: 1,
        error: 1,
        autoStart: 2,
      }));
    } finally {
      await stopServer(server);
    }
  });

  it('returns side-effect-free MCP manifest readiness', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/manifest`);
      const payload = (await response.json()) as {
        success?: boolean;
        entries?: Array<{ name: string; canStart: boolean; readinessState: string; missingRequiredEnv: string[] }>;
        summary?: { total: number; ready: number; blocked: number; actionRequired: number; inactive: number; missingEnv: number };
      };

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.entries).toEqual([
        expect.objectContaining({
          name: 'brunella-core',
          canStart: true,
          missingRequiredEnv: [],
        }),
        expect.objectContaining({
          name: 'github',
          canStart: false,
          readinessState: 'action_required',
          missingRequiredEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
        }),
        expect.objectContaining({
          name: 'vscode-placeholder',
          canStart: false,
          readinessState: 'disabled',
          missingRequiredEnv: [],
        }),
      ]);
      expect(payload.summary).toEqual(expect.objectContaining({
        total: 3,
        ready: 1,
        blocked: 1,
        actionRequired: 1,
        inactive: 1,
        missingEnv: 1,
      }));
      expect(routeMocks.startServer).not.toHaveBeenCalled();
      expect(routeMocks.stopServer).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it('starts a configured MCP server by name', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/servers/github/start`, {
        method: 'POST',
      });
      const payload = (await response.json()) as {
        success?: boolean;
        server?: { name: string; status: string };
      };

      expect(response.status).toBe(200);
      expect(routeMocks.startServer).toHaveBeenCalledWith('github');
      expect(payload.success).toBe(true);
      expect(payload.server).toEqual(expect.objectContaining({ name: 'github' }));
    } finally {
      await stopServer(server);
    }
  });

  it('stops a configured MCP server by name', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/servers/brunella-core/stop`, {
        method: 'POST',
      });
      const payload = (await response.json()) as {
        success?: boolean;
        server?: { name: string; status: string };
      };

      expect(response.status).toBe(200);
      expect(routeMocks.stopServer).toHaveBeenCalledWith('brunella-core');
      expect(payload.success).toBe(true);
      expect(payload.server).toEqual(expect.objectContaining({ name: 'brunella-core' }));
    } finally {
      await stopServer(server);
    }
  });

  it('returns HTTP 404 for unknown MCP server control actions', async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/api/mcp/servers/nope/start`, {
        method: 'POST',
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('MCP server not found');
      expect(routeMocks.startServer).not.toHaveBeenCalledWith('nope');
    } finally {
      await stopServer(server);
    }
  });
});
