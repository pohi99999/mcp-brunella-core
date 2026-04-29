import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InnovationBridgeAgent } from '@packages/agents/InnovationBridgeAgent.js';
import * as rag from '@packages/utils/rag.js';
import * as llmClient from '@packages/core-logic/llm_client.js';
import { agentManager } from '@packages/agents/AgentManager.js';

vi.mock('@packages/utils/rag.js', () => ({
  addToIndex: vi.fn(),
  searchRAG: vi.fn()
}));

vi.mock('@packages/core-logic/llm_client.js', () => ({
  generateResponse: vi.fn()
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn()
  }
}));

describe('InnovationBridgeAgent - Persistence', () => {
  let agent: InnovationBridgeAgent;

  beforeEach(() => {
    agent = new InnovationBridgeAgent();
    vi.clearAllMocks();
  });

  it('should return analogy from memory if confidence is high', async () => {
    (rag.searchRAG as any).mockResolvedValue([
      { text: "Old analogy content", score: 0.1 }
    ]);

    const result = await agent.executeTask({ task: "Known problem" });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Találtam egy korábbi analógiát');
    expect(llmClient.generateResponse).not.toHaveBeenCalled();
  });

  it('should store new results to memory', async () => {
    (rag.searchRAG as any).mockResolvedValue([]);
    (llmClient.generateResponse as any).mockResolvedValue(JSON.stringify({
      improvedIndex: 9, improvedParam: "Speed", worsenedParamIndex: 17, worsenedParam: "Temp"
    }));
    (agentManager.delegate as any).mockResolvedValue({ success: true, message: "New finding" });

    await agent.executeTask({ task: "New problem" });

    expect(rag.addToIndex).toHaveBeenCalled();
    expect(rag.addToIndex).toHaveBeenCalledWith(expect.stringContaining('innovation_'), expect.stringContaining('New finding'));
  });
});
