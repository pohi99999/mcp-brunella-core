import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getToolRegistryMock, generateMock } = vi.hoisted(() => ({
  getToolRegistryMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock('../src/core/toolRegistry.js', () => ({
  getToolRegistry: getToolRegistryMock,
}));

vi.mock('../src/core/bifrost_gateway.js', () => ({
  getBifrostGateway: () => ({
    generate: generateMock,
  }),
}));

vi.mock('../src/core/graphRagEngine.js', () => ({
  GraphRagEngine: {
    getInstance: () => ({
      init: vi.fn().mockResolvedValue(undefined),
      ingestConversation: vi.fn().mockResolvedValue(undefined),
      queryContext: () => ({ summary: '' }),
    }),
  },
}));

vi.mock('../src/core/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      generatePromptContext: () => '',
      reflect: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('../src/core/predictiveIntelligence.js', () => ({
  PredictiveIntelligence: {
    getInstance: () => ({
      getDecisionContext: () => '',
      getPredictiveContext: () => '',
      init: vi.fn().mockResolvedValue(undefined),
      recordSignal: vi.fn().mockResolvedValue(undefined),
      getStats: () => ({ signals: 1 }),
      analyze: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { UniversalOrchestratorService } from '../src/core/universalOrchestratorService.js';

describe('UniversalOrchestratorService fail-open bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToolRegistryMock.mockRejectedValue(new Error('registry unavailable'));
    generateMock.mockResolvedValue({
      success: true,
      content: 'Rendben, fallback tool-listával is válaszolok.',
      toolCalls: undefined,
      provider: 'github',
      model: 'gpt-4.1',
    });
  });

  it('continues processing when tool registry bootstrap fails', async () => {
    const service = new UniversalOrchestratorService();
    const response = await service.process({
      message: 'Szia, mesélj röviden.',
      provider: 'github',
      conversationHistory: [],
      sessionId: 'test-session-registry-fallback',
    });

    expect(getToolRegistryMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(response.reply).toContain('fallback tool-listával');
    expect(response.actionsTriggered).toEqual([]);
  });
});
