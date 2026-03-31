import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BifrostGateway } from '../src/core/bifrost_gateway.js';

// Re-implementing mocks safely
vi.mock('ollama', () => ({
    Ollama: class {
        constructor() { /* ... */ }
        chat = vi.fn().mockResolvedValue({
          message: { content: 'Ollama mock response' },
          prompt_eval_count: 10,
          eval_count: 5,
        });
    },
    default: class {
        constructor() { /* ... */ }
        chat = vi.fn().mockResolvedValue({
          message: { content: 'Ollama mock response' },
          prompt_eval_count: 10,
          eval_count: 5,
        });
    }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(_opts: { apiKey: string }) { /* ... */ }
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: 'Gemini mock response',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }
      })
    };
  }
}));

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    constructor() { /* ... */ }
    request = vi.fn().mockResolvedValue({
      data: { content: 'GitHub mock response' }
    });
  }
}));

describe('Bifrost Gateway', () => {
  let gateway: BifrostGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GITHUB_TOKEN = 'test-github-token';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'GitHub mock response' } }],
      }),
    }) as any;
    gateway = new BifrostGateway();
  });

  it('should generate content using GitHub GPT-4.1 as default system brain', async () => {
    const result = await gateway.generate({ prompt: 'test prompt', taskType: 'general' });
    expect(result.success).toBe(true);
    expect(result.provider).toBe('github');
    expect(result.content).toBe('GitHub mock response');
  });

  it('should route to a capable model for "code" tasks', async () => {
    const result = await gateway.generate({ prompt: "write a function", taskType: "code" });
    expect(result.success).toBe(true);
    expect(['github', 'ollama']).toContain(result.provider);
  });
  
  it('should handle "reasoning" task type by routing to a capable model', async () => {
    const result = await gateway.generate({ prompt: "reasoning task", taskType: "reasoning" });
    expect(result.success).toBe(true);
    expect(['gemini', 'github', 'ollama']).toContain(result.provider);
  });

    it('should fallback deterministically when provider failure is fallback-eligible', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('network error'));

      const result = await gateway.generate({ prompt: "test", provider: "github" });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini mock response');
      expect(result.fallback_used).toBe(true);
      expect(result.fallback_reason).toBe('api_error');
      expect(result.phoenix_triggered).toBe(true);
  });
});
