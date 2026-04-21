import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in the initial state', () => {
    const m = makeSimpleMachine();
    expect(m.getState()).toBe('IDLE');
  });

  it('transitions to next state on valid event', async () => {
    const m = makeSimpleMachine();
    const next = await m.transition('start');
    expect(next).toBe('WORKING');
    expect(m.getState()).toBe('WORKING');
  });

  it('throws on invalid event for current state', async () => {
    const m = makeSimpleMachine();
    await expect(m.transition('finish')).rejects.toThrow(
      "Invalid transition: IDLE + event 'finish'"
    );
  });

  it('respects guard conditions', async () => {
    const states: StateNode<TestState>[] = [
      { name: 'IDLE' }, { name: 'WORKING' }, { name: 'DONE' }, { name: 'ERROR' },
    ];
    const transitions: Transition<TestState>[] = [
      {
        from: 'IDLE',
        to: 'WORKING',
        event: 'start',
        guard: (ctx) => ctx.retryCount < 3,
      },
    ];
    const m = new AgentStateMachine<TestState>(states, transitions, 'IDLE', 'test-guard');
    m.updateContext({ task: 'test', retryCount: 5 });
    await expect(m.transition('start')).rejects.toThrow('Guard blocked');
  });

  it('calls saveCheckpoint on each transition', async () => {
    const { saveCheckpoint } = await import('../src/core/checkpoint.js');
    const m = makeSimpleMachine('test-cp');
    await m.transition('start');
    expect(saveCheckpoint).toHaveBeenCalledWith(
      'test-cp',
      1,
      'WORKING',
      expect.objectContaining({ machineState: 'WORKING' })
    );
  });

  it('calls onEnter hook when entering a state', async () => {
    const onEnter = vi.fn().mockResolvedValue(undefined);
    const states: StateNode<TestState>[] = [
      { name: 'IDLE' },
      { name: 'WORKING', onEnter },
      { name: 'DONE' },
      { name: 'ERROR' },
    ];
    const transitions: Transition<TestState>[] = [
      { from: 'IDLE', to: 'WORKING', event: 'start' },
    ];
    const m = new AgentStateMachine<TestState>(states, transitions, 'IDLE', 'test-hook');
    await m.transition('start');
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it('guard allows transition when condition passes', async () => {
    const states: StateNode<TestState>[] = [
      { name: 'IDLE' }, { name: 'WORKING' }, { name: 'DONE' }, { name: 'ERROR' },
    ];
    const transitions: Transition<TestState>[] = [
      {
        from: 'IDLE',
        to: 'WORKING',
        event: 'start',
        guard: (ctx) => ctx.retryCount < 3,
      },
    ];
    const m = new AgentStateMachine<TestState>(states, transitions, 'IDLE', 'test-guard-pass');
    m.updateContext({ task: 'test', retryCount: 0 }); // retryCount < 3 → guard passes
    const next = await m.transition('start');
    expect(next).toBe('WORKING');
  });

  it('updateContext merges partial patch without losing other fields', () => {
    const m = makeSimpleMachine();
    m.updateContext({ task: 'hello', agentName: 'DeveloperAgent' });
    const ctx = m.getContext();
    expect(ctx.task).toBe('hello');
    expect(ctx.agentName).toBe('DeveloperAgent');
    expect(ctx.retryCount).toBe(0);  // nem törlődött
  });
});
