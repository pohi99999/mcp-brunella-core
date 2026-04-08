import { beforeEach, describe, expect, it, vi } from 'vitest';

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  },
}));

vi.mock('../src/utils/prebuiltTools.js', () => ({
  hasPrebuiltTool: vi.fn((name: string) => name === 'stale_tool'),
}));

// Mock MCP SDK to prevent actual network attempts
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    close: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

describe('BrunellaClient self-managed fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.BRUNELLA_MCP_DISABLED;
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue(JSON.stringify([
      { name: 'brunella-core', transport: 'self', disabled: false },
    ]));
  });

  it('returns an empty tool list when only self-managed brunella-core is unavailable', async () => {
    const { BrunellaClient } = await import('../src/utils/mcpClient.js');
    const client = new BrunellaClient();

    await client.connect();
    await expect(client.listTools()).resolves.toEqual({ tools: [] });
  });

  it('throws a deterministic error for stale prebuilt-only tools', async () => {
    const { BrunellaClient } = await import('../src/utils/mcpClient.js');
    const client = new BrunellaClient();

    await client.connect();

    await expect(client.callTool('stale_tool', {})).rejects.toThrow(
      'self-managed and currently not connected',
    );
  });

  it('throws immediately when MCP connectivity is disabled by environment', async () => {
    process.env.BRUNELLA_MCP_DISABLED = '1';

    const { BrunellaClient } = await import('../src/utils/mcpClient.js');
    const client = new BrunellaClient();

    await expect(client.connect()).rejects.toThrow(
      'MCP connections disabled (BRUNELLA_MCP_DISABLED=1)',
    );
  });

  it('continues fallback lookup when one client fails to list tools', async () => {
    const { BrunellaClient } = await import('../src/utils/mcpClient.js');
    const client = new BrunellaClient();

    const failingClient = {
      listTools: vi.fn().mockRejectedValue(new Error('transient list failure')),
      callTool: vi.fn(),
    };
    const workingClient = {
      listTools: vi.fn().mockResolvedValue({
        tools: [{ name: 'live_tool', description: 'Live tool', inputSchema: { type: 'object' } }],
      }),
      callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    };

    (client as any).clients = new Map([
      ['broken-server', failingClient],
      ['healthy-server', workingClient],
    ]);
    (client as any).toolCache = new Map();

    await expect(client.callTool('live_tool', { value: 1 })).resolves.toEqual({
      content: [{ type: 'text', text: 'ok' }],
    });

    expect(failingClient.listTools).toHaveBeenCalledTimes(1);
    expect(workingClient.listTools).toHaveBeenCalledTimes(1);
    expect(workingClient.callTool).toHaveBeenCalledWith({
      name: 'live_tool',
      arguments: { value: 1 },
    });
  });
});
