import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerHROnboardingCommands } from '@apps/mcp-core/commands/hrOnboardingCommands.js';
import { registerHRTimesheetCommands } from '@apps/mcp-core/commands/hrTimesheetCommands.js';

const { fetchMock, infoMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  infoMock: vi.fn(),
}));

vi.stubGlobal('fetch', fetchMock);

describe('HR timesheet CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        success: true,
        timestamp: '2026-04-08T12:00:00.000Z',
        snapshot: {
          checkedAt: '2026-04-08T12:00:00.000Z',
          headline: 'HR timesheet and culture flow is healthy.',
          recommendation: 'Keep the read-only cockpit visible and use the latest runs to spot regressions early.',
          counts: {
            entries: 2,
            employees: 2,
            monthlyExports: 1,
            dailyAlertRuns: 1,
          },
          latestMonthlyExport: {
            month: '2026-04',
            status: 'completed',
            employeeCount: 2,
            totalEntries: 2,
            totalHours: 14,
            outputPath: 'data/hr-timesheet/exports/timesheet-export-2026-04.csv',
            updatedAt: '2026-04-08T11:00:00.000Z',
          },
          latestDailyAlert: {
            date: '2026-04-07',
            status: 'completed',
            generatedCount: 2,
            suppressedCount: 0,
            updatedAt: '2026-04-08T11:30:00.000Z',
          },
          alertTotalsByType: {
            birthday: 1,
            anniversary: 1,
          },
        },
      })),
    } as Response);
    vi.spyOn(console, 'info').mockImplementation(infoMock);
  });

  it('registers the hr timesheet command group and status subcommand', () => {
    const program = new Command();
    registerHROnboardingCommands(program);
    registerHRTimesheetCommands(program);

    const hr = program.commands.find((command) => command.name() === 'hr');
    expect(hr).toBeDefined();

    const subgroupNames = hr?.commands.map((command) => command.name()) ?? [];
    expect(subgroupNames).toEqual(expect.arrayContaining(['onboarding', 'timesheet']));

    const timesheet = hr?.commands.find((command) => command.name() === 'timesheet');
    expect(timesheet?.commands.map((command) => command.name())).toEqual(expect.arrayContaining(['status']));
  });

  it('prints the read-only status snapshot', async () => {
    const program = new Command();
    registerHROnboardingCommands(program);
    registerHRTimesheetCommands(program);

    await program.parseAsync(['node', 'test', 'hr', 'timesheet', 'status']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/hr/timesheet/status',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const output = infoMock.mock.calls.map((args) => args.map((chunk) => String(chunk)).join(' ')).join('\n');
    expect(output).toContain('HR Timesheet & Culture Státusz');
    expect(output).toContain('HR timesheet and culture flow is healthy.');
    expect(output).toContain('Havi export futások: 1');
    expect(output).toContain('Birthday: 1');
    expect(output).toContain('completed');
  });
});
