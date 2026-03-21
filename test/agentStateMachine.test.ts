import { describe, it, expect, vi } from 'vitest';

// IMPORTANT: vi.mock() MUST be at module scope (Vitest hoisting!)
vi.mock('../src/core/checkpoint.js', () => ({
  saveCheckpoint: vi.fn().mockResolvedValue(1),
  loadCheckpoint: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import { AgentStateMachine, type StateNode, type Transition } from '../src/core/agentStateMachine.js';

type TestState = 'IDLE' | 'WORKING' | 'DONE' | 'ERROR';

function makeSimpleMachine(taskId = 'test-1') {
  const states: StateNode<TestState>[] = [
    { name: 'IDLE' },
    { name: 'WORKING' },
    { name: 'DONE' },
    { name: 'ERROR' },
  ];
  const transitions: Transition<TestState>[] = [
    { from: 'IDLE',    to: 'WORKING', event: 'start' },
    { from: 'WORKING', to: 'DONE',    event: 'finish' },
    { from: 'WORKING', to: 'ERROR',   event: 'fail' },
  ];
  return new AgentStateMachine<TestState>(states, transitions, 'IDLE', taskId);
}

describe('AgentStateMachine', () => {
  it('starts in the initial state', () => {
    const m = makeSimpleMachine();
    expect(m.getState()).toBe('IDLE');
  });
});
