import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentHookEngine } from '../src/core/agentHookEngine.js';

describe('AgentHookEngine', () => {
  beforeEach(() => {
    // Reset triggers before each test
    (agentHookEngine as any).hooks = new Map();
  });

  it('should register and fire a simple hook', async () => {
    const mockCallback = vi.fn();
    
    agentHookEngine.register('test:event', mockCallback);
    await agentHookEngine.fire('test:event', { data: 'hello' });

    expect(mockCallback).toHaveBeenCalledWith({ data: 'hello' });
  });

  it('should handle multiple hooks for the same event', async () => {
    const mock1 = vi.fn();
    const mock2 = vi.fn();

    agentHookEngine.register('multi:event', mock1);
    agentHookEngine.register('multi:event', mock2);
    await agentHookEngine.fire('multi:event', { val: 42 });

    expect(mock1).toHaveBeenCalledWith({ val: 42 });
    expect(mock2).toHaveBeenCalledWith({ val: 42 });
  });

  it('should support priority execution (critical runs before standard)', async () => {
    const executionOrder: string[] = [];
    
    agentHookEngine.register('priority:event', async () => {
      executionOrder.push('standard');
    }, { priority: 'standard' });

    agentHookEngine.register('priority:event', async () => {
      executionOrder.push('critical');
    }, { priority: 'critical' });

    await agentHookEngine.fire('priority:event', {});

    expect(executionOrder).toEqual(['critical', 'standard']);
  });

  it('should handle hook errors gracefully without crashing the engine', async () => {
    agentHookEngine.register('error:event', () => {
      throw new Error('Hook failure');
    });

    // Should not throw
    await expect(agentHookEngine.fire('error:event', {})).resolves.not.toThrow();
  });

  it('should record hook failures in the Dead Letter Queue', async () => {
    const eventName = 'dlq:event';
    agentHookEngine.register(eventName, () => {
      throw new Error('Fatal error');
    }, { priority: 'critical' });

    await agentHookEngine.fire(eventName, { test: 'payload' });

    const dlq = agentHookEngine.getDLQ();
    const failure = dlq.find(f => f.event === eventName);
    
    expect(failure).toBeDefined();
    expect(failure?.error).toContain('Fatal error');
    expect(failure?.payload).toEqual({ test: 'payload' });
  });

  it('should trigger Circuit Breaker after multiple failures', async () => {
    const eventName = 'circuit:event';
    let callCount = 0;
    
    agentHookEngine.register(eventName, () => {
      callCount++;
      throw new Error('Repeated failure');
    }, { priority: 'critical' });

    // Fire 3 times (threshold is 3)
    await agentHookEngine.fire(eventName, {});
    await agentHookEngine.fire(eventName, {});
    await agentHookEngine.fire(eventName, {});

    // 4th fire should be blocked by circuit breaker
    await agentHookEngine.fire(eventName, {});

    expect(callCount).toBe(3);
    expect(agentHookEngine.isHookBlockedExternally(eventName)).toBe(true);
  });
});
