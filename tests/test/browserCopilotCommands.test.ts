import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerBrowserCopilotCommands } from '@apps/mcp-core/commands/browserCopilotCommands.js';

const spinnerSucceed = vi.fn();
const spinnerFail = vi.fn();

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      succeed: spinnerSucceed,
      fail: spinnerFail,
    })),
  })),
}));

describe('Browser Copilot CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerSucceed.mockReset();
    spinnerFail.mockReset();
  });

  it('should register the browser-copilot command group with expected subcommands', () => {
    const program = new Command();
    registerBrowserCopilotCommands(program);

    const browserCopilot = program.commands.find((command) => command.name() === 'browser-copilot');
    expect(browserCopilot).toBeDefined();
    expect(browserCopilot?.aliases()).toContain('bc');

    const subcommandNames = browserCopilot?.commands.map((command) => command.name()) ?? [];
    expect(subcommandNames).toEqual(expect.arrayContaining(['status', 'send', 'confirm', 'pause', 'resume', 'reset', 'configure']));
  });

  it('should print session details through stdout for the status command', async () => {
    const program = new Command();
    registerBrowserCopilotCommands(program);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        success: true,
        session: {
          status: 'active',
          mode: 'guide',
          browserEndpoint: 'https://browser.example.com',
          viewportEngine: 'chrome-acp',
          actionEngine: 'robotkez',
          chromeAcpReachable: true,
          paused: false,
          currentInstruction: 'Nyisd meg a dashboardot',
          pendingInstruction: 'Kattints a státuszra',
        },
      })),
    } as Response);

    await program.parseAsync(['node', 'test', 'browser-copilot', 'status']);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/browser-copilot/session',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(spinnerSucceed).toHaveBeenCalledWith('Session betöltve');

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Browser Copilot session');
    expect(output).toContain('Állapot: active');
    expect(output).toContain('Mód: guide');
    expect(output).toContain('Browser endpoint: https://browser.example.com');
    expect(output).toContain('Viewport: chrome-acp');
    expect(output).toContain('Action engine: robotkez');
    expect(output).toContain('Chrome ACP: elérhető');
    expect(output).toContain('Paused: nem');
    expect(output).toContain('Aktuális instrukció: Nyisd meg a dashboardot');
    expect(output).toContain('Pending guide: Kattints a státuszra');
  });

  it('should fail gracefully when the session request fails', async () => {
    const program = new Command();
    registerBrowserCopilotCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(JSON.stringify({ error: 'Backend offline' })),
    } as Response);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(program.parseAsync(['node', 'test', 'browser-copilot', 'status'])).rejects.toThrow('process.exit');

    expect(spinnerFail).toHaveBeenCalledWith('Backend offline');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
