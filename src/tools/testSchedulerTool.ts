import { logInfo, logError } from '@packages/utils/logger.js';
import { runTests, getSchedulerStatus } from '../server/schedulers/testRunner.js';
import {
  getTestStats,
  getTestRuns,
  type TestRun,
  type TestStats
} from '../core/testResultsService.js';

type TestSchedulerRunResponse = {
  success: boolean;
  runId?: string;
  status?: TestRun['status'];
  error?: string;
};

type TestSchedulerRecentRun = Pick<TestRun, 'id' | 'status' | 'passed' | 'failed' | 'startedAt'> & {
  duration: string;
};

type TestSchedulerStatusStats = {
  totalRuns: number;
  passRate: string;
  averageDuration: string;
  lastRunStatus: TestStats['lastRunStatus'];
  lastRunTime: string;
  sevenDayPassRate: string;
  sevenDayStats: TestStats['sevenDayStats'];
};

type TestSchedulerStatusResponse = {
  success: boolean;
  schedule?: string;
  enabled?: boolean;
  active?: boolean;
  stats?: TestSchedulerStatusStats;
  recentRuns?: TestSchedulerRecentRun[];
  error?: string;
};

export const testSchedulerRunDefinition = {
  name: 'test-scheduler-run',
  description: 'Trigger a manual test run immediately',
  inputSchema: {
    type: 'object',
    properties: {
      triggerReason: {
        type: 'string',
        description: 'Optional reason for triggering the test (e.g., "Verify fix", "Pre-deployment")'
      }
    }
  }
};

export const testSchedulerStatusDefinition = {
  name: 'test-scheduler-status',
  description: 'Get the current test scheduler status and recent test statistics',
  inputSchema: {
    type: 'object',
    properties: {
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed test run history (default: false)'
      }
    }
  }
};

export async function testSchedulerRunHandler(params: {
  triggerReason?: string;
}): Promise<TestSchedulerRunResponse> {
  try {
    logInfo('TestSchedulerTool', `Triggering manual test run: ${params.triggerReason || 'Agent-initiated'}`);
    const result = await runTests('api');

    return {
      success: true,
      runId: result.id,
      status: result.status
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('TestSchedulerTool', `Failed to trigger test run: ${msg}`);
    return {
      success: false,
      error: msg
    };
  }
}

function formatPassRate(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatDuration(ms: number): string {
  return `${Math.round(ms)}ms`;
}

function buildStatsSummary(stats: TestStats): TestSchedulerStatusStats {
  return {
    totalRuns: stats.totalRuns,
    passRate: formatPassRate(stats.passRate),
    averageDuration: formatDuration(stats.averageDuration),
    lastRunStatus: stats.lastRunStatus,
    lastRunTime: stats.lastRunTime,
    sevenDayPassRate: formatPassRate(stats.sevenDayStats.passRate),
    sevenDayStats: stats.sevenDayStats
  };
}

function buildRecentRunSummary(run: TestRun): TestSchedulerRecentRun {
  return {
    id: run.id,
    status: run.status,
    duration: `${run.duration}ms`,
    passed: run.passed,
    failed: run.failed,
    startedAt: run.startedAt
  };
}

export async function testSchedulerStatusHandler(params: {
  includeDetails?: boolean;
}): Promise<TestSchedulerStatusResponse> {
  try {
    const scheduleStatus = getSchedulerStatus();
    const stats = await getTestStats();

    const response: TestSchedulerStatusResponse = {
      success: true,
      ...scheduleStatus,
      stats: buildStatsSummary(stats)
    };

    if (params.includeDetails) {
      response.recentRuns = getTestRuns(5).map(buildRecentRunSummary);
    }

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('TestSchedulerTool', `Failed to get scheduler status: ${msg}`);
    return {
      success: false,
      error: msg
    };
  }
}
