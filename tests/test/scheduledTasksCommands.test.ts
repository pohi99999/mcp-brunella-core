import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerScheduledTasksCommands } from '../src/cli/scheduledTasksCommands.js';

const spinnerStop = vi.fn();
const spinnerFail = vi.fn();
const spinnerSucceed = vi.fn();

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: spinnerStop,
      fail: spinnerFail,
      succeed: spinnerSucceed,
    })),
  })),
}));

describe('Scheduled Tasks CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    spinnerSucceed.mockReset();
  });

  it('should register schedule command group with expected subcommands', () => {
    const program = new Command();
    registerScheduledTasksCommands(program);

    const schedule = program.commands.find((command) => command.name() === 'schedule');
    expect(schedule).toBeDefined();
    expect(schedule?.aliases()).toContain('cron');
    expect(schedule?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['list', 'add', 'remove', 'run']),
    );
  });

  it('should render scheduled task list to stdout', async () => {
    const program = new Command();
    registerScheduledTasksCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            data: [
              {
                id: 'task-12345678',
                title: 'Nightly Review',
                prompt: 'Run nightly review',
                cron_expression: '0 1 * * *',
                handler: 'default',
                enabled: true,
                last_run_at: '2026-04-01T20:00:00.000Z',
                last_status: 'success',
              },
            ],
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'schedule', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Scheduled Tasks');
    expect(output).toContain('Nightly Review');
    expect(output).toContain('Cron:');
    expect(output).toContain('Handler: default');
    expect(output).toContain('Enabled: Yes');
    expect(output).toContain('[OK]');
    expect(spinnerStop).toHaveBeenCalled();
  });

  it('should render empty state for missing scheduled tasks', async () => {
    const program = new Command();
    registerScheduledTasksCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ data: [] })),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'schedule', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('No scheduled tasks found.');
  });

  it('should render trigger result payload to stdout', async () => {
    const program = new Command();
    registerScheduledTasksCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            data: {
              message: 'Task triggered',
              result: {
                status: 'ok',
                queued: true,
              },
            },
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'schedule', 'run', 'task-1']);

    expect(spinnerSucceed).toHaveBeenCalledWith('Task triggered');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('"status": "ok"');
    expect(output).toContain('"queued": true');
  });
});
