import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignGeneratorAgent } from '@packages/agents/CampaignGeneratorAgent.js';
import { agentManager } from '@packages/agents/AgentManager.js';

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn()
  }
}));

describe('CampaignGeneratorAgent', () => {
  let agent: CampaignGeneratorAgent;

  beforeEach(() => {
    agent = new CampaignGeneratorAgent();
    vi.clearAllMocks();
  });

  it('should orchestrate a full campaign generation', async () => {
    (agentManager.delegate as any).mockImplementation((name: string) => {
      if (name === 'LeadMiningAgent') return Promise.resolve({ success: true, data: { leads: [{ company: 'Test' }] } });
      if (name === 'CopywriterAgent') return Promise.resolve({ success: true, message: 'Social posts' });
      if (name === 'UXDesignerAgent') return Promise.resolve({ success: true, message: 'Landing page' });
      return Promise.resolve({ success: true });
    });

    const result = await agent.executeTask({ task: "Cserszegtomaj AI turizmus" });

    expect(result.success).toBe(true);
    expect(result.message).toContain('A kampány sikeresen legenerálva');
    expect(result.data).toHaveProperty('report');
    expect(agentManager.delegate).toHaveBeenCalledTimes(3);
  });

  it('should handle failures in sub-agents', async () => {
    (agentManager.delegate as any).mockResolvedValue({ success: false, message: 'Error' });

    const result = await agent.executeTask({ task: "Fail" });

    expect(result.success).toBe(false);
    expect(result.message).toContain('sikertelen');
  });
});
