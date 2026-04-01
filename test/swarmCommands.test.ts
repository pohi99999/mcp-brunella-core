import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerSwarmCommands } from '../src/cli/swarmCommands.js';
import * as logger from '../src/utils/logger.js';

describe('Swarm CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register swarm-v2 command group with expected subcommands', () => {
    const program = new Command();
    registerSwarmCommands(program);

    const swarm = program.commands.find((command) => command.name() === 'swarm-v2');
    expect(swarm).toBeDefined();
    expect(swarm?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'dispatch', 'checkpoints']),
    );
  });

  it('should render swarm status to stdout', async () => {
    const program = new Command();
    registerSwarmCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          colonies: [
            {
              colonyId: 'triad-default',
              name: 'Triad',
              status: 'active',
              agentCount: 3,
              leaderId: 'lead-1',
              metrics: {
                tasksCompleted: 12,
                tasksFailed: 1,
              },
            },
          ],
          total: 1,
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'swarm-v2', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Swarm Colony Status');
    expect(output).toContain('Triad');
    expect(output).toContain('Agents: 3');
    expect(output).toContain('Leader: lead-1');
    expect(output).toContain('Tasks: 12✓ / 1✗');
  });

  it('should render dispatch result to stdout', async () => {
    const program = new Command();
    registerSwarmCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: {
            taskId: 'task-1',
            accepted: true,
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'swarm-v2', 'dispatch', 'analyse trends']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Feladat sikeresen elküldve');
    expect(output).toContain('"taskId": "task-1"');
    expect(output).toContain('"accepted": true');
  });

  it('should log and render errors to stderr', async () => {
    const program = new Command();
    registerSwarmCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Swarm offline'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const logErrorSpy = vi.spyOn(logger, 'logError').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'swarm-v2', 'status']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Swarm offline');
    expect(logErrorSpy).toHaveBeenCalledWith('SwarmCLI', expect.stringContaining('Swarm offline'));
  });
});
