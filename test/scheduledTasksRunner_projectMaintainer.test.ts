import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduledTasksRunner } from '../src/server/schedulers/scheduledTasksRunner.js';

const mockDb = {
  prepare: vi.fn(),
};

const ingestProjectMaintainerReportMock = vi.fn();
const crmHarness = vi.hoisted(() => ({
  dispatchDueCrmFollowUpActions: vi.fn(),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => mockDb),
}));

vi.mock('../src/server/services/projectMaintainerService.js', () => ({
  runProjectMaintainerReport: vi.fn(async () => ({
    id: 'pmr-1',
    generatedAt: '2026-04-02T22:00:00.000Z',
    triggeredBy: 'scheduler',
    findings: [],
    suggestions: [],
    trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
    dryRun: true,
  })),
  initProjectMaintainerSchema: vi.fn(),
}));

vi.mock('../src/core/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      ingestProjectMaintainerReport: ingestProjectMaintainerReportMock,
      runNightlyCycle: vi.fn(),
    }),
  },
}));

vi.mock('../src/data/crm_db.js', () => ({
  dispatchDueCrmFollowUpActions: crmHarness.dispatchDueCrmFollowUpActions,
}));

describe('ScheduledTasksRunner project maintainer handler', () => {
  beforeEach(() => {
    ingestProjectMaintainerReportMock.mockReset();
    crmHarness.dispatchDueCrmFollowUpActions.mockReset();
    mockDb.prepare.mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    });
  });

  it('executes project_maintainer handler as dry-run report-only task', async () => {
    const result = await scheduledTasksRunner.executeTask({
      id: 'project-maintainer-nightly',
      title: 'Napi Project Maintainer riport',
      prompt: 'Riport',
      cron_expression: '0 22 * * *',
      handler: 'project_maintainer',
      enabled: true,
      metadata: JSON.stringify({ dryRun: true, triggeredBy: 'scheduler' }),
    });

    expect(result).toEqual(expect.objectContaining({ dryRun: true }));
    expect(ingestProjectMaintainerReportMock).toHaveBeenCalledTimes(1);
  });

  it('executes crm_follow_up_dispatch handler through the CRM helper', async () => {
    crmHarness.dispatchDueCrmFollowUpActions.mockReturnValue({
      generatedAt: '2026-04-05T10:00:00.000Z',
      scanned: 2,
      dispatched: [
        { completed: false, action: { id: 'action-1' } },
      ],
    });

    const result = await scheduledTasksRunner.executeTask({
      id: 'crm-follow-up-dispatch',
      title: 'CRM Follow-Up Due Dispatch',
      prompt: 'Dispatch due CRM follow-up actions for D+3/D+7/D+14 plan steps.',
      cron_expression: '0 * * * *',
      handler: 'crm_follow_up_dispatch',
      enabled: true,
      metadata: JSON.stringify({ dispatchLimit: 25, note: 'scheduler run' }),
    });

    expect(crmHarness.dispatchDueCrmFollowUpActions).toHaveBeenCalledWith({
      limit: 25,
      note: 'scheduler run',
    });
    expect(result).toEqual(expect.objectContaining({ scanned: 2 }));
  });
});
