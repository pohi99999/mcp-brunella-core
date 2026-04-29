import { Command } from 'commander';
import { dashboardCommand } from './dashboardCommands.js';
import * as apiService from '../dashboard/lib/apiService.js';
import * as logger from '@packages/utils/logger.js';

describe('dashboardCommand', () => {
  let program: Command;
  let logInfoSpy: ReturnType<typeof vi.spyOn>;
  let logErrorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    dashboardCommand(program);
    logInfoSpy = vi.spyOn(logger, 'logInfo').mockImplementation(() => {});
    logErrorSpy = vi.spyOn(logger, 'logError').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display dashboard status successfully', async () => {
    const mockStatus = {
      status: 'HEALTHY',
      components: {
        backendHealth: { status: 'HEALTHY', services: {}, timestamp: new Date().toISOString() },
        agents: [{ name: 'AgentA', status: 'idle', description: 'DescA' }],
        mcp: [{ name: 'MCP1', status: 'CONNECTED', tools: [] }],
        database: { status: 'connected' },
        uiRender: { status: 'ok', message: 'N/A (kliens oldali check)' },
        socket: { status: 'ok', message: 'Legalább egy kliens csatlakozva.' },
      },
      timestamp: new Date().toISOString(),
    };

    vi.spyOn(apiService, 'fetchWithTimeout').mockResolvedValueOnce({
      ok: true, 
      json: () => Promise.resolve(mockStatus)
    } as Response);

    await program.parseAsync(['node', 'test', 'status']);

    expect(logInfoSpy).toHaveBeenCalledWith('CLI', 'Lekérdezem a Dashboard állapotát...');
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Összesített állapot: HEALTHY'));
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Backend Health: HEALTHY'));
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('AgentA: idle'));
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('MCP1: CONNECTED'));
    expect(logErrorSpy).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(apiService, 'fetchWithTimeout').mockRejectedValueOnce(new Error('Network error'));

    await program.parseAsync(['node', 'test', 'status']);

    expect(logInfoSpy).toHaveBeenCalledWith('CLI', 'Lekérdezem a Dashboard állapotát...');
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Hiba a Dashboard állapotának lekérdezésekor: Network error'));
    expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining('Összesített állapot'));
  });

  it('should show help if no subcommand is provided', async () => {
    const helpSpy = vi.spyOn(program, 'help').mockImplementation(() => { throw new Error('help called'); });

    // Test top-level 'dashboard' command
    await expect(program.parseAsync(['node', 'test', 'dashboard'])).rejects.toThrow('help called');
    expect(helpSpy).toHaveBeenCalled();
  });
});

