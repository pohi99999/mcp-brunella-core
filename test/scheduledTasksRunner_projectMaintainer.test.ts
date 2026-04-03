import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduledTasksRunner } from '../src/server/schedulers/scheduledTasksRunner.js';

const mockDb = {
  prepare: vi.fn(),
};

const ingestProjectMaintainerReportMock = vi.fn();

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

describe('ScheduledTasksRunner project maintainer handler', () => {
  beforeEach(() => {
    ingestProjectMaintainerReportMock.mockReset();
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
});
