import { Router, Request, Response } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import { runTests, getSchedulerStatus } from '../schedulers/testRunner.js';
import {
  getTestRuns,
  getTestRunById,
  getTestStats,
  getTestRunsByDateRange
} from '../../core/testResultsService.js';
import cron from 'node-cron';

const router = Router();

/**
 * GET /api/tests/schedule
 * Get current test scheduler configuration
 */
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const status = getSchedulerStatus();
    return res.json({
      success: true,
      schedule: status.schedule,
      enabled: status.enabled,
      active: status.active
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to get schedule: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/tests/schedule
 * Update test scheduler configuration (cron expression)
 * Body: { schedule: "0 2 * * *", enabled: boolean }
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { schedule, enabled } = req.body;

    if (!schedule || typeof schedule !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid schedule parameter' });
    }

    // Validate cron expression

    if (!cron.validate(schedule)) {
      return res.status(400).json({ success: false, error: 'Invalid cron expression' });
    }

    // Update environment variables
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
      enabled: enabled ?? true
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to update schedule: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/tests/results
 * Get paginated list of test runs
 * Query: { limit: 20, offset: 0 }
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const runs = await getTestRuns(limit, offset);

    return res.json({
      success: true,
      data: runs,
      pagination: { limit, offset, total: runs.length }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to get test results: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/tests/results/:id
 * Get specific test run details
 */
router.get('/results/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
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
});

/**
 * POST /api/tests/run
 * Trigger a manual test run
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    logInfo('testScheduler', 'Manual test run triggered via API');
    const result = await runTests('api');

    return res.json({
      success: true,
      runId: result.id,
      status: result.status,
      message: 'Test run triggered successfully'
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
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = getTestStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to get test stats: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * GET /api/tests/results/range/:startDate/:endDate
 * Get test runs within a date range
 * Dates should be ISO format: YYYY-MM-DD or ISO 8601
 */
router.get('/results/range/:startDate/:endDate', async (req: Request, res: Response) => {
  try {
    const startDate = String(req.params.startDate);
    const endDate = String(req.params.endDate);
    const runs = getTestRunsByDateRange(startDate, endDate);

    return res.json({
      success: true,
      data: runs,
      dateRange: { startDate, endDate }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('testScheduler', `Failed to get test runs by date range: ${msg}`);
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
