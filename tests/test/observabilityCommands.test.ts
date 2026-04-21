import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const observabilityHarness = vi.hoisted(() => ({
  logInfo: vi.fn(),
  getLlmCallStats: vi.fn(),
  queryLlmCalls: vi.fn(),
  spinnerStart: vi.fn(),
  spinnerSucceed: vi.fn(),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: observabilityHarness.logInfo,
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getLlmCallStats: observabilityHarness.getLlmCallStats,
  queryLlmCalls: observabilityHarness.queryLlmCalls,
}));

vi.mock('ora', () => ({
  default: vi.fn(() => {
    const spinner = {
      start: observabilityHarness.spinnerStart,
      succeed: observabilityHarness.spinnerSucceed,
    };
    observabilityHarness.spinnerStart.mockImplementation(() => spinner);
    return spinner;
  }),
}));

import { registerObservabilityCommands } from '../src/cli/observabilityCommands.js';

describe('Observability CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    observabilityHarness.logInfo.mockReset();
    observabilityHarness.getLlmCallStats.mockReset();
    observabilityHarness.queryLlmCalls.mockReset();
    observabilityHarness.spinnerStart.mockReset();
    observabilityHarness.spinnerSucceed.mockReset();
  });

  it('should register observability subcommands', () => {
    const program = new Command();
    registerObservabilityCommands(program);

    const obs = program.commands.find((command) => command.name() === 'observability');
    expect(obs).toBeDefined();
    expect(obs?.aliases()).toContain('obs');
    expect(obs?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['stats', 'calls', 'agent-diagnostics', 'task-logs']),
    );
  });

  it('should render stats box to stdout', async () => {
    const program = new Command();
    registerObservabilityCommands(program);

    observabilityHarness.getLlmCallStats.mockReturnValue({
      totalCalls: 12,
      successRate: 97.5,
      avgDurationMs: 420,
      totalTokens: 54321,
      totalCostUsd: 1.2345,
      byProvider: [{ provider: 'github', count: 8, avgDuration: 400, tokens: 42000, cost: 0.8 }],
      byModel: [],
      recentErrors: [{ timestamp: '2026-04-01T21:00:00.000Z', provider: 'github', error: 'timeout' }],
    });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'observability', 'stats']);

    expect(observabilityHarness.logInfo).toHaveBeenCalledWith('CLI', 'LLM Observability Stats lekérdezve');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('LLM Observability Összefoglaló');
    expect(output).toContain('Összes hívás:');
    expect(output).toContain('github');
    expect(output).toContain('Legutóbbi hibák');
  });

  it('should render recent calls to stdout', async () => {
    const program = new Command();
    registerObservabilityCommands(program);

    observabilityHarness.queryLlmCalls.mockReturnValue([
      {
        id: 1,
        timestamp: '2026-04-01T21:10:00.000Z',
        provider: 'github',
        model: 'gpt-5-mini',
        task_type: 'chat',
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        duration_ms: 1200,
        success: 1,
        error: null,
        fallback_used: 0,
        fallback_reason: null,
        user_id: null,
        cost_usd: 0.0123,
      },
    ]);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'observability', 'calls', '--limit', '5', '--provider', 'github']);

    expect(observabilityHarness.queryLlmCalls).toHaveBeenCalledWith({ provider: 'github', limit: 5 });
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Legutóbbi LLM hívások');
    expect(output).toContain('github');
    expect(output).toContain('gpt-5-mini');
    expect(output).toContain('Összesen:');
  });

  it('should render agent diagnostics and tasks to stdout', async () => {
    const program = new Command();
    registerObservabilityCommands(program);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [{ name: 'Developer', status: 'idle' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            tasks: [
              {
                id: 11,
                agent: 'Developer',
                status: 'done',
                created_at: '2026-04-01T21:00:00.000Z',
                completed_at: '2026-04-01T21:01:00.000Z',
                result: { summary: 'done' },
              },
            ],
          }),
      } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'observability', 'agent-diagnostics', 'Developer', '--limit', '3']);

    expect(observabilityHarness.spinnerSucceed).toHaveBeenCalledWith('Lekérdezés kész');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Agent diagnostics: Developer');
    expect(output).toContain('"name": "Developer"');
    expect(output).toContain('#11 [done]');
  });

  it('should render task logs and result to stdout', async () => {
    const program = new Command();
    registerObservabilityCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          task: {
            agent: 'Developer',
            status: 'done',
            logs: [
              { timestamp: '2026-04-01T21:00:00.000Z', level: 'info', message: 'Started' },
            ],
            result: { ok: true },
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'observability', 'task-logs', '42']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Task #42 — Developer — done');
    expect(output).toContain('[info] Started');
    expect(output).toContain('"ok": true');
  });

  it('should render invalid task id to stderr and exit', async () => {
    const program = new Command();
    registerObservabilityCommands(program);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(program.parseAsync(['node', 'test', 'observability', 'task-logs', 'abc'])).rejects.toThrow('process.exit');

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Érvénytelen taskId');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
