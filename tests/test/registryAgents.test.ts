import { beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.fn();
const registerAgentMock = vi.fn();
const dynamicAgentCtorMock = vi.fn();

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    initialize: initializeMock,
    registerAgent: registerAgentMock,
  },
}));

vi.mock('@packages/agents/DynamicAgent.js', () => ({
  DynamicAgent: class {
    constructor(path: string) {
      dynamicAgentCtorMock(path);
    }
  },
}));

describe('registerAgents', () => {
  beforeEach(() => {
    vi.resetModules();
    initializeMock.mockReset();
    registerAgentMock.mockReset();
    dynamicAgentCtorMock.mockReset();
  });

  it('initializes and registers dynamic agents only once per process', async () => {
    const { registerAgents } = await import('@apps/mcp-core/server/registry.js');

    await registerAgents();
    await registerAgents();

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(dynamicAgentCtorMock).toHaveBeenCalledTimes(2);
    expect(registerAgentMock).toHaveBeenCalledTimes(2);
  });
});
