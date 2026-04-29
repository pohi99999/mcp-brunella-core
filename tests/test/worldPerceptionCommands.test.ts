import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { registerWorldPerceptionCommands } from '@apps/mcp-core/commands/worldPerceptionCommands.js';

function mockJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('World perception CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the perception command group with expected subcommands', () => {
    const program = new Command();
    registerWorldPerceptionCommands(program);

    const perception = program.commands.find((command) => command.name() === 'perception');
    expect(perception).toBeDefined();
    expect(perception?.aliases()).toContain('world-perception');
    expect(perception?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'list', 'observe', 'cycle', 'promote', 'ignore']),
    );
  });

  it('renders overview output for perception status', async () => {
    const program = new Command();
    registerWorldPerceptionCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          generatedAt: '2026-04-11T10:00:00.000Z',
          summary: { totalSignals: 8, detected: 5, promoted: 2, ignored: 1, avgScore: 0.74 },
          domainCoverage: [{ domain: 'technology', count: 4 }],
          pendingSignals: [],
          freshestSignals: [],
          recentPromotions: [],
        },
      }),
    );
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'perception', 'status']);

    const output = infoSpy.mock.calls.map(([chunk]) => String(chunk)).join('\n');
    expect(output).toContain('World perception állapot');
    expect(output).toContain('Signals:        8');
    expect(output).toContain('Detected:       5');
  });

  it('posts cycle payload with limit', async () => {
    const program = new Command();
    registerWorldPerceptionCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({
        success: true,
        data: {
          triggeredAt: '2026-04-11T10:00:00.000Z',
          scannedCards: 3,
          ingestedSignals: 2,
          createdSignals: 1,
          refreshedSignals: 1,
          topSignals: [],
        },
      }),
    );
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(['node', 'test', 'perception', 'cycle', '--limit', '7']);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/world-perception/cycle'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ limit: 7 }),
      }),
    );
  });
});
