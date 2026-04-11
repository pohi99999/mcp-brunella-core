import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerSelfModificationCommands } from '../src/cli/selfModificationCommands.js';

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('Self-modification CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the improve command group with expected subcommands', () => {
    const program = new Command();
    registerSelfModificationCommands(program);

    const improve = program.commands.find((command) => command.name() === 'improve');
    expect(improve).toBeDefined();
    expect(improve?.aliases()).toContain('self-mod');
    expect(improve?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'list', 'run', 'approve', 'reject']),
    );
  });

  it('renders overview output for improve status', async () => {
    const program = new Command();
    registerSelfModificationCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          summary: { totalRuns: 8, agentCount: 2, overallSuccessRate: 0.875, avgDurationMs: 1200 },
          weakAgents: [],
          proposals: [],
        },
      }),
    );
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'improve', 'status']);

    const output = infoSpy.mock.calls.map(([chunk]) => String(chunk)).join('\n');
    expect(output).toContain('Self-modification állapot');
    expect(output).toContain('Runs (7d):      8');
    expect(output).toContain('Success rate:   87.5%');
  });

  it('posts run command payload with force flag', async () => {
    const program = new Command();
    registerSelfModificationCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          id: 'proposal-11',
          agentName: 'MarketingDirector',
          status: 'pending_review',
          improvement: { improvementPercent: 22.5 },
          updatedAt: '2026-04-11T10:00:00.000Z',
        },
      }),
    );
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'improve', 'run', 'MarketingDirector', '--force']);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/self-modification/improve/MarketingDirector'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ force: true }),
      }),
    );
  });
});
