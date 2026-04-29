import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkPatternMock,
  saveMemoryMock,
  addToIndexMock,
  fireHookSafelyMock,
  isHookEnabledMock,
  fireHooksMock,
} = vi.hoisted(() => ({
  checkPatternMock: vi.fn(),
  saveMemoryMock: vi.fn(),
  addToIndexMock: vi.fn(),
  fireHookSafelyMock: vi.fn(),
  isHookEnabledMock: vi.fn(),
  fireHooksMock: vi.fn(),
}));

vi.mock('@packages/core-logic/patternReuse.js', () => ({
  checkPattern: checkPatternMock,
  getPatternReuseThreshold: vi.fn().mockReturnValue(0.7),
}));

vi.mock('@packages/core-logic/structuredMemory.js', () => ({
  queryMemory: vi.fn().mockReturnValue([]),
  saveMemory: saveMemoryMock,
}));

vi.mock('@packages/utils/rag.js', () => ({
  searchRAG: vi.fn().mockResolvedValue([]),
  addToIndex: addToIndexMock,
}));

vi.mock('@packages/utils/responseFormatter.js', () => ({
  formatAgentResult: vi.fn((result: { message: string }) => result.message),
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHookSafely: fireHookSafelyMock,
  isHookEnabled: isHookEnabledMock,
}));

vi.mock('@packages/core-logic/hookEngine.js', () => ({
  fireHooks: fireHooksMock,
}));

import { BaseAgent, type AgentContext, type AgentResult } from '@packages/agents/BaseAgent.js';

class FailOpenTestAgent extends BaseAgent {
  name = 'FailOpenTestAgent';
  description = 'Test agent';
  role = 'test';

  protected override isTestMode(): boolean {
    return false;
  }

  protected override async queryMemory(): Promise<Array<{ text: string; score?: number }>> {
    return [];
  }

  async executeTask(_context: AgentContext): Promise<AgentResult> {
    return {
      success: true,
      message: 'Művelet kész.',
      data: { ok: true },
      metadata: {},
    };
  }
}

class ThrowingTestAgent extends FailOpenTestAgent {
  override async executeTask(_context: AgentContext): Promise<AgentResult> {
    throw new Error('agent core exploded');
  }
}

describe('BaseAgent fail-open guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkPatternMock.mockReturnValue({ matched: false, threshold: 0.7 });
    saveMemoryMock.mockReturnValue(undefined);
    fireHookSafelyMock.mockResolvedValue({ status: 'fired' });
    isHookEnabledMock.mockReturnValue(true);
    fireHooksMock.mockResolvedValue(undefined);
  });

  it('continues execution when pattern reuse lookup throws', async () => {
    checkPatternMock.mockImplementationOnce(() => {
      throw new Error('cache offline');
    });

    const agent = new FailOpenTestAgent();
    const response = await agent.execute('Futtasd a feladatot');

    expect(response.status).toBe('success');
    expect(response.message).toContain('Művelet kész.');
  });

  it('continues execution when structured memory persistence throws', async () => {
    saveMemoryMock.mockImplementationOnce(() => {
      throw new Error('db write failed');
    });

    const agent = new FailOpenTestAgent();
    const response = await agent.execute('Mentsd a tapasztalatot');

    expect(response.status).toBe('success');
    expect(response.message).toContain('Művelet kész.');
    expect(addToIndexMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes executeTask exceptions into an error response', async () => {
    const agent = new ThrowingTestAgent();
    const response = await agent.execute('Dobd el a hibát');

    expect(response.status).toBe('error');
    expect(response.error).toContain('agent core exploded');
  });

  it('emits lifecycle hooks only through the hook registry path', async () => {
    const agent = new FailOpenTestAgent();

    await agent.execute('Ellenorizd a lifecycle hookot');

    expect(fireHookSafelyMock).toHaveBeenCalledTimes(2);
    expect(fireHooksMock).not.toHaveBeenCalled();
  });
});
