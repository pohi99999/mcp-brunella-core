import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCoordinator } from '@packages/core-logic/agentCoordinator.js';

describe('AgentCoordinator', () => {
  let coord: AgentCoordinator;

  beforeEach(() => {
    coord = new AgentCoordinator();
  });

  it('acquires and releases locks', () => {
    const ok = coord.acquireLock('res1', 'agentA');
    expect(ok).toBe(true);
    const ok2 = coord.acquireLock('res1', 'agentB');
    expect(ok2).toBe(false);
    const released = coord.releaseLock('res1', 'agentA');
    expect(released).toBe(true);
    const ok3 = coord.acquireLock('res1', 'agentB');
    expect(ok3).toBe(true);
  });

  it('cleans up expired locks', () => {
    const now = Date.now();
    // create a lock with small TTL
    const ok = coord.acquireLock('resX', 'agentX', 100);
    expect(ok).toBe(true);
    // simulate time after TTL
    coord.cleanupExpiredLocks(now + 1_000);
    const locks = coord.getActiveLocks();
    expect(locks.find(l => l.resource === 'resX')).toBeUndefined();
  });

  it('negotiateTask prefers higher priority then lower load', () => {
    coord.setLoad('a', 10);
    coord.setLoad('b', 0);
    const { winner } = coord.negotiateTask(['a', 'b'], { a: 1, b: 2 });
    expect(winner).toBe('b');
  });
});
