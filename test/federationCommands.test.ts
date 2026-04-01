import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerFederationCommands } from '../src/cli/federationCommands.js';

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

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('Federation CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    spinnerSucceed.mockReset();
  });

  it('should register federation command group with expected subcommands', () => {
    const program = new Command();
    registerFederationCommands(program);

    const federation = program.commands.find((command) => command.name() === 'federation');
    expect(federation).toBeDefined();
    expect(federation?.aliases()).toContain('fed');
    expect(federation?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['status', 'peers', 'negotiations']),
    );
  });

  it('should render peers output to stdout', async () => {
    const program = new Command();
    registerFederationCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            peers: [
              {
                peerId: 'peer-1',
                displayName: 'Brunella Edge',
                endpoint: 'https://edge.example.com',
                trustState: 'trusted',
                trustScore: 98,
              },
            ],
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'federation', 'peers']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Federált Partnerek (1)');
    expect(output).toContain('ID: peer-1');
    expect(output).toContain('Név: Brunella Edge');
    expect(output).toContain('Endpoint: https://edge.example.com');
    expect(output).toContain('Állapot: trusted');
    expect(output).toContain('Score: 98');
    expect(spinnerStop).toHaveBeenCalled();
  });

  it('should render negotiations output to stdout', async () => {
    const program = new Command();
    registerFederationCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            sessions: [
              {
                sessionId: 'session-12345678',
                peerId: 'peer-2',
                state: 'negotiating',
                initialOffer: { capabilities: ['mcp', 'rag'] },
                updatedAt: '2026-04-01T20:00:00.000Z',
              },
            ],
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'federation', 'negotiations']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Aktív Tárgyalások (1)');
    expect(output).toContain('ID: session-');
    expect(output).toContain('Partner: peer-2');
    expect(output).toContain('Állapot: negotiating');
    expect(output).toContain('Képességek: mcp, rag');
    expect(spinnerStop).toHaveBeenCalled();
  });

  it('should use peers output when status runs without TTY', async () => {
    const program = new Command();
    registerFederationCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            peers: [
              {
                peerId: 'peer-tty',
                displayName: 'TTY Peer',
                endpoint: 'https://tty.example.com',
                trustState: 'pending',
                trustScore: 50,
              },
            ],
          }),
        ),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: false,
    });

    await program.parseAsync(['node', 'test', 'federation', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Federált Partnerek (1)');
    expect(output).toContain('TTY Peer');

    Object.defineProperty(process.stdin, 'isTTY', {
      configurable: true,
      value: originalIsTTY,
    });
  });
});
