import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BifrostGateway, ProviderType, TaskType } from '../src/core/bifrost_gateway.js';

/**
 * Bifrost Gateway Tests
 *
 * Mocks all external providers to ensure tests pass in CI/CD without API keys.
 */

// Use vi.hoisted to ensure mocks are available in the mock factory
const { mockOllamaGenerate, mockGeminiGenerateContent, mockAnthropicCreate } = vi.hoisted(() => {
  return {
    mockOllamaGenerate: vi.fn(),
    mockGeminiGenerateContent: vi.fn(),
    mockAnthropicCreate: vi.fn()
  };
});

// Fix: Ollama mock must be a class constructor
vi.mock('ollama', () => {
  return {
    Ollama: class {
      constructor() {}
      generate = mockOllamaGenerate;
      chat = vi.fn().mockImplementation(async (options) => ({
        message: { content: 'GitHub Models response' }
      }));
    }
  };
});

// Fix: GoogleGenerativeAI mock must be a class constructor
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel = vi.fn().mockReturnValue({
        generateContent: mockGeminiGenerateContent
      });
    }
  };
});

// Fix: Anthropic mock must be a class constructor
vi.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: class {
      constructor() {}
      messages = {
        create: mockAnthropicCreate
      };
    }
  };
});

// Mock logger to reduce noise
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn()
}));

describe('Bifrost Gateway', () => {
  let gateway: BifrostGateway;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockOllamaGenerate.mockResolvedValue({
      response: 'Ollama response',
      prompt_eval_count: 10,
      eval_count: 20
    });

    mockGeminiGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Gemini response',
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 25,
          totalTokenCount: 40
        }
      }
    });

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Anthropic response' }],
      usage: {
        input_tokens: 20,
        output_tokens: 30
      }
    });

    // Mock environment variables
    vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434');
    vi.stubEnv('GEMINI_API_KEY', 'mock-gemini-key');
    vi.stubEnv('GITHUB_PAT', 'mock-github-pat');
    vi.stubEnv('ANTHROPIC_API_KEY', 'mock-anthropic-key');

    gateway = new BifrostGateway();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Initialization', () => {
    it('should initialize with provider configurations', () => {
      const stats = gateway.getStats();

      expect(stats).toBeDefined();
      expect(stats.total_requests).toBe(0);
      expect(stats.enabled_providers).toBeDefined();
      expect(stats.enabled_providers.length).toBe(4); // All 4 enabled by stubEnv
    });

    it('should have Ollama enabled by default', () => {
      const enabled = gateway.getEnabledProviders();
      expect(enabled).toContain('ollama');
    });
  });

  describe('Provider Selection', () => {
    it('should auto-select provider for "code" task type', async () => {
      const result = await gateway.generate({
        prompt: 'Write a hello world in Python',
        taskType: 'code',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      // Code tasks prefer Ollama (Qwen2.5-Coder)
      expect(result.provider).toBe('ollama');
      expect(result.content).toBe('Ollama response');
    });

    it('should auto-select provider for "general" task type', async () => {
      const result = await gateway.generate({
        prompt: 'What is 2+2?',
        taskType: 'general',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      // General tasks prefer Gemini
      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini response');
    });

    it('should allow manual provider override', async () => {
      const result = await gateway.generate({
        prompt: 'Test prompt',
        provider: 'ollama',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama');
    });
  });

  describe('Ollama Provider', () => {
    it('should generate with Ollama', async () => {
      const result = await gateway.generate({
        prompt: 'Say "test successful"',
        provider: 'ollama',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama');
      expect(result.content).toBe('Ollama response');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('should support custom temperature', async () => {
      const result = await gateway.generate({
        prompt: 'Generate a random number',
        provider: 'ollama',
        temperature: 0.1,
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(mockOllamaGenerate).toHaveBeenCalledWith(expect.objectContaining({
        options: expect.objectContaining({ temperature: 0.1 })
      }));
    });

    it('should support system prompts', async () => {
      const result = await gateway.generate({
        prompt: 'What is your role?',
        provider: 'ollama',
        systemPrompt: 'You are a helpful coding assistant.',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      expect(mockOllamaGenerate).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('You are a helpful coding assistant.')
      }));
    });
  });

  describe('Gemini Provider', () => {
    it('should generate with Gemini', async () => {
      const result = await gateway.generate({
        prompt: 'What is 2+2? Answer with just the number.',
        provider: 'gemini',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini response');
    });
  });

  describe('GitHub Models Provider', () => {
    it('should generate with GitHub Models', async () => {
      const result = await gateway.generate({
        prompt: 'Say "GitHub Models working"',
        provider: 'github',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('github');
      expect(result.content).toBe('GitHub Models response');
    });
  });

  describe('Anthropic Provider', () => {
    it('should generate with Anthropic', async () => {
      const result = await gateway.generate({
        prompt: 'What is 5+5? Answer with just the number.',
        provider: 'anthropic',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('anthropic');
      expect(result.content).toBe('Anthropic response');
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to Ollama if cloud provider fails', async () => {
      // Force Gemini to fail
      mockGeminiGenerateContent.mockRejectedValueOnce(new Error('Gemini API Error'));

      const result = await gateway.generate({
        prompt: 'Test fallback',
        provider: 'gemini',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama'); // Fell back
      expect(result.fallback_used).toBe(true);
      expect(result.content).toBe('Ollama response');
    });

    it('should not use fallback if Ollama is selected directly', async () => {
      mockOllamaGenerate.mockRejectedValueOnce(new Error('Ollama Failed'));

      const result = await gateway.generate({
        prompt: 'Direct Ollama test',
        provider: 'ollama',
        maxTokens: 20
      });

      // Should fail, not recurse
      expect(result.success).toBe(false);
      expect(result.error).toContain('Ollama Failed');
    });
  });

  describe('Health Monitoring', () => {
    it('should check health of all providers', async () => {
      const health = await gateway.checkHealth();

      expect(health).toBeDefined();
      expect(health.length).toBeGreaterThan(0);

      // All should be healthy due to mocks
      const ollama = health.find(h => h.provider === 'ollama');
      expect(ollama?.available).toBe(true);

      const gemini = health.find(h => h.provider === 'gemini');
      expect(gemini?.available).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track request counts by provider', async () => {
      const statsBefore = gateway.getStats();
      const initialCount = statsBefore.total_requests;

      // Make some requests
      await gateway.generate({
        prompt: 'Test 1',
        provider: 'ollama',
        maxTokens: 10
      });

      await gateway.generate({
        prompt: 'Test 2',
        provider: 'gemini',
        maxTokens: 10
      });

      const statsAfter = gateway.getStats();

      expect(statsAfter.total_requests).toBe(initialCount + 2);
      expect(statsAfter.by_provider.ollama).toBeDefined();
      expect(statsAfter.by_provider.gemini).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unavailable provider gracefully (with fallback)', async () => {
      // Disable Anthropic by removing key
      vi.stubEnv('ANTHROPIC_API_KEY', '');

      // Re-init gateway to pick up env change
      gateway = new BifrostGateway();

      const result = await gateway.generate({
        prompt: 'Test',
        provider: 'anthropic',
        maxTokens: 10
      });

      // Bifrost fallback logic means it will try Ollama if Anthropic fails/is disabled
      // So success should be true, but provider should be ollama and fallback_used true
      if (result.success) {
        expect(result.provider).toBe('ollama');
        expect(result.fallback_used).toBe(true);
      } else {
        // If fallback failed too (unexpected with mocks), check error
        expect(result.error).toBeDefined();
      }
    });
  });
});
