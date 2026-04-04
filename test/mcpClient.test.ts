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

describe('BrunellaClient self-managed fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
