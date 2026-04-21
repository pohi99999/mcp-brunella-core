import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerLeadCommands } from '../src/cli/leadCommands.js';

const spinnerStop = vi.fn();
const spinnerFail = vi.fn();
const spinnerSucceed = vi.fn();

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: spinnerStop,
      fail: spinnerFail,
      succeed: spinnerSucceed,
    })),
  })),
}));

describe('Lead CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    spinnerSucceed.mockReset();
  });

  it('should register the leads command group with expected subcommands', () => {
    const program = new Command();
    registerLeadCommands(program);

    const leads = program.commands.find((command) => command.name() === 'leads');
    expect(leads).toBeDefined();
    expect(leads?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['run', 'status', 'list']),
    );
  });

  it('should render run success details to stdout', async () => {
    const program = new Command();
    registerLeadCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: 'job-123', message: 'ok' }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'leads', 'run', 'fogorvos Budapest', '--limit', '12']);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/business-jobs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"type":"lead_mining"');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"query":"fogorvos Budapest"');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"limit":12');
    expect(spinnerSucceed).toHaveBeenCalledWith(expect.stringContaining('Lead mining elindítva!'));

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Lekérdezés: "fogorvos Budapest" | Limit: 12');
    expect(output).toContain('Állapot: brunella leads status');
  });

  it('should render empty status state to stdout', async () => {
    const program = new Command();
    registerLeadCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [] }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'leads', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Nincs korábbi lead mining job. Futtatás: brunella leads run');
    expect(spinnerStop).toHaveBeenCalled();
  });

  it('should render lead list details to stdout', async () => {
    const program = new Command();
    registerLeadCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          leads: [
            {
              id: 'lead-1',
              company_name: 'Smile Dental',
              contact_email: 'hello@smile.hu',
              email_status: 'valid',
              icebreaker_text: 'Nagyon erős budapesti jelenlét és modern weboldal.',
              created_at: '2026-04-01T20:00:00.000Z',
            },
          ],
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'leads', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('LEADEK (1/1)');
    expect(output).toContain('Smile Dental');
    expect(output).toContain('hello@smile.hu');
    expect(output).toContain('(valid)');
    expect(output).toContain('Icebreaker:');
  });

  it('should render network errors to stderr and exit', async () => {
    const program = new Command();
    registerLeadCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Backend offline'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as (code?: string | number | null | undefined) => never);

    await expect(program.parseAsync(['node', 'test', 'leads', 'run'])).rejects.toThrow('process.exit');

    expect(spinnerFail).toHaveBeenCalledWith(expect.stringContaining('Kapcsolódási hiba'));
    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Backend offline');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
