import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const goldHarness = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  listSpecStatuses: vi.fn(),
  approveSpec: vi.fn(),
  rejectSpec: vi.fn(),
  listActiveCheckpoints: vi.fn(),
  clearCheckpoints: vi.fn(),
  getCheckpointStats: vi.fn(),
  getRecentDecisions: vi.fn(),
  getGoldenStats: vi.fn(),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: goldHarness.logInfo,
  logError: goldHarness.logError,
}));

vi.mock('@packages/agents/specStatus.js', () => ({
  listSpecStatuses: goldHarness.listSpecStatuses,
  approveSpec: goldHarness.approveSpec,
  rejectSpec: goldHarness.rejectSpec,
}));

vi.mock('@packages/core-logic/checkpoint.js', () => ({
  listActiveCheckpoints: goldHarness.listActiveCheckpoints,
  clearCheckpoints: goldHarness.clearCheckpoints,
  getCheckpointStats: goldHarness.getCheckpointStats,
}));

vi.mock('@packages/core-logic/modelRouter.js', () => ({
  getRecentDecisions: goldHarness.getRecentDecisions,
}));

vi.mock('@packages/core-logic/goldenDatasetBridge.js', () => ({
  getGoldenStats: goldHarness.getGoldenStats,
}));

import { registerGoldCommands } from '@apps/mcp-core/commands/goldCommands.js';

describe('Gold CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    goldHarness.logInfo.mockReset();
    goldHarness.logError.mockReset();
    goldHarness.listSpecStatuses.mockReset();
    goldHarness.approveSpec.mockReset();
    goldHarness.rejectSpec.mockReset();
    goldHarness.listActiveCheckpoints.mockReset();
    goldHarness.clearCheckpoints.mockReset();
    goldHarness.getCheckpointStats.mockReset();
    goldHarness.getRecentDecisions.mockReset();
    goldHarness.getGoldenStats.mockReset();
  });

  it('should register the gold command group with expected subcommands', () => {
    const program = new Command();
    registerGoldCommands(program);

    const gold = program.commands.find((command) => command.name() === 'gold');
    expect(gold).toBeDefined();
    expect(gold?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining([
        'spec-list',
        'spec-approve',
        'spec-reject',
        'phoenix-checkpoints',
        'phoenix-clear',
        'router-decisions',
        'memory-stats',
        'status',
      ]),
    );
  });

  it('should render spec status table to stdout', async () => {
    const program = new Command();
    registerGoldCommands(program);

    goldHarness.listSpecStatuses.mockResolvedValue([
      {
        id: 'track-42',
        spec_status: 'approved',
        progress: 80,
        priority: 'high',
      },
    ]);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'gold', 'spec-list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Track');
    expect(output).toContain('Status');
    expect(output).toContain('track-42');
    expect(output).toContain('approved');
    expect(output).toContain('80%');
  });

  it('should render unavailable memory stats message to stdout', async () => {
    const program = new Command();
    registerGoldCommands(program);

    goldHarness.getGoldenStats.mockResolvedValue(null);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'gold', 'memory-stats']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Golden dataset stats unavailable');
  });

  it('should render overall gold protocol status to stdout', async () => {
    const program = new Command();
    registerGoldCommands(program);

    goldHarness.listSpecStatuses.mockResolvedValue([
      { id: 'track-a', spec_status: 'approved', progress: 100, priority: 'high' },
      { id: 'track-b', spec_status: 'pending_approval', progress: 60, priority: 'normal' },
    ]);
    goldHarness.listActiveCheckpoints.mockResolvedValue([
      { taskId: 'task-1', stepName: 'analyse', createdAt: Date.now() },
      { taskId: 'task-2', stepName: 'patch', createdAt: Date.now() },
    ]);
    goldHarness.getGoldenStats.mockResolvedValue({
      totalSamples: 12,
      newSinceLastTraining: 3,
      lastTrainingAt: '2026-04-01T20:00:00.000Z',
    });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'gold', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Gold Protocol Status');
    expect(output).toContain('Approved Specs: 1');
    expect(output).toContain('Pending Specs: 1');
    expect(output).toContain('Active Checkpoints: 2');
    expect(output).toContain('Golden Samples: 12');
    expect(output).toContain('New Since Training: 3');
  });

  it('should log command failures through logger', async () => {
    const program = new Command();
    registerGoldCommands(program);

    goldHarness.listSpecStatuses.mockRejectedValue(new Error('spec registry offline'));

    await program.parseAsync(['node', 'test', 'gold', 'spec-list']);

    expect(goldHarness.logError).toHaveBeenCalledWith(
      'CLI',
      expect.stringContaining('spec registry offline'),
    );
  });
});
