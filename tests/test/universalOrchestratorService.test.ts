import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getToolRegistryMock, generateMock } = vi.hoisted(() => ({
  getToolRegistryMock: vi.fn(),
  generateMock: vi.fn(),
}));

vi.mock('@packages/core-logic/toolRegistry.js', () => ({
  getToolRegistry: getToolRegistryMock,
  getFallbackToolDefinitions: vi.fn().mockReturnValue([
    {
      name: 'get_system_status',
      description: 'Rendszer állapot lekérdezése.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  ]),
}));

vi.mock('@packages/core-logic/bifrost_gateway.js', () => ({
  getBifrostGateway: () => ({
    generate: generateMock,
  }),
}));

vi.mock('@packages/core-logic/graphRagEngine.js', () => ({
  GraphRagEngine: {
    getInstance: () => ({
      init: vi.fn().mockResolvedValue(undefined),
      ingestConversation: vi.fn().mockResolvedValue(undefined),
      queryContext: () => ({ summary: '' }),
    }),
  },
}));

vi.mock('@packages/core-logic/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      generatePromptContext: () => '',
      reflect: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@packages/core-logic/predictiveIntelligence.js', () => ({
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

import { UniversalOrchestratorService } from '@packages/core-logic/universalOrchestratorService.js';

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
    const generateOptions = generateMock.mock.calls[0][0] as { tools: Array<{ name: string }> };
    expect(Array.isArray(generateOptions.tools)).toBe(true);
    expect(generateOptions.systemPrompt).toContain('get_system_status');
    expect(response.reply).toContain('fallback tool-listával');
    expect(response.actionsTriggered).toEqual([]);
  });
});
