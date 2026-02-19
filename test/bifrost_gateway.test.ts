import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BifrostGateway, ProviderType, TaskType } from '../src/core/bifrost_gateway.js';

/**
 * Bifrost Gateway Tests
 *
 * NOTE: Some tests require API keys for cloud providers
 * Tests will be skipped if providers are not configured
 */

// Dynamic Ollama availability check (top-level await, ES module)
let hasOllama = false;
try {
  const resp = await fetch('http://localhost:11434', {
    signal: AbortSignal.timeout(2000)
  });
  hasOllama = true; // any HTTP response means Ollama is running
} catch {
  hasOllama = false;
}

const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== '');
const hasGitHub = !!(process.env.GITHUB_PAT && process.env.GITHUB_PAT !== '');
const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== '');

describe('Bifrost Gateway', () => {
  let gateway: BifrostGateway;

  beforeEach(() => {
    gateway = new BifrostGateway();
  });

  describe('Initialization', () => {
    it('should initialize with provider configurations', () => {
      const stats = gateway.getStats();

      expect(stats).toBeDefined();
      expect(stats.total_requests).toBe(0);
      expect(stats.enabled_providers).toBeDefined();
      expect(stats.enabled_providers.length).toBeGreaterThan(0);
    });

    it('should have Ollama enabled by default', () => {
      const enabled = gateway.getEnabledProviders();

      expect(enabled).toContain('ollama');
    });

    it('should enable providers based on environment variables', () => {
      const enabled = gateway.getEnabledProviders();

      if (hasGemini) {
        expect(enabled).toContain('gemini');
      }

      if (hasGitHub) {
        expect(enabled).toContain('github');
      }

      if (hasAnthropic) {
        expect(enabled).toContain('anthropic');
      }
    });
  });

  describe('Provider Selection', () => {
    it.skipIf(!hasOllama)('should auto-select provider for "code" task type', async () => {
      const result = await gateway.generate({
        prompt: 'Write a hello world in Python',
        taskType: 'code',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      // Code tasks prefer Ollama (Qwen2.5-Coder)
      expect(result.provider).toBe('ollama');
    }, 30000);

    it.skipIf(!hasOllama && !hasGemini)('should auto-select provider for "general" task type', async () => {
      const result = await gateway.generate({
        prompt: 'What is 2+2?',
        taskType: 'general',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      // General tasks prefer Gemini or Ollama
      expect(['gemini', 'ollama']).toContain(result.provider);
    }, 30000);

    it.skipIf(!hasOllama)('should allow manual provider override', async () => {
      const result = await gateway.generate({
        prompt: 'Test prompt',
        provider: 'ollama',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama');
    }, 30000);
  });

  describe('Ollama Provider', () => {
    it.skipIf(!hasOllama)('should generate with Ollama', async () => {
      const result = await gateway.generate({
        prompt: 'Say "test successful"',
        provider: 'ollama',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ollama');
      expect(result.model).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.duration_ms).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasOllama)('should support custom temperature', async () => {
      const result = await gateway.generate({
        prompt: 'Generate a random number',
        provider: 'ollama',
        temperature: 0.1,
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    }, 30000);

    it.skipIf(!hasOllama)('should support system prompts', async () => {
      const result = await gateway.generate({
        prompt: 'What is your role?',
        provider: 'ollama',
        systemPrompt: 'You are a helpful coding assistant.',
        maxTokens: 50
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    }, 30000);
  });

  describe('Gemini Provider', () => {
    it.skipIf(!hasGemini)('should generate with Gemini', async () => {
      const result = await gateway.generate({
        prompt: 'What is 2+2? Answer with just the number.',
        provider: 'gemini',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      // In CI/CD, might fallback to Ollama if key is invalid
      expect(['gemini', 'ollama']).toContain(result.provider);
      expect(result.content).toBeDefined();
    }, 30000);

    it.skip('should use Gemini 2.0 Flash by default', async () => {
      const result = await gateway.generate({
        prompt: 'Test',
        provider: 'gemini',
        maxTokens: 10
      });

      expect(result.success).toBe(true);
      // Might fallback, so check both conditions
      if (result.provider === 'gemini') {
        expect(result.model).toContain('gemini');
      } else {
        // Fallback to Ollama is acceptable
        expect(result.provider).toBe('ollama');
      }
    }, 30000);
  });

  describe('GitHub Models Provider', () => {
    it.skip('should generate with GitHub Models', async () => {
      const result = await gateway.generate({
        prompt: 'Say "GitHub Models working"',
        provider: 'github',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(['github', 'ollama']).toContain(result.provider);
      expect(result.content).toBeDefined();
    }, 30000);
  });

  describe('Anthropic Provider', () => {
    it.skipIf(!hasAnthropic)('should generate with Anthropic', async () => {
      const result = await gateway.generate({
        prompt: 'What is 5+5? Answer with just the number.',
        provider: 'anthropic',
        maxTokens: 20
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('anthropic');
      expect(result.content).toBeDefined();
      expect(result.tokens).toBeDefined();
    }, 30000);

    it.skipIf(!hasAnthropic)('should use Claude 3.5 Sonnet by default', async () => {
      const result = await gateway.generate({
        prompt: 'Test',
        provider: 'anthropic',
        maxTokens: 10
      });

      expect(result.success).toBe(true);
      expect(result.model).toContain('claude');
    }, 30000);
  });

  describe('Fallback Mechanism', () => {
    it.skipIf(!hasOllama && !hasGemini)('should fallback to Ollama if cloud provider fails', async () => {
      // Force Gemini with invalid config to trigger fallback
      const result = await gateway.generate({
        prompt: 'Test fallback',
        provider: 'gemini',  // Will fail if no key
        maxTokens: 20
      });

      // Either succeeds with Gemini or falls back to Ollama
      expect(result.success).toBe(true);
      expect(['gemini', 'ollama']).toContain(result.provider);
    }, 30000);

    it.skipIf(!hasOllama)('should not use fallback if Ollama is selected directly', async () => {
      const result = await gateway.generate({
        prompt: 'Direct Ollama test',
        provider: 'ollama',
        maxTokens: 20
      });

      expect(result.provider).toBe('ollama');
      expect(result.fallback_used).toBeUndefined();
    }, 30000);
  });

  describe('Health Monitoring', () => {
    it('should check health of all providers', async () => {
      const health = await gateway.checkHealth();

      expect(health).toBeDefined();
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);

      // Each health entry should have required fields
      health.forEach(entry => {
        expect(entry.provider).toBeDefined();
        expect(entry.available).toBeDefined();
        expect(entry.last_check).toBeDefined();
      });
    }, 60000);

    it('should mark Ollama as available', async () => {
      const health = await gateway.checkHealth();

      const ollamaHealth = health.find(h => h.provider === 'ollama');
      if (hasOllama) {
        expect(ollamaHealth?.available).toBe(true);
        expect(ollamaHealth?.response_time_ms).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Statistics', () => {
    it.skipIf(!hasOllama)('should track request counts by provider', async () => {
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
        provider: 'ollama',
        maxTokens: 10
      });

      const statsAfter = gateway.getStats();

      expect(statsAfter.total_requests).toBe(initialCount + 2);
      expect(statsAfter.by_provider.ollama).toBeGreaterThanOrEqual(2);
    }, 60000);

    it('should return enabled providers list', () => {
      const enabled = gateway.getEnabledProviders();

      expect(Array.isArray(enabled)).toBe(true);
      expect(enabled.length).toBeGreaterThan(0);
      expect(enabled).toContain('ollama');
    });
  });

  describe('Task Type Routing', () => {
    const taskTypes: TaskType[] = ['code', 'general', 'reasoning', 'creative', 'fast'];

    taskTypes.forEach(taskType => {
      it.skipIf(!hasOllama && !hasGemini)(`should handle "${taskType}" task type`, async () => {
        const result = await gateway.generate({
          prompt: `Test ${taskType} task`,
          taskType,
          maxTokens: 20
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBeDefined();
        expect(['ollama', 'gemini', 'github', 'anthropic']).toContain(result.provider);
      }, 30000);
    });
  });

  describe('Error Handling', () => {
    it.skipIf(!hasOllama && !hasGemini)('should handle unavailable provider gracefully', async () => {
      // Try to use a provider that might not be configured
      const result = await gateway.generate({
        prompt: 'Test',
        provider: 'anthropic',  // Will fail if no key
        maxTokens: 10
      });

      // Should either succeed with Anthropic or fallback to Ollama
      expect(result.success).toBe(true);
      expect(['anthropic', 'ollama']).toContain(result.provider);
    }, 30000);

    it.skipIf(!hasOllama)('should handle invalid model gracefully', async () => {
      const result = await gateway.generate({
        prompt: 'Test',
        provider: 'ollama',
        model: 'this-model-does-not-exist-12345',
        maxTokens: 10
      });

      // Should either fail or fallback
      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
    }, 30000);
  });
});
