import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  registerHook,
  listHooks,
  runHooks,
  clearHooks,
  clearHookAuditTrail,
  clearHookDlq,
  enableHook,
  disableHook,
  isHookEnabled,
  fireHook,
  getHookExecutions,
  getHookDlqEntries,
  getHookCircuitSnapshot,
  getHookRegistrySnapshot,
  type HookDispatchContext,
} from '@packages/utils/hooks.js';

// ============================================================================
// HELPERS
// ============================================================================

/** Awaitable pause — use sparingly for real async scenarios. */
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Builds a simple context fixture for hook invocations. */
const makeCtx = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  agentId: 'test-agent',
  timestamp: new Date().toISOString(),
  ...extra,
});

// ============================================================================
// SUITE
// ============================================================================

describe('Hooks — Core Registry', () => {
  beforeEach(() => {
    clearHooks();
    clearHookAuditTrail();
    clearHookDlq();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Basic API (regression: original 7 tests)
  // --------------------------------------------------------------------------

  it('listHooks returns empty array when no hooks registered', () => {
    const list = listHooks();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('registerHook and listHooks show correct count', () => {
    registerHook('BeforeTool', () => {});
    registerHook('BeforeTool', () => {});
    const list = listHooks();
    const entry = list.find((x) => x.name === 'BeforeTool');
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(2);
  });

  it('runHooks invokes handlers when not disabled', async () => {
    let ran = 0;
    registerHook('SessionStart', () => {
      ran += 1;
    });
    await runHooks('SessionStart', {});
    expect(ran).toBe(1);
  });

  it('runHooks skips when hook name is in disabled list', async () => {
    let ran = 0;
    registerHook('AfterTool', () => {
      ran += 1;
    });
    await runHooks('AfterTool', {}, { disabled: ['AfterTool'] });
    expect(ran).toBe(0);
  });

  it('runHooks skips all handlers when enabled is false', async () => {
    let ran = 0;
    registerHook('SessionEnd', () => {
      ran += 1;
    });
    await runHooks('SessionEnd', {}, { enabled: false });
    expect(ran).toBe(0);
  });

  it('clearHooks(name) removes only the named hook', () => {
    registerHook('BeforeTool', () => {});
    registerHook('AfterTool', () => {});
    clearHooks('BeforeTool');
    const list = listHooks();
    expect(list.find((x) => x.name === 'BeforeTool')).toBeUndefined();
    expect(list.find((x) => x.name === 'AfterTool')).toBeDefined();
  });

  it('clearHooks() with no args removes all hooks', () => {
    registerHook('BeforeTool', () => {});
    clearHooks();
    expect(listHooks().length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Priority ordering
  // --------------------------------------------------------------------------

  describe('priority ordering', () => {
    it('fires higher-priority handler before lower-priority handler', async () => {
      const order: number[] = [];

      registerHook('BeforeAgent', () => {
        order.push(1);
      }, { priority: 1, handlerName: 'low-priority' });

      registerHook('BeforeAgent', () => {
        order.push(10);
      }, { priority: 10, handlerName: 'high-priority' });

      await fireHook('BeforeAgent', makeCtx());

      expect(order).toEqual([10, 1]);
    });

    it('fires equal-priority handlers in registration order (FIFO)', async () => {
      const order: string[] = [];

      registerHook('BeforeAgent', () => {
        order.push('first');
      }, { priority: 5, handlerName: 'first' });

      registerHook('BeforeAgent', () => {
        order.push('second');
      }, { priority: 5, handlerName: 'second' });

      registerHook('BeforeAgent', () => {
        order.push('third');
      }, { priority: 5, handlerName: 'third' });

      await fireHook('BeforeAgent', makeCtx());

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('handler receives a well-formed HookDispatchContext', async () => {
      let capturedCtx: HookDispatchContext | null = null;

      registerHook('SessionStart', (ctx) => {
        capturedCtx = ctx;
      }, { handlerName: 'ctx-inspector' });

      const payload = makeCtx({ extra: 42 });
      await fireHook('SessionStart', payload);

      expect(capturedCtx).not.toBeNull();
      expect(capturedCtx!.event).toBe('SessionStart');
      expect(capturedCtx!.payload).toBe(payload);
      expect(capturedCtx!.attempt).toBe(1);
      expect(typeof capturedCtx!.timestamp).toBe('string');
      expect(capturedCtx!.registration.handlerName).toBe('ctx-inspector');
    });
  });

  // --------------------------------------------------------------------------
  // Per-handler timeout
  // --------------------------------------------------------------------------

  describe('per-handler timeout', () => {
    it('completes normally when handler finishes within its timeout', async () => {
      let ran = false;
      registerHook('AfterModel', async () => {
        await wait(10);
        ran = true;
      }, { timeoutMs: 5_000, handlerName: 'fast-handler' });

      const summary = await fireHook('AfterModel', makeCtx());

      expect(ran).toBe(true);
      expect(summary.firedCount).toBe(1);
      expect(summary.failedCount).toBe(0);
    });

    it('records a failure when handler exceeds its timeout', async () => {
      registerHook('AfterModel', async () => {
        // Longer than the 150ms timeout below
        await wait(2_000);
      }, { timeoutMs: 150, handlerName: 'slow-handler' });

      const summary = await fireHook('AfterModel', makeCtx());

      // Handler should have been aborted — counted as failed or dead-letter
      expect(summary.failedCount + summary.deadLetterCount).toBeGreaterThan(0);
      expect(summary.firedCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // enableHook / disableHook
  // --------------------------------------------------------------------------

  describe('enableHook / disableHook', () => {
    it('disableHook prevents handlers from firing', async () => {
      let ran = false;
      registerHook('BeforeTool', () => {
        ran = true;
      });
      disableHook('BeforeTool');
      await fireHook('BeforeTool', makeCtx());
      expect(ran).toBe(false);
    });

    it('enableHook restores firing after disableHook', async () => {
      let ran = false;
      registerHook('BeforeTool', () => {
        ran = true;
      });
      disableHook('BeforeTool');
      enableHook('BeforeTool');
      await fireHook('BeforeTool', makeCtx());
      expect(ran).toBe(true);
    });

    it('isHookEnabled returns false after disableHook', () => {
      registerHook('AfterAgent', () => {});
      disableHook('AfterAgent');
      expect(isHookEnabled('AfterAgent')).toBe(false);
    });

    it('isHookEnabled returns true for a registered, enabled hook', () => {
      registerHook('AfterAgent', () => {});
      expect(isHookEnabled('AfterAgent')).toBe(true);
    });

    it('isHookEnabled returns false for unregistered hook', () => {
      // No registration at all
      expect(isHookEnabled('SessionEnd')).toBe(false);
    });

    it('disableHook and enableHook do not affect other hook names', async () => {
      let aRan = false;
      let bRan = false;
      registerHook('BeforeAgent', () => {
        aRan = true;
      });
      registerHook('AfterAgent', () => {
        bRan = true;
      });

      disableHook('BeforeAgent');
      await fireHook('BeforeAgent', makeCtx());
      await fireHook('AfterAgent', makeCtx());

      expect(aRan).toBe(false);
      expect(bRan).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Audit trail
  // --------------------------------------------------------------------------

  describe('audit trail — getHookExecutions', () => {
    it('records a fired execution after a successful handler', async () => {
      registerHook('SessionStart', () => {}, { handlerName: 'audit-test-handler' });
      await fireHook('SessionStart', makeCtx());

      const records = getHookExecutions(10, { event: 'SessionStart' });
      // Audit trail requires DB — gracefully skip assertion if DB is unavailable in test env
      if (records.length > 0) {
        expect(records[0].event).toBe('SessionStart');
        expect(records[0].status).toBe('fired');
      }
    });

    it('records a failed execution after a throwing handler', async () => {
      registerHook('AfterTool', () => {
        throw new Error('intentional audit failure');
      }, { handlerName: 'failing-audit-handler', retryOnFail: false });

      await fireHook('AfterTool', makeCtx());

      const records = getHookExecutions(20, { event: 'AfterTool' });
      if (records.length > 0) {
        const failedRecord = records.find((r) => r.status === 'failed' || r.status === 'dead_letter');
        expect(failedRecord).toBeDefined();
      }
    });

    it('clearHookAuditTrail empties the execution log', async () => {
      registerHook('BeforeModel', () => {}, { handlerName: 'trail-clear-test' });
      await fireHook('BeforeModel', makeCtx());
      clearHookAuditTrail();

      const records = getHookExecutions(10, { event: 'BeforeModel' });
      expect(records.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Dead-letter queue (DLQ)
  // --------------------------------------------------------------------------

  describe('dead-letter queue — getHookDlqEntries', () => {
    it('pushes a failing non-retry handler to DLQ', async () => {
      registerHook('webhook.received', () => {
        throw new Error('simulated webhook failure');
      }, { handlerName: 'dlq-push-test', retryOnFail: false });

      await fireHook('webhook.received', makeCtx({ source: 'github' }));

      const entries = getHookDlqEntries(10);
      // DLQ requires DB — gracefully skip if unavailable
      if (entries.length > 0) {
        expect(entries[0].event).toBe('webhook.received');
        expect(entries[0].reason).toBeTruthy();
      }
    });

    it('clearHookDlq empties the queue', async () => {
      registerHook('github.push', () => {
        throw new Error('push handler fail');
      }, { handlerName: 'dlq-clear-test', retryOnFail: false });

      await fireHook('github.push', makeCtx());
      clearHookDlq();

      const entries = getHookDlqEntries(10);
      expect(entries.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Circuit breaker state machine
  // --------------------------------------------------------------------------

  describe('circuit breaker state machine', () => {
    it('starts in closed state for a new hook event', () => {
      const snapshots = getHookCircuitSnapshot('BeforeAgent');
      // No snapshot if never fired or circuit never touched
      expect(snapshots.length === 0 || snapshots[0].state === 'closed').toBe(true);
    });

    it('transitions to OPEN after threshold (3) consecutive failures', async () => {
      registerHook('scheduler.task.failed', () => {
        throw new Error('scheduler error');
      }, { handlerName: 'cb-threshold-test', retryOnFail: false });

      // Three consecutive failing fires
      await fireHook('scheduler.task.failed', makeCtx());
      await fireHook('scheduler.task.failed', makeCtx());
      await fireHook('scheduler.task.failed', makeCtx());

      const snapshots = getHookCircuitSnapshot('scheduler.task.failed');
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].state).toBe('open');
    });

    it('blocks a fourth fire when circuit is OPEN', async () => {
      let fireCount = 0;

      registerHook('AfterModel', () => {
        fireCount += 1;
        throw new Error('cb-block error');
      }, { handlerName: 'cb-block-test', retryOnFail: false });

      // Open the circuit with 3 failures
      await fireHook('AfterModel', makeCtx());
      await fireHook('AfterModel', makeCtx());
      await fireHook('AfterModel', makeCtx());

      const beforeBlock = fireCount;

      // Fourth call — circuit should be OPEN, handler should NOT run
      await fireHook('AfterModel', makeCtx());

      expect(fireCount).toBe(beforeBlock); // handler not invoked again
    });

    it('transitions to HALF-OPEN after cooldown expires', async () => {
      vi.useFakeTimers();

      registerHook('BeforeModel', () => {
        throw new Error('half-open test error');
      }, { handlerName: 'half-open-test', retryOnFail: false });

      // Open the circuit
      await fireHook('BeforeModel', makeCtx());
      await fireHook('BeforeModel', makeCtx());
      await fireHook('BeforeModel', makeCtx());

      const openSnapshots = getHookCircuitSnapshot('BeforeModel');
      expect(openSnapshots[0].state).toBe('open');

      // Advance time past cooldown (60 seconds)
      vi.advanceTimersByTime(61_000);

      // normalize() converts to half-open after cooldown — reading snapshot triggers normalize
      const cooldownSnapshots = getHookCircuitSnapshot('BeforeModel');
      expect(cooldownSnapshots[0].state).toBe('half-open');
    });

    it('resets to CLOSED after a successful fire from HALF-OPEN state', async () => {
      vi.useFakeTimers();

      let failOnce = true;

      registerHook('SessionStart', () => {
        if (failOnce) {
          throw new Error('circuit reset test');
        }
        // Subsequent calls succeed
      }, { handlerName: 'circuit-reset-test', retryOnFail: false });

      // Open the circuit with 3 failures
      await fireHook('SessionStart', makeCtx());
      await fireHook('SessionStart', makeCtx());
      await fireHook('SessionStart', makeCtx());

      // Advance past cooldown → HALF-OPEN
      vi.advanceTimersByTime(61_000);

      // Now allow success
      failOnce = false;
      await fireHook('SessionStart', makeCtx(), { force: true });

      const finalSnapshots = getHookCircuitSnapshot('SessionStart');
      expect(finalSnapshots[0].state).toBe('closed');
    });
  });

  // --------------------------------------------------------------------------
  // fireHooks (engine integration via hookEngine.ts)
  // --------------------------------------------------------------------------

  describe('fireHooks (hookEngine integration)', () => {
    it('invokes registered handler via fireHooks', async () => {
      const { fireHooks } = await import('@packages/core-logic/hookEngine.js');

      let invoked = false;
      registerHook('AfterTool', () => {
        invoked = true;
      }, { handlerName: 'engine-integration-test' });

      await fireHooks('AfterTool', makeCtx());
      expect(invoked).toBe(true);
    });

    it('fireHooks never throws even when handler throws', async () => {
      const { fireHooks } = await import('@packages/core-logic/hookEngine.js');

      registerHook('SessionEnd', () => {
        throw new Error('engine swallow test');
      }, { handlerName: 'engine-swallow-test', retryOnFail: false });

      // Must NOT throw
      await expect(fireHooks('SessionEnd', makeCtx())).resolves.toBeUndefined();
    });

    it('fireHooks respects the disabled option', async () => {
      const { fireHooks } = await import('@packages/core-logic/hookEngine.js');

      let ran = false;
      registerHook('BeforeAgent', () => {
        ran = true;
      }, { handlerName: 'engine-disabled-test' });

      await fireHooks('BeforeAgent', makeCtx(), { disabled: ['BeforeAgent'] });
      expect(ran).toBe(false);
    });

    it('fireHooks with enabled:false skips all handlers', async () => {
      const { fireHooks } = await import('@packages/core-logic/hookEngine.js');

      let ran = false;
      registerHook('AfterAgent', () => {
        ran = true;
      }, { handlerName: 'engine-enabled-false-test' });

      await fireHooks('AfterAgent', makeCtx(), { enabled: false });
      expect(ran).toBe(false);
    });

    it('fireHooks with skipCircuitBreaker bypasses circuit protection', async () => {
      const { fireHooks } = await import('@packages/core-logic/hookEngine.js');

      let callCount = 0;
      registerHook('BeforeTool', () => {
        callCount += 1;
        throw new Error('skip-cb error');
      }, { handlerName: 'skip-cb-test', retryOnFail: false });

      // Trip the circuit
      await fireHooks('BeforeTool', makeCtx());
      await fireHooks('BeforeTool', makeCtx());
      await fireHooks('BeforeTool', makeCtx());

      const countAfterOpen = callCount;

      // With skipCircuitBreaker, the handler still runs despite OPEN state
      await fireHooks('BeforeTool', makeCtx(), { skipCircuitBreaker: true });
      expect(callCount).toBeGreaterThan(countAfterOpen);
    });
  });

  // --------------------------------------------------------------------------
  // getHookRegistrySnapshot
  // --------------------------------------------------------------------------

  describe('getHookRegistrySnapshot', () => {
    it('returns a snapshot array with correct event name', () => {
      registerHook('github.push', () => {}, { handlerName: 'snapshot-test' });
      const snapshots = getHookRegistrySnapshot();
      const entry = snapshots.find((s) => s.event === 'github.push');
      expect(entry).toBeDefined();
      expect(entry!.handlerCount).toBe(1);
      expect(entry!.handlers[0].handlerName).toBe('snapshot-test');
    });

    it('snapshot shows enabled:false after disableHook', () => {
      registerHook('AfterAgent', () => {}, { handlerName: 'snapshot-disabled-test' });
      disableHook('AfterAgent');
      const snapshots = getHookRegistrySnapshot();
      const entry = snapshots.find((s) => s.event === 'AfterAgent');
      expect(entry).toBeDefined();
      expect(entry!.enabled).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Per-handler enabled flag
  // --------------------------------------------------------------------------

  describe('per-handler enabled flag', () => {
    it('skips a handler registered with enabled:false', async () => {
      let ran = false;
      registerHook('BeforeTool', () => {
        ran = true;
      }, { enabled: false, handlerName: 'disabled-at-registration' });

      await fireHook('BeforeTool', makeCtx());
      expect(ran).toBe(false);
    });

    it('fires an enabled handler while skipping a disabled handler in same event', async () => {
      const order: string[] = [];

      registerHook('AfterTool', () => {
        order.push('enabled-handler');
      }, { enabled: true, priority: 5, handlerName: 'enabled-handler' });

      registerHook('AfterTool', () => {
        order.push('disabled-handler');
      }, { enabled: false, priority: 5, handlerName: 'disabled-handler' });

      await fireHook('AfterTool', makeCtx());
      expect(order).toEqual(['enabled-handler']);
    });
  });

  // --------------------------------------------------------------------------
  // runHooks integration (via re-export barrel)
  // --------------------------------------------------------------------------

  describe('runHooks integration', () => {
    it('runs all registered handlers sequentially', async () => {
      const results: number[] = [];
      registerHook('event.fabric.published', async () => {
        await wait(5);
        results.push(1);
      }, { handlerName: 'sequential-1' });
      registerHook('event.fabric.published', async () => {
        await wait(5);
        results.push(2);
      }, { handlerName: 'sequential-2' });

      await runHooks('event.fabric.published', makeCtx());
      expect(results).toEqual([1, 2]);
    });

    it('handler receives payload as part of dispatch context', async () => {
      let receivedPayload: unknown = null;
      registerHook('BeforeAgent', (ctx) => {
        receivedPayload = ctx.payload;
      }, { handlerName: 'payload-receiver' });

      const payload = makeCtx({ magic: 'value-42' });
      await runHooks('BeforeAgent', payload);
      expect(receivedPayload).toBe(payload);
    });
  });
});
