import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerReflectionCommands } from '@apps/mcp-core/commands/reflectionCommands.js';

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

describe('Reflection CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    spinnerSucceed.mockReset();
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code ?? '')}`);
    }) as typeof process.exit);
  });

  it('registers reflection command group with status and cycle commands', () => {
    const program = new Command();
    registerReflectionCommands(program);

    const reflection = program.commands.find((command) => command.name() === 'reflection');
    expect(reflection).toBeDefined();
    expect(reflection?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'cycle']),
    );
  });

  it('prints reflection status overview', async () => {
    const program = new Command();
    registerReflectionCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        overview: {
          stats: {
            totalReflections: 3,
            avgQualityScore: 0.82,
            totalLessons: 5,
            selfModelHealth: 'learning',
            metaReasonerStats: { decisions: 10, insights: 2, sessions: 1 },
          },
          selfModel: {
            identity: 'Brunella',
            coherence: 0.88,
            health: 'learning',
            blindSpots: [],
            memoryScopes: {
              global: { purpose: 'global purpose', sources: ['GraphRAG'] },
              local: { purpose: 'local purpose', sources: ['ProjectMaintainer'] },
            },
          },
          painPoints: [],
          insights: [],
          context: 'reflection context',
        },
      }),
    } as Response);

    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await program.parseAsync(['node', 'test', 'reflection', 'status']);

    const output = logSpy.mock.calls.map((args) => args.map((chunk) => String(chunk)).join(' ')).join('\n');
    expect(output).toContain('Reflection állapot');
    expect(output).toContain('Reflections:');
    expect(output).toContain('Memória boundary');
    expect(output).toContain('reflection context');
    expect(spinnerStop).toHaveBeenCalled();
  });

  it('runs reflection nightly cycle manually', async () => {
    const program = new Command();
    registerReflectionCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        result: { status: 'ok' },
      }),
    } as Response);

    await program.parseAsync(['node', 'test', 'reflection', 'cycle']);

    expect(spinnerSucceed).toHaveBeenCalledWith('Reflection nightly cycle lefutott.');
  });
});
