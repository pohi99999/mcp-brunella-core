import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const taskHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  spinnerSucceed: vi.fn(),
  spinnerFail: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: taskHarness.promptMock,
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => {
    const spinner = {
      start: vi.fn(() => spinner),
      succeed: taskHarness.spinnerSucceed,
      fail: taskHarness.spinnerFail,
    };

    return spinner;
  }),
}));

import { registerTaskCommands } from '../src/cli/taskCommands.js';

describe('Task CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    taskHarness.promptMock.mockReset();
    taskHarness.spinnerSucceed.mockReset();
    taskHarness.spinnerFail.mockReset();
  });

  it('should register the task command group with interactive subcommand', () => {
    const program = new Command();
    registerTaskCommands(program);

    const task = program.commands.find((command) => command.name() === 'task');
    expect(task).toBeDefined();
    expect(task?.commands.map((command) => command.name())).toContain('interactive');
  });

  it('should execute a direct task and render string result to stdout', async () => {
    const program = new Command();
    registerTaskCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        status: 'success',
        result: 'Kész a jelentés',
        executedAt: '2026-04-01T20:00:00.000Z',
      })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'task', 'írj', 'jelentést', '--context', '{"priority":"high"}']);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/enterprise/execute',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"task":"írj jelentést"');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"priority":"high"');
    expect(taskHarness.spinnerSucceed).toHaveBeenCalledWith(expect.stringContaining('Feladat végrehajtva'));

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('📋 Eredmény');
    expect(output).toContain('Kész a jelentés');
    expect(output).toContain('Végrehajtva:');
  });

  it('should render structured result object to stdout', async () => {
    const program = new Command();
    registerTaskCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        status: 'success',
        result: {
          status: 'queued',
          message: 'Feladat sorba állítva',
          data: { jobId: 'job-123' },
        },
        executedAt: '2026-04-01T20:00:00.000Z',
      })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'task', 'indíts', 'workflowt']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Státusz: queued');
    expect(output).toContain('Üzenet: Feladat sorba állítva');
    expect(output).toContain('"jobId": "job-123"');
  });

  it('should reject invalid JSON context and exit', async () => {
    const program = new Command();
    registerTaskCommands(program);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(
      program.parseAsync(['node', 'test', 'task', 'hibás', '--context', '{bad-json']),
    ).rejects.toThrow('process.exit');

    expect(taskHarness.spinnerFail).toHaveBeenCalledWith(expect.stringContaining('Érvénytelen JSON kontextus'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should enter interactive mode and exit gracefully', async () => {
    const program = new Command();
    registerTaskCommands(program);

    taskHarness.promptMock.mockResolvedValueOnce({ choice: 'exit' });
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'task']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Brunella - Természetes Nyelvű Feladat Végrehajtás');
    expect(output).toContain('Viszlát!');
  });

  it('should execute predefined interactive task and wait for continue', async () => {
    const program = new Command();
    registerTaskCommands(program);

    taskHarness.promptMock
      .mockResolvedValueOnce({ choice: 'predefined' })
      .mockResolvedValueOnce({ predefined: 'Ellenőrizd a projekt státuszát és add meg a track-ek összefoglalóját' })
      .mockResolvedValueOnce({ continue: '' })
      .mockResolvedValueOnce({ choice: 'exit' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        status: 'success',
        result: 'Összefoglaló kész',
        executedAt: '2026-04-01T20:00:00.000Z',
      })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'task', 'interactive']);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('Összefoglaló kész');
    expect(taskHarness.promptMock).toHaveBeenCalledTimes(4);
  });
});
