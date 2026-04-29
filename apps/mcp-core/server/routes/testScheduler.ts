import { Router, type Request, type Response } from 'express';
import cron from 'node-cron';
import { logInfo, logError } from '@packages/utils/logger.js';
import { runTests, getSchedulerStatus } from '../schedulers/testRunner.js';
import {
  getTestRuns,
  getTestRunById,
  getTestStats,
  getTestRunsByDateRange,
  type TestRun,
  type TestStats,
} from '@packages/core-logic/testResultsService.js';

const router = Router();

type EmptyParams = Record<string, string>;

type ScheduleUpdateBody = {
  schedule?: unknown;
  enabled?: unknown;
};

type ResultsQuery = {
  limit?: unknown;
  offset?: unknown;
};

type TestRunParams = {
  id: string;
};

type DateRangeParams = {
  startDate: string;
  endDate: string;
};

type ErrorResponse = {
  success: false;
  error: string;
};

type ScheduleStatusResponse = {
  success: true;
  schedule: string;
  enabled: boolean;
  active: boolean;
};

type ScheduleUpdateResponse = {
  success: true;
  message: string;
  schedule: string;
  enabled: boolean;
};

type TestResultsListResponse = {
  success: true;
  data: TestRun[];
  runs: TestRun[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type TestRunResponse = {
  success: true;
  data: TestRun;
};

type TestStatsResponse = {
  success: true;
  data: TestStats;
  totalRuns: number;
  passRate: string;
  averageDuration: string;
  lastRunStatus: TestStats['lastRunStatus'];
  lastRunTime: string;
  sevenDayPassRate: string;
  sevenDayStats: TestStats['sevenDayStats'];
};

type DateRangeResponse = {
  success: true;
  data: TestRun[];
  dateRange: DateRangeParams;
};

function formatPassRate(ratio: number): string {
  return `${Math.round((ratio || 0) * 100)}%`;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readQueryInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed || fallback;
}

/**
 * GET /api/tests/schedule
 * Get current test scheduler configuration
 */
router.get(
  '/schedule',
  async (_req: Request<EmptyParams>, res: Response<ScheduleStatusResponse | ErrorResponse>) => {
    try {
      const status = getSchedulerStatus();
      return res.json({
        success: true,
        schedule: status.schedule,
        enabled: status.enabled,
        active: status.active,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to get schedule: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

/**
 * POST /api/tests/schedule
 * Update test scheduler configuration (cron expression)
 * Body: { schedule: "0 2 * * *", enabled: boolean }
 */
router.post(
  '/schedule',
  async (
    req: Request<EmptyParams, ScheduleUpdateResponse | ErrorResponse, ScheduleUpdateBody>,
    res: Response<ScheduleUpdateResponse | ErrorResponse>,
  ) => {
    try {
      const schedule = readString(req.body.schedule);
      const enabled = readBoolean(req.body.enabled);

      if (!schedule) {
        return res.status(400).json({ success: false, error: 'Missing or invalid schedule parameter' });
      }

      if (!cron.validate(schedule)) {
        return res.status(400).json({ success: false, error: 'Invalid cron expression' });
      }

      process.env.TEST_SCHEDULE = schedule;
      if (typeof enabled === 'boolean') {
        process.env.TEST_SCHEDULER_ENABLED = enabled ? 'true' : 'false';
      }

      // Note: Requires scheduler restart to take effect
      logInfo('testScheduler', `Schedule updated to: ${schedule}, enabled: ${enabled ?? true}`);

      return res.json({
        success: true,
        message: 'Schedule updated (requires server restart to take effect)',
        schedule,
        enabled: enabled ?? true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to update schedule: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

/**
 * GET /api/tests/results
 * Get paginated list of test runs
 * Query: { limit: 20, offset: 0 }
 */
router.get(
  '/results',
  async (
    req: Request<EmptyParams, TestResultsListResponse | ErrorResponse, never, ResultsQuery>,
    res: Response<TestResultsListResponse | ErrorResponse>,
  ) => {
    try {
      const limit = Math.min(readQueryInteger(req.query.limit, 20), 100);
      const offset = readQueryInteger(req.query.offset, 0);
      const runs = await getTestRuns(limit, offset);

      return res.json({
        success: true,
        data: runs,
        runs,
        pagination: { limit, offset, total: runs.length },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to get test results: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

/**
 * GET /api/tests/results/:id
 * Get specific test run details
 */
router.get(
  '/results/:id',
  async (
    req: Request<TestRunParams, TestRunResponse | ErrorResponse>,
    res: Response<TestRunResponse | ErrorResponse>,
  ) => {
    try {
      const id = req.params.id;
      const run = getTestRunById(id);

      if (!run) {
        return res.status(404).json({ success: false, error: 'Test run not found' });
      }

      return res.json({ success: true, data: run });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to get test run ${req.params.id}: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

/**
 * POST /api/tests/run
 * Trigger a manual test run
 */
router.post('/run', async (_req: Request<EmptyParams>, res: Response<{ success: true; runId: string; status: TestRun['status']; message: string } | ErrorResponse>) => {
  try {
    logInfo('testScheduler', 'Manual test run triggered via API');
    const result = await runTests('api');

    return res.json({
      success: true,
      runId: result.id,
      status: result.status,
      message: 'Test run triggered successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to trigger manual test run: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/tests/stats
 * Get test statistics and summary
 */
router.get(
  '/stats',
  async (_req: Request<EmptyParams>, res: Response<TestStatsResponse | ErrorResponse>) => {
    try {
      const stats = getTestStats();

      const compatPayload = {
        totalRuns: stats.totalRuns,
        passRate: formatPassRate(stats.passRate),
        averageDuration: formatDuration(stats.averageDuration),
        lastRunStatus: stats.lastRunStatus,
        lastRunTime: stats.lastRunTime,
        sevenDayPassRate: formatPassRate(stats.sevenDayStats.passRate),
        sevenDayStats: stats.sevenDayStats,
      } satisfies Omit<TestStatsResponse, 'success' | 'data'>;

      return res.json({
        success: true,
        data: stats,
        ...compatPayload,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to get test stats: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

/**
 * GET /api/tests/results/range/:startDate/:endDate
 * Get test runs within a date range
 * Dates should be ISO format: YYYY-MM-DD or ISO 8601
 */
router.get(
  '/results/range/:startDate/:endDate',
  async (
    req: Request<DateRangeParams, DateRangeResponse | ErrorResponse>,
    res: Response<DateRangeResponse | ErrorResponse>,
  ) => {
    try {
      const startDate = req.params.startDate;
      const endDate = req.params.endDate;
      const runs = getTestRunsByDateRange(startDate, endDate);

      return res.json({
        success: true,
        data: runs,
        dateRange: { startDate, endDate },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('testScheduler', `Failed to get test runs by date range: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  },
);

export default router;
