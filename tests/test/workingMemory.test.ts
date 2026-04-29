import { describe, it, expect } from 'vitest';
import {
  appendWorkingMemoryMessage,
  createWorkingMemoryState,
  formatWorkingMemory,
  recordWorkingMemoryObservation,
  rememberWorkingMemoryGoal,
} from '@packages/core-logic/workingMemory.js';

describe('workingMemory', () => {
  it('compacts large message history into a summary window', () => {
    let state = createWorkingMemoryState(30);

    state = appendWorkingMemoryMessage(state, { role: 'user', content: 'A'.repeat(120) });
    state = appendWorkingMemoryMessage(state, { role: 'assistant', content: 'B'.repeat(120) });
    state = appendWorkingMemoryMessage(state, { role: 'user', content: 'C'.repeat(120) });

    expect(state.summary).not.toContain('Nincs még');
    expect(state.recentMessages.length).toBeLessThanOrEqual(5);
    expect(state.tokenEstimate).toBeGreaterThan(0);
  });

  it('stores tool observations and goals in formatted memory context', () => {
    let state = createWorkingMemoryState();
    state = rememberWorkingMemoryGoal(state, 'Stabilizáld a runtime-ot');
    state = recordWorkingMemoryObservation(state, 'delegate_task: Task ID 42');

    const formatted = formatWorkingMemory(state);
    expect(formatted).toContain('Stabilizáld a runtime-ot');
    expect(formatted).toContain('delegate_task: Task ID 42');
  });
});