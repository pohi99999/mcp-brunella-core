import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const chromeAcpHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  existsSyncMock: vi.fn(),
  spawnSyncMock: vi.fn(),
  spawnMock: vi.fn(),
  unrefMock: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: chromeAcpHarness.promptMock,
  },
}));

vi.mock('fs', () => ({
  existsSync: chromeAcpHarness.existsSyncMock,
}));

vi.mock('child_process', () => ({
  spawn: chromeAcpHarness.spawnMock,
  spawnSync: chromeAcpHarness.spawnSyncMock,
}));

import { registerChromeAcpCommands } from '../src/cli/chromeAcpCommands.js';

describe('Chrome ACP CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chromeAcpHarness.promptMock.mockReset();
    chromeAcpHarness.existsSyncMock.mockReset();
    chromeAcpHarness.spawnSyncMock.mockReset();
    chromeAcpHarness.spawnMock.mockReset();
    chromeAcpHarness.unrefMock.mockReset();
    chromeAcpHarness.spawnMock.mockReturnValue({
      unref: chromeAcpHarness.unrefMock,
    });
  });

  it('should register the chrome-acp command group with expected subcommands', () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    const chromeAcp = program.commands.find((command) => command.name() === 'chrome-acp');
    expect(chromeAcp).toBeDefined();
    expect(chromeAcp?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['doctor', 'status', 'start', 'install']),
    );
  });

  it('should render doctor output and installation hint to stdout', async () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    chromeAcpHarness.spawnSyncMock.mockImplementation((command: string, args: string[]) => {
      if (command === 'npm' && args[0] === 'prefix') {
        return { status: 0, stdout: 'C:\\Users\\tester\\AppData\\Roaming\\npm\n' };
      }

      if (command === 'where' && args[0] === 'acp-proxy') {
        return { status: 1 };
      }

      if (command === 'where' && args[0] === 'claude') {
        return { status: 0 };
      }

      return { status: 1, stdout: '' };
    });
    chromeAcpHarness.existsSyncMock.mockImplementation((targetPath: string) =>
      targetPath.endsWith('start-chrome-acp.bat'),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 503 } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'chrome-acp', 'doctor']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chrome ACP állapot');
    expect(output).toContain('acp-proxy:');
    expect(output).toContain('HIÁNYZIK');
    expect(output).toContain('Telepítés szükséges:');
    expect(output).toContain('npm install -g @chrome-acp/proxy-server');
  });

  it('should render reachable status to stdout', async () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'chrome-acp', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chrome ACP elérhető: http://localhost:9315');
  });

  it('should start Chrome ACP with the Windows start script', async () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    chromeAcpHarness.existsSyncMock.mockReturnValue(true);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'chrome-acp', 'start']);

    expect(chromeAcpHarness.spawnMock).toHaveBeenCalledWith(
      'cmd',
      ['/c', 'start', '', expect.stringContaining('start-chrome-acp.bat')],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }),
    );
    expect(chromeAcpHarness.unrefMock).toHaveBeenCalledOnce();

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chrome ACP indítás elindítva külön ablakban.');
    expect(output).toContain('UI: http://localhost:9315');
  });

  it('should run global install and print success output', async () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    chromeAcpHarness.spawnSyncMock.mockReturnValue({ status: 0 });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'chrome-acp', 'install', '--run']);

    expect(chromeAcpHarness.spawnSyncMock).toHaveBeenCalledWith(
      'npm',
      [
        'install',
        '-g',
        '@chrome-acp/proxy-server',
        '@anthropic-ai/claude-code',
        '@zed-industries/claude-code-acp',
      ],
      expect.objectContaining({
        stdio: 'inherit',
        shell: true,
      }),
    );

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chrome ACP csomagok globális telepítése...');
    expect(output).toContain('Globális Chrome ACP telepítés kész.');
  });

  it('should handle interactive install selection through stdout', async () => {
    const program = new Command();
    registerChromeAcpCommands(program);

    chromeAcpHarness.promptMock.mockResolvedValue({ action: 'install' });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'chrome-acp']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('npm install -g @chrome-acp/proxy-server');
  });
});
