import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const conductorHarness = vi.hoisted(() => ({
  fullSync: vi.fn(),
  getState: vi.fn(),
  startWatcher: vi.fn(),
}));

vi.mock('@packages/core-logic/trackStateManager.js', () => ({
  trackStateManager: {
    fullSync: conductorHarness.fullSync,
    getState: conductorHarness.getState,
    startWatcher: conductorHarness.startWatcher,
  },
}));

import { registerConductorCommands } from '@apps/mcp-core/commands/conductorCommands.js';

describe('Conductor CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    conductorHarness.fullSync.mockReset();
    conductorHarness.getState.mockReset();
    conductorHarness.startWatcher.mockReset();

    conductorHarness.getState.mockReturnValue({
      lastUpdated: '2026-04-01T22:00:00.000Z',
      tracks: [
        {
          id: 'track-active',
          name: 'CLI cleanup',
          status: 'active',
          priority: 'high',
          progress: 70,
          assignee: 'Developer',
          group: 'business',
          _isArchived: false,
        },
        {
          id: 'track-proposed',
          name: 'Inventory polish',
          status: 'proposed',
          priority: 'medium',
          progress: 10,
          group: 'business',
          _isArchived: false,
        },
        {
          id: 'track-completed',
          name: 'Worker mirror',
          status: 'completed',
          priority: 'critical',
          progress: 100,
          group: 'business',
          _isArchived: false,
        },
      ],
      stats: {
        total: 3,
        active: 1,
        completed: 1,
        archived: 0,
        proposed: 1,
      },
    });
  });

  it('should register conductor subcommands', () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    const conductor = program.commands.find((command) => command.name() === 'conductor');
    expect(conductor).toBeDefined();
    expect(conductor?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['rescan', 'masterplan', 'status', 'list']),
    );
  });

  it('should render rescan summary to stdout', async () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    conductorHarness.fullSync.mockResolvedValue(undefined);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'conductor', 'rescan']);

    expect(conductorHarness.fullSync).toHaveBeenCalledOnce();
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Track State Manager - Full Sync');
    expect(output).toContain('Sync complete!');
    expect(output).toContain('Total tracks: 3');
    expect(output).toContain('conductor/project_state.json');
    expect(output).toContain('conductor/tracks.md');
  });

  it('should render conductor masterplan summary to stdout', async () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'conductor', 'masterplan']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('KKV Masterplan Status Snapshot');
    expect(output).toContain('CLI cleanup');
    expect(output).toContain('Business: 3 total');
    expect(output).toContain('Fókusz: CLI cleanup');
    expect(output).toContain('Next steps:');
  });

  it('should render KKV masterplan status snapshot from the status command', async () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'conductor', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('KKV Masterplan Status Snapshot');
    expect(output).toContain('Business: 3 total');
    expect(output).toContain('Fókusz: CLI cleanup');
    expect(output).toContain('Next steps:');
  });

  it('should filter track list output', async () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'conductor', 'list', '--status', 'active']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Track List (1 tracks)');
    expect(output).toContain('CLI cleanup');
    expect(output).toContain('Assignee: Developer');
    expect(output).not.toContain('Inventory polish');
  });

  it('should render sync failures to stderr and exit', async () => {
    const program = new Command();
    registerConductorCommands(program.command('conductor'));

    conductorHarness.fullSync.mockRejectedValue(new Error('sync failed'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(program.parseAsync(['node', 'test', 'conductor', 'rescan'])).rejects.toThrow('process.exit');

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Sync failed: sync failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
