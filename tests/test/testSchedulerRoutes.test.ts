import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import testSchedulerRouter from '@apps/mcp-core/server/routes/testScheduler.js';

const schedulerMocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  runTests: vi.fn(),
  getSchedulerStatus: vi.fn(),
  getTestRuns: vi.fn(),
  getTestRunById: vi.fn(),
  getTestStats: vi.fn(),
  getTestRunsByDateRange: vi.fn(),
  validateCron: vi.fn(),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: schedulerMocks.logInfo,
  logError: schedulerMocks.logError,
}));

vi.mock('@apps/mcp-core/server/schedulers/testRunner.js', () => ({
  runTests: schedulerMocks.runTests,
  getSchedulerStatus: schedulerMocks.getSchedulerStatus,
}));

vi.mock('@packages/core-logic/testResultsService.js', () => ({
  getTestRuns: schedulerMocks.getTestRuns,
  getTestRunById: schedulerMocks.getTestRunById,
  getTestStats: schedulerMocks.getTestStats,
  getTestRunsByDateRange: schedulerMocks.getTestRunsByDateRange,
}));

vi.mock('node-cron', () => ({
  default: {
    validate: schedulerMocks.validateCron,
  },
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/tests', testSchedulerRouter);
  return app;
}

function createTestRun(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TEST_SCHEDULE;
  delete process.env.TEST_SCHEDULER_ENABLED;
});

afterEach(() => {
  delete process.env.TEST_SCHEDULE;
  delete process.env.TEST_SCHEDULER_ENABLED;
});

describe('testScheduler routes', () => {
  it('returns the current schedule status', async () => {
    schedulerMocks.getSchedulerStatus.mockReturnValue({
      schedule: '0 2 * * *',
      enabled: true,
      active: false,
    });

    const response = await request(createApp()).get('/api/v1/tests/schedule');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      schedule: '0 2 * * *',
      enabled: true,
      active: false,
    });
  });

  it('rejects missing or invalid schedule values', async () => {
    const missingResponse = await request(createApp())
      .post('/api/v1/tests/schedule')
      .send({ enabled: true });

    expect(missingResponse.status).toBe(400);
    expect(missingResponse.body.error).toBe('Missing or invalid schedule parameter');

    schedulerMocks.validateCron.mockReturnValue(false);
    const invalidResponse = await request(createApp())
      .post('/api/v1/tests/schedule')
      .send({ schedule: 'not-a-cron', enabled: true });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toBe('Invalid cron expression');
  });

  it('updates schedule state and preserves the enabled flag', async () => {
    schedulerMocks.validateCron.mockReturnValue(true);

    const response = await request(createApp())
      .post('/api/v1/tests/schedule')
      .send({ schedule: ' 0 3 * * * ', enabled: ' false ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Schedule updated (requires server restart to take effect)',
      schedule: '0 3 * * *',
      enabled: false,
    });
    expect(process.env.TEST_SCHEDULE).toBe('0 3 * * *');
    expect(process.env.TEST_SCHEDULER_ENABLED).toBe('false');
  });

  it('normalizes results query parameters before fetching runs', async () => {
    schedulerMocks.getTestRuns.mockResolvedValue([createTestRun({ id: 'run-7' })]);

    const response = await request(createApp()).get('/api/v1/tests/results?limit=0&offset=-5');

    expect(response.status).toBe(200);
    expect(schedulerMocks.getTestRuns).toHaveBeenCalledWith(1, 0);
    expect(response.body).toEqual({
      success: true,
      data: [expect.objectContaining({ id: 'run-7' })],
      runs: [expect.objectContaining({ id: 'run-7' })],
      pagination: { limit: 1, offset: 0, total: 1 },
    });
  });

  it('returns 404 when a test run is missing', async () => {
    schedulerMocks.getTestRunById.mockReturnValue(null);

    const response = await request(createApp()).get('/api/v1/tests/results/%20missing-id%20');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: 'Test run not found',
    });
  });

  it('returns stats with legacy compatibility fields', async () => {
    schedulerMocks.getTestStats.mockReturnValue({
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
    });

    const response = await request(createApp()).get('/api/v1/tests/stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
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
      },
      totalRuns: 8,
      passRate: '88%',
      averageDuration: '124ms',
      lastRunStatus: 'passed',
      lastRunTime: '2026-01-01T00:00:01.000Z',
      sevenDayPassRate: '67%',
      sevenDayStats: {
        passRate: 0.6666,
        passCount: 4,
        failCount: 2,
      },
    });
  });

  it('returns date-range runs using the provided params', async () => {
    schedulerMocks.getTestRunsByDateRange.mockReturnValue([createTestRun({ id: 'run-range-1' })]);

    const response = await request(createApp()).get('/api/v1/tests/results/range/%202026-01-01%20/%202026-01-31%20');

    expect(response.status).toBe(200);
    expect(schedulerMocks.getTestRunsByDateRange).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
    expect(response.body).toEqual({
      success: true,
      data: [expect.objectContaining({ id: 'run-range-1' })],
      dateRange: {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
    });
  });

  it('triggers a manual test run through the scheduler', async () => {
    schedulerMocks.runTests.mockResolvedValue(createTestRun({ id: 'run-99', status: 'running' }));

    const response = await request(createApp()).post('/api/v1/tests/run');

    expect(response.status).toBe(200);
    expect(schedulerMocks.runTests).toHaveBeenCalledWith('api');
    expect(response.body).toEqual({
      success: true,
      runId: 'run-99',
      status: 'running',
      message: 'Test run triggered successfully',
    });
  });
});
