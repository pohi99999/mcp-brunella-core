import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const tracksHarness = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

const tracksMonitorResponse = {
  success: true,
  stats: {
    total: 4,
    proposed: 1,
    active: 2,
    completed: 1,
    archived: 0,
  },
  proposed: [
    {
      id: 'track-proposed',
      title: 'Inventory polish',
      status: 'proposed',
      priority: 'P2',
      progress: 10,
      group: 'business',
    },
  ],
  active: [
    {
      id: 'track-active',
      title: 'CLI cleanup',
      status: 'active',
      priority: 'P1',
      progress: 70,
      group: 'business',
      assignee: 'Developer',
    },
    {
      id: 'track-paused',
      title: 'Paused route',
      status: 'paused',
      priority: 'P0',
      progress: 50,
      group: 'nova',
    },
  ],
  completed: [
    {
      id: 'track-completed',
      title: 'Worker mirror',
      status: 'completed',
      priority: 'P0',
      progress: 100,
      group: 'brunella',
    },
  ],
  archived: [],
};

describe('Tracks CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tracksHarness.fetchMock.mockReset();
    tracksHarness.fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(tracksMonitorResponse),
    }));
    vi.stubGlobal('fetch', tracksHarness.fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the open tracks command', async () => {
    const { registerTracksCommands } = await import('@apps/mcp-core/commands/tracksCommands.js');
    const program = new Command();
    registerTracksCommands(program);

    const tracks = program.commands.find((command) => command.name() === 'tracks');
    expect(tracks).toBeDefined();
    expect(tracks?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['generate', 'list', 'open', 'view', 'progress', 'todo']),
    );
  });

  it('lists only open tracks when using the open command', async () => {
    const { registerTracksCommands } = await import('@apps/mcp-core/commands/tracksCommands.js');
    const program = new Command();
    registerTracksCommands(program);

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => undefined);

    await program.parseAsync(['node', 'test', 'tracks', 'open']);

    expect(tracksHarness.fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/tracks/monitor'),
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );

    expect(tableSpy).toHaveBeenCalledOnce();
    const rows = tableSpy.mock.calls[0]?.[0] as Array<Record<string, string>>;
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.Státusz)).toEqual(
      expect.arrayContaining(['active', 'paused', 'proposed']),
    );
    expect(rows.map((row) => row.Státusz)).not.toContain('completed');

    const output = infoSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Nyitott trackek listája');
    expect(output).toContain('Nyitott: 3 track');
  });
});
