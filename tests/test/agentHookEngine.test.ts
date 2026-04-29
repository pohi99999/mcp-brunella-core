import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHook, fireHook, clearHooks, getDLQ, isHookBlockedExternally } from '@packages/core-logic/agentHookEngine.js';

describe('AgentHookEngine', () => {
  beforeEach(() => {
    clearHooks();
  });

  it('should register and fire a simple hook', async () => {
    const mockCallback = vi.fn();
    
    registerHook('test:event', mockCallback);
    await fireHook('test:event', { data: 'hello' });

    expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ data: 'hello' }));
  });

  it('should handle multiple hooks for the same event', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();

    registerHook('multi:event', mock1);
    registerHook('multi:event', mock2);
    await fireHook('multi:event', { val: 42 });

    expect(mock1).toHaveBeenCalledWith(expect.objectContaining({ val: 42 }));
    expect(mock2).toHaveBeenCalledWith(expect.objectContaining({ val: 42 }));
  });

  it('should support priority execution (critical runs before standard)', async () => {
    const executionOrder: string[] = [];
    
    registerHook('priority:event', async () => {
      executionOrder.push('standard');
    }, { priority: 'standard' });

    registerHook('priority:event', async () => {
      executionOrder.push('critical');
    }, { priority: 'critical' });

    await fireHook('priority:event', {});

    expect(executionOrder).toEqual(['critical', 'standard']);
  });

  it('should handle hook errors gracefully without crashing the engine', async () => {
    registerHook('error:event', () => {
      throw new Error('Hook failure');
    });

    // Should not throw
    await expect(fireHook('error:event', {})).resolves.not.toThrow();
  });

  it('should record hook failures in the Dead Letter Queue', async () => {
    const eventName = 'dlq:event';
    registerHook(eventName, () => {
      throw new Error('Fatal error');
    }, { priority: 'critical' });

    await fireHook(eventName, { test: 'payload' });

    const dlq = getDLQ();
    const failure = dlq.find(f => f.event === eventName);
    
    expect(failure).toBeDefined();
    expect(failure?.error).toContain('Fatal error');
    expect(failure?.payload).toEqual({ test: 'payload' });
  });

  it('should trigger Circuit Breaker after multiple failures', async () => {
    const eventName = 'circuit:event';
    let callCount = 0;
    
    registerHook(eventName, () => {
      callCount++;
      throw new Error('Repeated failure');
    }, { priority: 'critical' });

    // Fire 3 times (threshold is 3)
    await fireHook(eventName, {});
    await fireHook(eventName, {});
    await fireHook(eventName, {});

    // 4th fire should be blocked by circuit breaker
    await fireHook(eventName, {});

    expect(callCount).toBe(3);
    expect(isHookBlockedExternally(eventName)).toBe(true);
  });
});
