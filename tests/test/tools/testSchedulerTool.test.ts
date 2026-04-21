import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestRun, TestStats } from '../../src/core/testResultsService.js';

const schedulerMocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  runTests: vi.fn(),
  getSchedulerStatus: vi.fn(),
  getTestStats: vi.fn(),
  getTestRuns: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logInfo: schedulerMocks.logInfo,
  logError: schedulerMocks.logError,
}));

vi.mock('../../src/server/schedulers/testRunner.js', () => ({
  runTests: schedulerMocks.runTests,
  getSchedulerStatus: schedulerMocks.getSchedulerStatus,
}));

vi.mock('../../src/core/testResultsService.js', () => ({
  getTestStats: schedulerMocks.getTestStats,
  getTestRuns: schedulerMocks.getTestRuns,
}));

import {
  testSchedulerRunHandler,
  testSchedulerStatusHandler,
} from '../../src/tools/testSchedulerTool.js';

function createTestRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 'run-1',
    scheduledTime: '2026-01-01T00:00:00.000Z',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: '2026-01-01T00:00:01.000Z',
    status: 'passed',
    totalTests: 3,
    passed: 3,
    failed: 0,
    skipped: 0,
    duration: 1000,
    output: 'ok',
    errorLog: '',
    hostname: 'local',
    triggerType: 'api',
    created_at: '2026-01-01T00:00:01.000Z',
    ...overrides,
  };
}

function createTestStats(overrides: Partial<TestStats> = {}): TestStats {
  return {
    totalRuns: 8,
    passRate: 0.8765,
    averageDuration: 123.6,
    lastRunStatus: 'passed',
    lastRunTime: '2026-01-01T00:00:01.000Z',
    sevenDayStats: {
      passRate: 0.6666,
      passCount: 4,
      failCount: 2,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('testSchedulerTool', () => {
  it('returns the test run id and status for manual triggers', async () => {
    schedulerMocks.runTests.mockResolvedValueOnce(createTestRun({ id: 'run-42', status: 'passed' }));

    const result = await testSchedulerRunHandler({ triggerReason: 'Verify fix' });

    expect(result).toEqual({
      success: true,
      runId: 'run-42',
      status: 'passed',
    });
    expect(schedulerMocks.runTests).toHaveBeenCalledWith('api');
    expect(schedulerMocks.logInfo).toHaveBeenCalledWith(
      'TestSchedulerTool',
      'Triggering manual test run: Verify fix',
    );
  });

  it('returns typed scheduler stats without details by default', async () => {
    schedulerMocks.getSchedulerStatus.mockReturnValue({
      schedule: '0 2 * * *',
      enabled: true,
      active: true,
    });
    schedulerMocks.getTestStats.mockResolvedValue(createTestStats());

    const result = await testSchedulerStatusHandler({});

    expect(result).toEqual({
      success: true,
      schedule: '0 2 * * *',
      enabled: true,
      active: true,
      stats: {
        totalRuns: 8,
        passRate: '87.65%',
        averageDuration: '124ms',
        lastRunStatus: 'passed',
        lastRunTime: '2026-01-01T00:00:01.000Z',
        sevenDayPassRate: '66.66%',
        sevenDayStats: {
          passRate: 0.6666,
          passCount: 4,
          failCount: 2,
        },
      },
    });
    expect(schedulerMocks.getTestRuns).not.toHaveBeenCalled();
  });

  it('includes recent run summaries when requested', async () => {
    schedulerMocks.getSchedulerStatus.mockReturnValue({
      schedule: '0 2 * * *',
      enabled: true,
      active: false,
    });
    schedulerMocks.getTestStats.mockReturnValue(createTestStats());
    schedulerMocks.getTestRuns.mockReturnValue([
      createTestRun({
        id: 'run-99',
        status: 'failed',
        duration: 250,
        passed: 2,
        failed: 1,
        startedAt: '2026-01-02T00:00:00.000Z',
      }),
    ]);

    const result = await testSchedulerStatusHandler({ includeDetails: true });

    expect(result.recentRuns).toEqual([
      {
        id: 'run-99',
        status: 'failed',
        duration: '250ms',
        passed: 2,
        failed: 1,
        startedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(schedulerMocks.getTestRuns).toHaveBeenCalledWith(5);
  });

  it('returns a safe error payload when run execution fails', async () => {
    schedulerMocks.runTests.mockRejectedValueOnce(new Error('boom'));

    const result = await testSchedulerRunHandler({});

    expect(result).toEqual({
      success: false,
      error: 'boom',
    });
    expect(schedulerMocks.logError).toHaveBeenCalledWith(
      'TestSchedulerTool',
      'Failed to trigger test run: boom',
    );
  });
});
