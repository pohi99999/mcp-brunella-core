import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ALL dependencies before importing the module
vi.mock('@packages/core-logic/phoenixEventBus.js', () => ({
  phoenixEventBus: { subscribe: vi.fn() }
}));
vi.mock('@packages/core-logic/bifrost_gateway.js', () => ({
  bifrostGateway: { setMode: vi.fn(), getMode: vi.fn(() => 'local-preferred') }
}));
vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {},
  swarmManager: { pauseAllColonies: vi.fn(), resumeAllColonies: vi.fn() }
}));
vi.mock('@packages/core-logic/eventBus.js', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() }
}));
vi.mock('@packages/core-logic/checkpoint.js', () => ({
  saveCheckpoint: vi.fn(async () => 'ok')
}));
vi.mock('@packages/utils/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('@packages/utils/rag.js', () => ({ addToIndex: vi.fn() }));
vi.mock('@packages/utils/logger.js', () => ({ logInfo: vi.fn(), logError: vi.fn(), logWarn: vi.fn(), setAgentStatus: vi.fn() }));

describe('CeanFallback Phoenix handlers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers phoenix:degraded and phoenix:recovery handlers', async () => {
    const { phoenixEventBus } = await import('@packages/core-logic/phoenixEventBus.js');

    await import('@packages/core-logic/ceanFallback.js');

    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:degraded', expect.any(Function));
    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:recovery', expect.any(Function));
  });
});
