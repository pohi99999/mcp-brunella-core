import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerHROnboardingCommands } from '../src/cli/hrOnboardingCommands.js';

const spinnerStop = vi.fn();
const spinnerFail = vi.fn();
const spinnerSucceed = vi.fn();

const { samplesMock, dryRunMock, jobsMock } = vi.hoisted(() => ({
  samplesMock: vi.fn(),
  dryRunMock: vi.fn(),
  jobsMock: vi.fn(),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn(() => ({
      stop: spinnerStop,
      fail: spinnerFail,
      succeed: spinnerSucceed,
    })),
  })),
}));

vi.mock('../src/dashboard/lib/hrOnboardingApi.js', () => ({
  getHROnboardingSamples: samplesMock,
  runHROnboardingDryRun: dryRunMock,
  getHROnboardingJobs: jobsMock,
}));

describe('HR onboarding CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    spinnerStop.mockReset();
    spinnerFail.mockReset();
    spinnerSucceed.mockReset();
    samplesMock.mockReset();
    dryRunMock.mockReset();
    jobsMock.mockReset();
    samplesMock.mockResolvedValue([
      {
        key: 'webhook-new-hire',
        label: 'Webhook new hire',
        description: 'Teljes onboarding webhook payload.',
        payload: { employeeName: 'Kiss Anna', email: 'anna.kiss@example.com' },
      },
    ]);
    dryRunMock.mockResolvedValue({
      jobId: 'job-1',
      normalized: { employeeName: 'Kiss Anna' },
      report: {
        status: 'blocked',
        timestamp: '2026-04-04T12:00:00.000Z',
        summary: { total: 1, ready: 0, blocked: 1 },
        missing: ['email'],
        issues: [],
        checklist: [
          {
            id: 'workspace',
            label: 'Google Workspace provisioning dry-run',
            required: true,
            state: 'blocked',
            details: 'Workspace auth missing.',
          },
        ],
        integrations: [],
        nextSteps: ['Configure googleWorkspace support before live onboarding.'],
      },
    });
    jobsMock.mockResolvedValue([
      {
        id: 'job-1',
        type: 'hr_onboarding',
        status: 'completed',
        query: 'Kiss Anna · HR generalist',
        results_json: JSON.stringify({
          report: {
            status: 'ready',
            summary: { total: 1, ready: 1, blocked: 0 },
            nextSteps: ['Ready'],
          },
        }),
        metadata: null,
        created_at: '2026-04-04T12:00:00.000Z',
        updated_at: '2026-04-04T12:00:00.000Z',
      },
    ]);
  });

  it('registers the HR onboarding command group', () => {
    const program = new Command();
    registerHROnboardingCommands(program);

    const hr = program.commands.find((command) => command.name() === 'hr');
    expect(hr).toBeDefined();
    const onboarding = hr?.commands.find((command) => command.name() === 'onboarding');
    expect(onboarding?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['mintak', 'futtat', 'allapot']),
    );
  });

  it('prints sample payloads', async () => {
    const program = new Command();
    registerHROnboardingCommands(program);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await program.parseAsync(['node', 'test', 'hr', 'onboarding', 'mintak']);

    expect(samplesMock).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls.map((call) => call.map((chunk) => String(chunk)).join(' ')).join('\n');
    expect(output).toContain('HR ONBOARDING MINTÁK');
    expect(output).toContain('webhook-new-hire');
    expect(output).toContain('Teljes onboarding webhook payload.');
  });

  it('runs a dry-run from JSON payload', async () => {
    const program = new Command();
    registerHROnboardingCommands(program);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const payload = {
      employeeName: 'Kiss Anna',
      email: 'anna.kiss@example.com',
      jobTitle: 'HR generalist',
      managerEmail: 'lead@example.com',
      startDate: '2026-04-15',
      checklist: ['Create workspace'],
    };

    await program.parseAsync([
      'node',
      'test',
      'hr',
      'onboarding',
      'futtat',
      '--json',
      JSON.stringify(payload),
    ]);

    expect(dryRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeName: 'Kiss Anna',
        source: 'cli',
      }),
    );
    const output = infoSpy.mock.calls.map((call) => call.map((chunk) => String(chunk)).join(' ')).join('\n');
    expect(output).toContain('Job ID:');
    expect(output).toContain('Kiss Anna');
    expect(output).toContain('BLOCKED');
  });

  it('prints job status summaries', async () => {
    const program = new Command();
    registerHROnboardingCommands(program);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await program.parseAsync(['node', 'test', 'hr', 'onboarding', 'allapot', '--limit', '3']);

    expect(jobsMock).toHaveBeenCalledWith(3);
    const output = infoSpy.mock.calls.map((call) => call.map((chunk) => String(chunk)).join(' ')).join('\n');
    expect(output).toContain('HR ONBOARDING ÁLLAPOT');
    expect(output).toContain('Kiss Anna · HR generalist');
    expect(output).toContain('READY');
  });
});
