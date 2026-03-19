import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InnovationBridgeAgent } from '../src/agents/InnovationBridgeAgent.js';
import * as llmClient from '../src/core/llm_client.js';

vi.mock('../src/core/llm_client.js', () => ({
  generateResponse: vi.fn()
}));

// Mock RAG utilities (LanceDB not available in test env)
vi.mock('../src/utils/rag.js', () => ({
  searchRAG: vi.fn().mockResolvedValue([]),
  addToIndex: vi.fn().mockResolvedValue(undefined),
}));

describe('InnovationBridgeAgent - Core Logic', () => {
  let agent: InnovationBridgeAgent;

  beforeEach(() => {
    agent = new InnovationBridgeAgent();
    vi.clearAllMocks();
  });

  it('should analyze intent and map to principles correctly', async () => {
    // Mock GPT-4o response for a speed vs temperature problem
    (llmClient.generateResponse as any).mockResolvedValue(JSON.stringify({
      improvedIndex: 9, // Speed
      improvedParam: "Speed",
      worsenedParamIndex: 17, // Temperature
      worsenedParam: "Temperature",
      reasoning: "Increasing speed generates more heat."
    }));

    const result = await agent.executeTask({ task: "How to make the CPU faster without overheating?" });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Speed vs Temperature');
    expect(result.data).toHaveProperty('suggestedPrinciples');
    // Principles for 9 vs 17 in our sparse matrix: [13, 15, 19, 35]
    expect((result.data as any).suggestedPrinciples.length).toBeGreaterThan(0);
  });

  it('should handle missing principles gracefully', async () => {
    // Mock response for an unknown contradiction
    (llmClient.generateResponse as any).mockResolvedValue(JSON.stringify({
      improvedIndex: 1, 
      improvedParam: "Weight",
      worsenedParamIndex: 1, 
      worsenedParam: "Weight",
      reasoning: "Identical parameters."
    }));

    const result = await agent.executeTask({ task: "Improve weight without weight." });

    expect(result.success).toBe(true);
    expect(result.message).toContain('nem találtam közvetlen alapelvet');
  });

  it('should return failure on LLM error', async () => {
    (llmClient.generateResponse as any).mockRejectedValue(new Error("API Down"));

    const result = await agent.executeTask({ task: "Something" });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Hiba az innovációs folyamat során');
  });
});
