import { describe, it, expect } from 'vitest';
import { DeadlockDetector } from '../src/core/deadlockDetector.js';

describe('DeadlockDetector', () => {
  it('detects simple cycle', () => {
    const d = new DeadlockDetector();
    d.addEdge('A', 'B');
    d.addEdge('B', 'C');
    d.addEdge('C', 'A');
    const cycles = d.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    const flattened = new Set(cycles.flat());
    expect(flattened.has('A')).toBe(true);
    expect(flattened.has('B')).toBe(true);
    expect(flattened.has('C')).toBe(true);
  });

  it('resolves deadlock by picking lowest priority victim', () => {
    const d = new DeadlockDetector();
    d.addEdge('A', 'B');
    d.addEdge('B', 'A');
    const victim = d.resolveDeadlock({ A: 10, B: 5 });
    expect(victim).toBe('B');
  });
});
