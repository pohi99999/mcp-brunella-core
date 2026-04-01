import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerMemoryCommands } from '../src/cli/memoryCommands.js';

const promptMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());

vi.mock('inquirer', () => ({
  default: {
    prompt: promptMock,
  },
}));

vi.mock('fs', () => ({
  promises: {
    writeFile: writeFileMock,
  },
}));

describe('Memory CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    promptMock.mockReset();
    writeFileMock.mockReset();
  });

  it('should register the memory command group', () => {
    const program = new Command();
    registerMemoryCommands(program);

    const memory = program.commands.find((command) => command.name() === 'memory');
    expect(memory).toBeDefined();
    expect(memory?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['stats', 'purge', 'export', 'sync']),
    );
  });

  it('should render stats output to stdout', async () => {
    const program = new Command();
    registerMemoryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          summary: {
            totalEntries: 8,
            avgConfidence: 0.87,
            totalReuses: 13,
          },
          agents: [
            {
              agentName: 'Developer',
              totalEntries: 8,
              avgConfidence: 0.87,
              totalReuses: 13,
              cache: { hits: 10, misses: 2, hitRate: 0.833 },
            },
          ],
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'memory', 'stats']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Agent Memória & Tanulás');
    expect(output).toContain('Összes entry:');
    expect(output).toContain('Developer');
    expect(output).toContain('Cache hits/misses:   10/2');
  });

  it('should render purge summary to stdout', async () => {
    const program = new Command();
    registerMemoryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, removed: 4 }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'memory', 'purge']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Törölt structured memory sorok: 4');
  });

  it('should export memory to file and print the path', async () => {
    const program = new Command();
    registerMemoryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"entry":1}\n'),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'memory', 'export', '--format', 'json']);

    expect(writeFileMock).toHaveBeenCalledOnce();
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Export elkészült:');
    expect(output).toContain('.json');
  });

  it('should render sync result to stdout', async () => {
    const program = new Command();
    registerMemoryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, synced: 6, failed: 1, skipped: 2 }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'memory', 'sync']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Golden sync: 6 synced / 1 failed / 2 skipped');
  });
});
