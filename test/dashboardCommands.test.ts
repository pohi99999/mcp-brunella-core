import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const dashboardHarness = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/dashboard/lib/apiService.js', () => ({
  fetchWithTimeout: dashboardHarness.fetchWithTimeout,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: dashboardHarness.logInfo,
  logError: dashboardHarness.logError,
}));

import { dashboardCommand } from '../src/cli/dashboardCommands.js';

describe('Dashboard CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dashboardHarness.fetchWithTimeout.mockReset();
    dashboardHarness.logInfo.mockReset();
    dashboardHarness.logError.mockReset();
  });

  it('should register dashboard and status commands', () => {
    const program = new Command();
    dashboardCommand(program);

    const dashboard = program.commands.find((command) => command.name() === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status']),
    );
    expect(program.commands.find((command) => command.name() === 'status')).toBeDefined();
  });

  it('should render dashboard status to stdout', async () => {
    const program = new Command();
    dashboardCommand(program);

    dashboardHarness.fetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'healthy',
          timestamp: '2026-04-01T20:00:00.000Z',
          components: {
            backendHealth: { status: 'ok', services: {}, timestamp: '2026-04-01T20:00:00.000Z' },
            agents: [
              { name: 'Developer', status: 'idle', description: 'Builds safe production changes with good coverage' },
            ],
            mcp: [
              { name: 'core', status: 'online', tools: [{ name: 'ping' }, { name: 'build' }] },
            ],
            database: { status: 'ok' },
            uiRender: { status: 'ok', message: 'Rendered' },
            socket: { status: 'ok', message: 'Connected' },
          },
        }),
    });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'dashboard', 'status']);

    expect(dashboardHarness.logInfo).toHaveBeenCalledWith('CLI', 'Lekérdezem a Dashboard állapotát...');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Brunella Dashboard Státusz');
    expect(output).toContain('Összesített állapot: healthy');
    expect(output).toContain('Backend Health: ok');
    expect(output).toContain('Developer: idle');
    expect(output).toContain('core: online (2 eszköz)');
  });

  it('should render empty agents and mcp states to stdout', async () => {
    const program = new Command();
    dashboardCommand(program);

    dashboardHarness.fetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'degraded',
          timestamp: '2026-04-01T20:00:00.000Z',
          components: {
            backendHealth: { status: 'warn', services: {}, timestamp: '2026-04-01T20:00:00.000Z' },
            agents: [],
            mcp: [],
            database: { status: 'warn' },
            uiRender: { status: 'warn', message: 'Slow' },
            socket: { status: 'offline', message: 'Disconnected' },
          },
        }),
    });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Nincs regisztrált ügynök.');
    expect(output).toContain('Nincsenek konfigurált MCP szerverek.');
  });

  it('should log embedded dashboard errors', async () => {
    const program = new Command();
    dashboardCommand(program);

    dashboardHarness.fetchWithTimeout.mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: 'error',
          timestamp: '2026-04-01T20:00:00.000Z',
          error: 'Health check failed',
          components: {
            backendHealth: { status: 'error', services: {}, timestamp: '2026-04-01T20:00:00.000Z' },
            agents: [],
            mcp: [],
            database: { status: 'error' },
            uiRender: { status: 'error', message: 'Failed' },
            socket: { status: 'error', message: 'Failed' },
          },
        }),
    });

    await program.parseAsync(['node', 'test', 'dashboard', 'status']);

    expect(dashboardHarness.logError).toHaveBeenCalledWith('CLI', 'Hiba: Health check failed');
  });

  it('should log fetch failures through logger', async () => {
    const program = new Command();
    dashboardCommand(program);

    dashboardHarness.fetchWithTimeout.mockRejectedValue(new Error('Dashboard offline'));

    await program.parseAsync(['node', 'test', 'dashboard', 'status']);

    expect(dashboardHarness.logError).toHaveBeenCalledWith(
      'CLI',
      expect.stringContaining('Dashboard offline'),
    );
  });
});
