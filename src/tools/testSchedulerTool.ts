import { logInfo, logError } from '../utils/logger.js';
import { runTests, getSchedulerStatus } from '../server/schedulers/testRunner.js';
import { getTestStats, getTestRuns, type TestRun } from '../core/testResultsService.js';

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
}): Promise<{ success: boolean; runId?: string; status?: string; error?: string }> {
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

export async function testSchedulerStatusHandler(params: {
  includeDetails?: boolean;
}): Promise<{
  success: boolean;
  schedule?: string;
  enabled?: boolean;
  active?: boolean;
  stats?: any;
  recentRuns?: any[];
  error?: string;
}> {
  try {
    const scheduleStatus = getSchedulerStatus();
    const stats = await getTestStats();
    
    let response: any = {
      success: true,
      ...scheduleStatus,
      stats: {
        totalRuns: stats.totalRuns,
        passRate: (stats.passRate * 100).toFixed(2) + '%',
        averageDuration: Math.round(stats.averageDuration) + 'ms',
        lastRunStatus: stats.lastRunStatus,
        lastRunTime: stats.lastRunTime,
        sevenDayPassRate: (stats.sevenDayStats.passRate * 100).toFixed(2) + '%'
      }
    };

    if (params.includeDetails) {
      const recentRuns = getTestRuns(5);
      response.recentRuns = recentRuns.map((run: TestRun) => ({
        id: run.id,
        status: run.status,
        duration: run.duration + 'ms',
        passed: run.passed,
        failed: run.failed,
        startedAt: run.startedAt
      }));
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
