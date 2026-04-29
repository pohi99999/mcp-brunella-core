import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { registerExternalKnowledgeCommands } from '@apps/mcp-core/commands/externalKnowledgeCommands.js';

describe('external knowledge CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code ?? '')}`);
    }) as typeof process.exit);
  });

  it('registers the knowledge command group with Hungarian subcommands', () => {
    const program = new Command();
    registerExternalKnowledgeCommands(program);

    const knowledge = program.commands.find((command) => command.name() === 'knowledge');
    expect(knowledge).toBeDefined();
    expect(knowledge?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['beolvas-web', 'beolvas-youtube', 'kartya', 'sor', 'keres', 'promotal']),
    );
  });

  it('renders search results from the API', async () => {
    const program = new Command();
    registerExternalKnowledgeCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        count: 1,
        results: [{ id: 'card-1', title: 'Workflow card', status: 'canonical' }],
      }),
    } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await program.parseAsync(['node', 'test', 'knowledge', 'keres', 'workflow']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Knowledge találatok');
    expect(output).toContain('Workflow card');
  });

  it('renders promote response from the API', async () => {
    const program = new Command();
    registerExternalKnowledgeCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        card: { id: 'card-2', status: 'canonical', promotedBy: 'Copilot' },
      }),
    } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    await program.parseAsync([
      'node',
      'test',
      'knowledge',
      'promotal',
      'card-2',
      '--reviewer',
      'Copilot',
      '--note',
      'Verified',
    ]);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Canonical knowledge card');
    expect(output).toContain('card-2');
  });
});
