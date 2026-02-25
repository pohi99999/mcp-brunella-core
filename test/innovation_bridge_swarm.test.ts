import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InnovationBridgeAgent } from '../src/agents/InnovationBridgeAgent.js';
import * as llmClient from '../src/core/llm_client.js';
import { agentManager } from '../src/agents/AgentManager.js';

vi.mock('../src/core/llm_client.js', () => ({
  generateResponse: vi.fn()
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn()
  }
}));

describe('InnovationBridgeAgent - Swarm Orchestration', () => {
  let agent: InnovationBridgeAgent;

  beforeEach(() => {
    agent = new InnovationBridgeAgent();
    vi.clearAllMocks();
  });

  it('should launch parallel research tasks for each principle', async () => {
    // Mock intent analysis
    (llmClient.generateResponse as any).mockResolvedValue(JSON.stringify({
      improvedIndex: 17, // Temperature
      improvedParam: "Temperature",
      worsenedParamIndex: 39, // Productivity
      worsenedParam: "Productivity",
      reasoning: "Cooling slows down production."
    }));

    // Principles for 17 vs 39: [28, 31, 35, 19]
    (agentManager.delegate as any).mockResolvedValue({ success: true, message: "Found analogy" });

    const result = await agent.executeTask({ task: "Improve cooling efficiency." });

    expect(result.success).toBe(true);
    // Should call delegate 4 times (for each principle)
    expect(agentManager.delegate).toHaveBeenCalledTimes(4);
    expect(agentManager.delegate).toHaveBeenCalledWith("Researcher", expect.stringContaining("Mechanics substitution"));
    expect((result.data as any).swarmResults).toHaveLength(4);
  });
});
