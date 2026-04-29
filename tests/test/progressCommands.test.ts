import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerProgressCommands } from '@apps/mcp-core/commands/progressCommands.js';

const progressHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  spinnerStop: vi.fn(),
  spinnerFail: vi.fn(),
  spinnerSucceed: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: progressHarness.promptMock,
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: progressHarness.spinnerStop,
      fail: progressHarness.spinnerFail,
      succeed: progressHarness.spinnerSucceed,
    })),
  })),
}));

describe('Progress CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    progressHarness.promptMock.mockReset();
    progressHarness.spinnerStop.mockReset();
    progressHarness.spinnerFail.mockReset();
    progressHarness.spinnerSucceed.mockReset();
  });

  it('should register the progress command', () => {
    const program = new Command();
    registerProgressCommands(program);

    const progress = program.commands.find((command) => command.name() === 'progress');
    expect(progress).toBeDefined();
  });

  it('should render all active track progress to stdout', async () => {
    const program = new Command();
    registerProgressCommands(program);

    progressHarness.promptMock.mockResolvedValueOnce({ action: 'all' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            success: true,
            count: 1,
            tracks: [
              {
                trackId: 'track-1',
                title: 'CLI cleanup',
                progress: 75,
                completedCount: 3,
                totalCount: 4,
              },
            ],
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'progress']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Aktív track progress');
    expect(output).toContain('track-1');
    expect(output).toContain('CLI cleanup');
    expect(output).toContain('75%');
    expect(output).toContain('3/4');
    expect(progressHarness.spinnerStop).toHaveBeenCalled();
  });

  it('should render selected track todos to stdout', async () => {
    const program = new Command();
    registerProgressCommands(program);

    progressHarness.promptMock
      .mockResolvedValueOnce({ action: 'one' })
      .mockResolvedValueOnce({ trackId: 'track-1' })
      .mockResolvedValueOnce({ action: 'back' });

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              count: 1,
              tracks: [
                {
                  trackId: 'track-1',
                  title: 'CLI cleanup',
                  progress: 50,
                  completedCount: 1,
                  totalCount: 2,
                },
              ],
            }),
          ),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              success: true,
              trackId: 'track-1',
              title: 'CLI cleanup',
              todos: [
                { id: 'line:1', text: 'Első TODO', completed: true },
                { id: 'line:2', text: 'Második TODO', completed: false },
              ],
              progress: 50,
              completedCount: 1,
              totalCount: 2,
              updatedAt: '2026-04-01T20:00:00.000Z',
            }),
          ),
      } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'progress']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('📌 CLI cleanup');
    expect(output).toContain('[x] Első TODO');
    expect(output).toContain('[ ] Második TODO');
    expect(output).toContain('line:1');
    expect(output).toContain('line:2');
  });

  it('should render API errors to stderr', async () => {
    const program = new Command();
    registerProgressCommands(program);

    progressHarness.promptMock.mockResolvedValueOnce({ action: 'all' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Backend offline'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'progress']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Backend offline');
    expect(progressHarness.spinnerFail).toHaveBeenCalledWith('Hiba');
  });
});
