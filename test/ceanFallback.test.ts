import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ALL dependencies before importing the module
vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: { subscribe: vi.fn() }
}));
vi.mock('../src/core/bifrost_gateway.js', () => ({
  bifrostGateway: { setMode: vi.fn(), getMode: vi.fn(() => 'local-preferred') }
}));
vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {},
  swarmManager: { pauseAllColonies: vi.fn(), resumeAllColonies: vi.fn() }
}));
vi.mock('../src/core/eventBus.js', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() }
}));
vi.mock('../src/core/checkpoint.js', () => ({
  saveCheckpoint: vi.fn(async () => 'ok')
}));
vi.mock('../src/config/index.js', () => ({ config: { workspaceRoot: '.', systemLogDir: 'logs' } }));
vi.mock('../src/utils/rag.js', () => ({ addToIndex: vi.fn() }));
vi.mock('../src/utils/logger.js', () => ({ logInfo: vi.fn(), logError: vi.fn(), logWarn: vi.fn(), setAgentStatus: vi.fn() }));

describe('CeanFallback Phoenix handlers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('registers phoenix:degraded and phoenix:recovery handlers', async () => {
    const { phoenixEventBus } = await import('../src/core/phoenixEventBus.js');

    await import('../src/core/ceanFallback.js');

    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:degraded', expect.any(Function));
    expect(phoenixEventBus.subscribe).toHaveBeenCalledWith('phoenix:recovery', expect.any(Function));
  });
});
