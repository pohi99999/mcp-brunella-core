import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  handleReadFile: vi.fn(),
  handleWriteFile: vi.fn(),
  handleListDirectory: vi.fn(),
  handleSearchFiles: vi.fn(),
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
    handleReadFile: routeMocks.handleReadFile,
    handleWriteFile: routeMocks.handleWriteFile,
    handleListDirectory: routeMocks.handleListDirectory,
    handleSearchFiles: routeMocks.handleSearchFiles,
  })),
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 500 when a tool handler throws', async () => {
    routeMocks.handleReadFile.mockRejectedValueOnce(new Error('boom'));

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
});
