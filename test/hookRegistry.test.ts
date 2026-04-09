import Database from 'better-sqlite3';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hookHarness = vi.hoisted(() => {
  return {
    db: null as unknown as Database,
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
  };
});

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => hookHarness.db,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: hookHarness.logInfo,
  logWarn: hookHarness.logWarn,
  logError: hookHarness.logError,
}));

import {
  clearHookAuditTrail,
  clearHookDlq,
  clearHooks,
  disableHook,
  enableHook,
  fireHook,
  getHookCircuitSnapshot,
  getHookDlqEntries,
  getHookExecutions,
  getHookRegistrySnapshot,
  getHookSummary,
  isHookEnabled,
  registerHook,
} from '../src/core/hookRegistry.js';

hookHarness.db = new Database(':memory:');

describe('Hook registry engine', () => {
  beforeEach(() => {
    clearHooks();
    clearHookAuditTrail();
    clearHookDlq();
    vi.clearAllMocks();
  });

  afterAll(() => {
    hookHarness.db.close();
  });

  it('registerHook stores catalogued snapshot data', () => {
    registerHook('test.registry.event', vi.fn(), {
      priority: 7,
      timeoutMs: 2500,
      retryOnFail: true,
      category: 'business',
      description: 'Test hook',
      handlerName: 'test-handler',
    });

    const snapshot = getHookRegistrySnapshot().find((entry) => entry.event === 'test.registry.event');
    expect(snapshot).toBeDefined();
    expect(snapshot?.enabled).toBe(true);
    expect(snapshot?.priority).toBe(7);
    expect(snapshot?.retryOnFail).toBe(true);
    expect(snapshot?.category).toBe('business');
    expect(snapshot?.handlers[0]?.handlerName).toBe('test-handler');
  });

  it('fireHook records successful execution', async () => {
    const handler = vi.fn(async () => undefined);
    registerHook('test.fire.success', handler, { category: 'business' });

    const summary = await fireHook('test.fire.success', { ok: true }, { source: 'test' });

    expect(summary.status).toBe('fired');
    expect(summary.firedCount).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);

    const executions = getHookExecutions(10, { event: 'test.fire.success' });
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe('fired');
  });

  it('fireHook sends unrecoverable failures to DLQ', async () => {
    registerHook('test.fire.fail', () => {
      throw new Error('boom');
    }, {
      category: 'business',
      retryOnFail: false,
    });

    const summary = await fireHook('test.fire.fail', { ok: false }, { source: 'test' });

    expect(summary.status).toBe('failed');
    expect(summary.deadLetterCount).toBe(1);
    expect(getHookDlqEntries(10)).toHaveLength(1);
    expect(getHookCircuitSnapshot('test.fire.fail')[0]?.failures).toBe(1);
  });

  it('fireHook retries once when configured and recovers', async () => {
    let attempts = 0;
    registerHook('test.fire.retry', () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('temporary');
      }
    }, {
      category: 'business',
      retryOnFail: true,
    });

    const summary = await fireHook('test.fire.retry', { ok: true }, { source: 'test' });

    expect(summary.status).toBe('fired');
    expect(summary.retriedCount).toBe(1);
    expect(attempts).toBe(2);
    expect(getHookDlqEntries(10)).toHaveLength(0);

    const executions = getHookExecutions(10, { event: 'test.fire.retry' });
    expect(executions.map((entry) => entry.status)).toContain('failed');
    expect(executions.map((entry) => entry.status)).toContain('fired');
  });

  it('disableHook blocks events until re-enabled', async () => {
    const handler = vi.fn(async () => undefined);
    registerHook('test.fire.blocked', handler, { category: 'business' });

    disableHook('test.fire.blocked');
    expect(isHookEnabled('test.fire.blocked')).toBe(false);

    const blocked = await fireHook('test.fire.blocked', { ok: true }, { source: 'test' });
    expect(blocked.status).toBe('blocked');
    expect(handler).not.toHaveBeenCalled();

    enableHook('test.fire.blocked');
    expect(isHookEnabled('test.fire.blocked')).toBe(true);

    const fired = await fireHook('test.fire.blocked', { ok: true }, { source: 'test' });
    expect(fired.status).toBe('fired');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('getHookSummary reflects registry and audit counters', async () => {
    registerHook('test.summary', async () => undefined, { category: 'business' });
    await fireHook('test.summary', {}, { source: 'test' });

    const summary = getHookSummary(24);
    expect(summary.registrySize).toBeGreaterThan(0);
    expect(summary.registeredHandlers).toBeGreaterThan(0);
    expect(summary.audit.total).toBeGreaterThan(0);
    expect(summary.circuitOpenCount).toBeGreaterThanOrEqual(0);
  });
});
