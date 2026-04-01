import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerToolDiscoveryCommands } from '../src/cli/toolDiscoveryCommands.js';
import * as prebuiltTools from '../src/utils/prebuiltTools.js';
import * as logger from '../src/utils/logger.js';

describe('Tool Discovery CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register tool-discovery command group with expected subcommands', () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const toolDiscovery = program.commands.find((command) => command.name() === 'tool-discovery');
    expect(toolDiscovery).toBeDefined();
    expect(toolDiscovery?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['list', 'metrics', 'chain']),
    );
  });

  it('should render tool list to stdout', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () =>
        Promise.resolve({
          tools: [
            {
              name: 'alpha-tool',
              description: 'Első tool',
              tags: ['alpha'],
              parameters: [{ name: 'query', type: 'string', required: true }],
            },
          ],
        }),
    } as Response);
    vi.spyOn(prebuiltTools, 'getPrebuiltToolCatalog').mockReturnValue([]);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('MCP Tool Registry');
    expect(output).toContain('alpha-tool');
    expect(output).toContain('Első tool');
    expect(output).toContain('Tags: alpha');
    expect(output).toContain('Params: query:string*');
    expect(output).toContain('Összesen: 1 tool');
  });

  it('should fall back to local tools and log the error when registry fetch fails', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Registry unavailable'));
    vi.spyOn(prebuiltTools, 'getPrebuiltToolCatalog').mockReturnValue([
      {
        name: 'fallback-tool',
        description: 'Helyi fallback',
      },
    ]);
    const logErrorSpy = vi.spyOn(logger, 'logError').mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    expect(logErrorSpy).toHaveBeenCalledWith('ToolsCLI', expect.stringContaining('Registry unavailable'));
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('MCP Tool Registry (local fallback)');
    expect(output).toContain('fallback-tool');
    expect(output).toContain('Összesen: 1 tool');
  });

  it('should render chain errors to stderr', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: false,
          failedAtStep: 2,
          error: 'Parser hiba',
        }),
    } as Response);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'chain', 'parser', 'formatter']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chain hiba a 2. lépésnél');
    expect(output).toContain('Parser hiba');
  });
});
