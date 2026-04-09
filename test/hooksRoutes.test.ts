import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hookRouteHarness = vi.hoisted(() => {
  return {
    db: null as unknown as Database,
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
  };
});

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => hookRouteHarness.db,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: hookRouteHarness.logInfo,
  logWarn: hookRouteHarness.logWarn,
  logError: hookRouteHarness.logError,
}));

import {
  clearHookAuditTrail,
  clearHookDlq,
  clearHooks,
  fireHook,
  registerHook,
} from '../src/core/hookRegistry.js';
import { createHookRoutes } from '../src/server/routes/hooks.js';

hookRouteHarness.db = new Database(':memory:');

describe('Hook routes', () => {
  beforeEach(() => {
    clearHooks();
    clearHookAuditTrail();
    clearHookDlq();
    vi.clearAllMocks();
  });

  afterAll(() => {
    hookRouteHarness.db.close();
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/hooks', createHookRoutes());
    return app;
  }

  it('returns a hook summary snapshot', async () => {
    registerHook('route.summary.event', async () => undefined, { category: 'business' });
    await fireHook('route.summary.event', { ping: true }, { source: 'test' });

    const response = await request(createApp()).get('/api/v1/hooks/summary?hours=12');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.snapshot.summary.windowHours).toBe(12);
    expect(response.body.snapshot.summary.audit.total).toBeGreaterThan(0);
    expect(response.body.snapshot.registry).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'route.summary.event' }),
    ]));
  });

  it('fires a hook through the API', async () => {
    const handler = vi.fn(async () => undefined);
    registerHook('route.fire.event', handler, { category: 'business' });

    const response = await request(createApp())
      .post('/api/v1/hooks/fire')
      .send({
        event: 'route.fire.event',
        payload: { ok: true },
        source: 'route-test',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary.status).toBe('fired');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('replays only the failed handler through the API', async () => {
    const successHandler = vi.fn(async () => undefined);
    let shouldFail = true;
    const retryHandler = vi.fn(() => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('temporary');
      }
    });

    registerHook('route.dlq.event', successHandler, {
      category: 'business',
      retryOnFail: false,
      handlerName: 'success-handler',
    });

    registerHook('route.dlq.event', retryHandler, {
      category: 'business',
      retryOnFail: false,
      handlerName: 'retry-handler',
    });

    const app = createApp();
    const first = await request(app)
      .post('/api/v1/hooks/fire')
      .send({
        event: 'route.dlq.event',
        payload: { retry: true },
      });

    expect(first.body.summary.status).toBe('partial');
    expect(first.body.summary.deadLetterCount).toBe(1);

    const dlq = await request(app).get('/api/v1/hooks/dlq');
    const dlqId = dlq.body.dlq[0]?.id as number | undefined;
    expect(dlqId).toBeDefined();

    const replay = await request(app)
      .post(`/api/v1/hooks/dlq/${dlqId}/retry`);

    expect(replay.status).toBe(200);
    expect(replay.body.success).toBe(true);
    expect(replay.body.summary.status).toBe('fired');
    expect(successHandler).toHaveBeenCalledTimes(1);
    expect(retryHandler).toHaveBeenCalledTimes(2);
  });
});
