import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerProjectMaintainerCommands } from '@apps/mcp-core/commands/projectMaintainerCommands.js';

const spinnerStop = vi.fn();
const spinnerFail = vi.fn();

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: spinnerStop,
      fail: spinnerFail,
    })),
  })),
}));

describe('Project Maintainer CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code ?? '')}`);
    }) as typeof process.exit);
  });

  it('registers maintainer command group with Hungarian subcommands', () => {
    const program = new Command();
    registerProjectMaintainerCommands(program);

    const maintainer = program.commands.find((command) => command.name() === 'maintainer');
    expect(maintainer).toBeDefined();
    expect(maintainer?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['riport', 'futtat']),
    );
  });

  it('prints latest report output', async () => {
    const program = new Command();
    registerProjectMaintainerCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'pmr-1',
        generatedAt: '2026-04-02T22:00:00.000Z',
        findingsCount: 1,
        suggestionsCount: 1,
        triggeredBy: 'scheduler',
      report: {
        id: 'pmr-1',
        generatedAt: '2026-04-02T22:00:00.000Z',
        triggeredBy: 'scheduler',
        findings: [{ category: 'root-noise', severity: 'medium', message: 'Artefakt', path: 'debug_view.txt' }],
        suggestions: [{ action: 'review', target: 'debug_view.txt', reason: 'Vizsgáld meg.' }],
        trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
        dryRun: true,
      },
    }),
    } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await program.parseAsync(['node', 'test', 'maintainer', 'riport']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Project Maintainer Riport');
    expect(output).toContain('Dry-run');
    expect(output).toContain('debug_view.txt');
  });

  it('registers futtat command and triggers on-demand run', async () => {
    const program = new Command();
    registerProjectMaintainerCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Riport sikeresen elkészült',
        report: {
          id: 'pmr-2',
          generatedAt: '2026-04-02T22:05:00.000Z',
          triggeredBy: 'api',
          findings: [],
          suggestions: [{ action: 'create', target: 'conductor/tracks/x/plan.md', reason: 'Pótold.' }],
          trackSummary: { total: 1, missingSpec: [], missingPlan: ['x'], healthy: 0 },
          dryRun: true,
        },
      }),
      text: () => Promise.resolve(''),
    } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await program.parseAsync(['node', 'test', 'maintainer', 'futtat']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Project Maintainer Riport');
    expect(output).toContain('conductor/tracks/x/plan.md');
  });
});
