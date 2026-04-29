import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const hookCommandHarness = vi.hoisted(() => ({
  logInfo: vi.fn(),
  getHookObservabilitySnapshot: vi.fn(),
}));
const fetchMock = vi.fn();

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: hookCommandHarness.logInfo,
}));

vi.mock('@/lib/apiService.js', () => ({
  getHookObservabilitySnapshot: hookCommandHarness.getHookObservabilitySnapshot,
}));

import { registerHookCommands } from '@apps/mcp-core/commands/hooksCommands.js';

describe('Hook CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    hookCommandHarness.logInfo.mockReset();
    hookCommandHarness.getHookObservabilitySnapshot.mockReset();
    hookCommandHarness.getHookObservabilitySnapshot.mockResolvedValue({
      snapshot: {
        windowHours: 24,
        summary: {
          windowHours: 24,
          registrySize: 1,
          registeredHandlers: 1,
          enabledHandlers: 1,
          disabledEvents: 0,
          audit: {
            windowHours: 24,
            total: 1,
            fired: 1,
            failed: 0,
            skipped: 0,
            blocked: 0,
            deadLetter: 0,
            failureRate: 0,
          },
          circuitOpenCount: 0,
          dlqCount: 0,
        },
        registry: [
          {
            event: 'test.hook',
            category: 'business',
            description: 'Test hook',
            priority: 7,
            timeoutMs: 1000,
            retryOnFail: false,
            enabled: true,
            handlerCount: 1,
            enabledHandlerCount: 1,
            disabledHandlerCount: 0,
            handlers: [
              {
                id: '1',
                handlerName: 'handler',
                priority: 7,
                timeoutMs: 1000,
                retryOnFail: false,
                category: 'business',
                description: 'Test hook',
                enabled: true,
                metadata: {},
              },
            ],
            circuit: {
              event: 'test.hook',
              state: 'closed',
              failures: 0,
              threshold: 3,
              coolDownMs: 60000,
            },
            catalogued: false,
          },
        ],
        executions: [],
        dlq: [],
        circuits: [],
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  it('registers the hooks command group', () => {
    const program = new Command();
    registerHookCommands(program);

    const hooks = program.commands.find((command) => command.name() === 'hooks');
    expect(hooks).toBeDefined();
    expect(hooks?.aliases()).toContain('hook');
    expect(hooks?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['summary', 'list', 'executions', 'dlq', 'fire', 'retry-dlq', 'enable', 'disable']),
    );
  });

  it('renders a hook summary snapshot', async () => {
    const program = new Command();
    registerHookCommands(program);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'hooks', 'summary']);

    expect(hookCommandHarness.getHookObservabilitySnapshot).toHaveBeenCalledWith(24);
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hook Engine Snapshot');
    expect(output).toContain('Executions:');
  });

  it('fires a hook event through the API', async () => {
    const program = new Command();
    registerHookCommands(program);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          summary: {
            status: 'fired',
            firedCount: 1,
            failedCount: 0,
            deadLetterCount: 0,
            retriedCount: 0,
            errors: [],
          },
        }),
    } as Response);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'hooks', 'fire', 'test.hook', '--payload', '{"ok":true}']);

    expect(hookCommandHarness.logInfo).toHaveBeenCalledWith('CLI', 'Hook fired: test.hook');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('"status": "fired"');
  });
});
