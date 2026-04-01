import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const intelligenceHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  spinnerStop: vi.fn(),
  spinnerFail: vi.fn(),
  spinnerSucceed: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: intelligenceHarness.promptMock,
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: intelligenceHarness.spinnerStop,
      fail: intelligenceHarness.spinnerFail,
      succeed: intelligenceHarness.spinnerSucceed,
    })),
  })),
}));

import { registerIntelligenceCommands } from '../src/cli/intelligenceCommands.js';

const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

function setIsTTY(value: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    configurable: true,
    value,
  });
}

function createOverview() {
  return {
    generatedAt: '2026-04-01T22:00:00.000Z',
    signals: {
      total: 10,
      pendingReview: 2,
      approved: 4,
      promoted: 3,
      rejected: 1,
    },
    stats: {
      golden: {
        totalSamples: 7,
        newSinceLastTraining: 2,
        lastTrainingAt: '2026-03-31T20:00:00.000Z',
      },
      memory: {
        summary: {
          totalEntries: 9,
          avgConfidence: 0.83,
          totalReuses: 14,
        },
      },
      index: {
        lastStats: {
          fileCount: 12,
          chunkCount: 34,
        },
        schedulerActive: true,
      },
      tools: {
        totalRuns: 18,
        successRate: 88.5,
      },
    },
    feedback: {
      avgScore: 0.72,
      contradictionCount: 1,
    },
    governance: {
      guardrails: ['No silent promotion', 'Human review required'],
      sourceClasses: [{ id: 'market', label: 'Market' }],
    },
    reviewQueue: [
      {
        id: 'sig-1',
        sourceClass: 'market',
        title: 'Fresh market signal',
        score: 0.91,
        status: 'pending_review',
        stance: 'supports',
        updatedAt: '2026-04-01T21:30:00.000Z',
      },
    ],
  };
}

describe('Intelligence CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    intelligenceHarness.promptMock.mockReset();
    intelligenceHarness.spinnerStop.mockReset();
    intelligenceHarness.spinnerFail.mockReset();
    intelligenceHarness.spinnerSucceed.mockReset();
    process.exitCode = undefined;
  });

  afterEach(() => {
    if (originalIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalIsTTY);
    } else {
      Reflect.deleteProperty(process.stdin, 'isTTY');
    }
  });

  it('should register intelligence watch command', () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    const intelligence = program.commands.find((command) => command.name() === 'intelligence');
    expect(intelligence).toBeDefined();
    const watch = intelligence?.commands.find((command) => command.name() === 'watch');
    expect(watch).toBeDefined();
    expect(watch?.aliases()).toContain('figyelj');
  });

  it('should render JSON overview to stdout', async () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(createOverview())),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'intelligence', 'watch', '--json']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('"generatedAt": "2026-04-01T22:00:00.000Z"');
    expect(output).toContain('"pendingReview": 2');
  });

  it('should render overview table and guardrails to stdout for once mode', async () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(createOverview())),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'intelligence', 'watch', '--once']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Intelligence Watch — Overview');
    expect(output).toContain('Guardrails:');
    expect(output).toContain('No silent promotion');
    expect(output).toContain('Fresh market signal');
    expect(intelligenceHarness.spinnerStop).toHaveBeenCalled();
  });

  it('should add a signal interactively and print saved status', async () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    setIsTTY(true);
    intelligenceHarness.promptMock
      .mockResolvedValueOnce({ action: 'add' })
      .mockResolvedValueOnce({
        sourceClass: 'market',
        source: 'https://example.com',
        title: 'Fresh signal',
        summary: 'Signal summary',
        entity: '',
        relation: '',
        stance: 'supports',
        biasLabel: 'low',
        provenance: 'report',
        confidence: 0.78,
      })
      .mockResolvedValueOnce({ action: 'exit' });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(createOverview())),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: 'sig-2',
              sourceClass: 'market',
              title: 'Fresh signal',
              score: 0.78,
              status: 'pending_review',
              stance: 'supports',
              updatedAt: '2026-04-01T22:10:00.000Z',
            }),
          ),
      } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'intelligence', 'watch']);

    expect(intelligenceHarness.spinnerSucceed).toHaveBeenCalledWith('Mentve: Fresh signal');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Status: pending_review | Score: 0.78');
  });

  it('should review queue interactively and print signal table', async () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    setIsTTY(true);
    intelligenceHarness.promptMock
      .mockResolvedValueOnce({ action: 'review' })
      .mockResolvedValueOnce({ signalId: 'sig-1' })
      .mockResolvedValueOnce({ decision: 'approve' })
      .mockResolvedValueOnce({ note: 'Looks good' })
      .mockResolvedValueOnce({ action: 'exit' });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(createOverview().reviewQueue)),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              id: 'sig-1',
              title: 'Fresh market signal',
              status: 'approved',
            }),
          ),
      } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'intelligence', 'watch']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Fresh market signal');
    expect(output).toContain('pending_review');
    expect(intelligenceHarness.spinnerSucceed).toHaveBeenCalledWith('Kész: Fresh market signal -> approved');
  });

  it('should render fetch failures to stderr and set exitCode', async () => {
    const program = new Command();
    registerIntelligenceCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Overview offline'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'intelligence', 'watch', '--once']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Overview offline');
    expect(process.exitCode).toBe(1);
  });
});
