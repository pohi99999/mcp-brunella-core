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

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: () => hookRouteHarness.db,
}));

vi.mock('@packages/utils/logger.js', () => ({
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
} from '@packages/core-logic/hookRegistry.js';
import { createHookRoutes } from '@apps/mcp-core/server/routes/hooks.js';

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

  it('returns side-effect-free hook readiness', async () => {
    registerHook('route.ready.event', async () => undefined, { category: 'business' });

    const response = await request(createApp()).get('/api/v1/hooks/readiness?hours=999');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.readiness.status).toBe('ready');
    expect(response.body.readiness.summary.windowHours).toBe(168);
    expect(response.body.readiness.registry.enabledHandlers).toBe(1);
    expect(response.body.readiness.blockers).toEqual([]);
  });

  it('fires a hook through the API', async () => {
    const handler = vi.fn(async () => undefined);
    registerHook('route.fire.event', handler, { category: 'business' });

    const response = await request(createApp())
      .post('/api/v1/hooks/fire')
      .send({
        event: ' route.fire.event ',
        payload: { ok: true },
        source: ' route-test ',
        force: ' yes ',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary.status).toBe('fired');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('normalizes execution filters and clamps list limits', async () => {
    registerHook('route.execution.event', async () => undefined, { category: 'business' });
    await fireHook('route.execution.event', { ok: true }, { source: 'test' });

    const response = await request(createApp())
      .get('/api/v1/hooks/executions?limit=999&event=%20route.execution.event%20&status=%20fired%20');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.executions.length).toBeGreaterThanOrEqual(1);
    expect(response.body.executions[0]).toEqual(expect.objectContaining({
      event: 'route.execution.event',
      status: 'fired',
    }));
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
      .post(`/api/v1/hooks/dlq/%20${dlqId}%20/retry`);

    expect(replay.status).toBe(200);
    expect(replay.body.success).toBe(true);
    expect(replay.body.summary.status).toBe('fired');
    expect(successHandler).toHaveBeenCalledTimes(1);
    expect(retryHandler).toHaveBeenCalledTimes(2);
  });
});
