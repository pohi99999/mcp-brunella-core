import { beforeEach, describe, expect, it, vi } from 'vitest';

const { checkPatternMock, saveMemoryMock } = vi.hoisted(() => ({
  checkPatternMock: vi.fn(),
  saveMemoryMock: vi.fn(),
}));

vi.mock('../src/core/patternReuse.js', () => ({
  checkPattern: checkPatternMock,
}));

vi.mock('../src/core/structuredMemory.js', () => ({
  queryMemory: vi.fn().mockReturnValue([]),
  saveMemory: saveMemoryMock,
}));

vi.mock('../src/utils/rag.js', () => ({
  searchRAG: vi.fn().mockResolvedValue([]),
  addToIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/responseFormatter.js', () => ({
  formatAgentResult: vi.fn((result: { message: string }) => result.message),
}));

import { BaseAgent, type AgentContext, type AgentResult } from '../src/agents/BaseAgent.js';

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

describe('BaseAgent fail-open guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkPatternMock.mockReturnValue({ matched: false, threshold: 0.7 });
    saveMemoryMock.mockReturnValue(undefined);
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
  });
});
