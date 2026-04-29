/**
 * paiosConfig.test.ts - Unit tests for PAIOS Unified Config System
 * 
 * Tests Zod validation, YAML loading, .env fallback, helper functions
 * 
 * @track paios_unified_config_20260223
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import yaml from 'js-yaml';
import type { PAIOSConfig, ModelProvider } from '@packages/utils/paiosConfig.js';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
}));

// Import after mocking
import {
  loadPaiosConfig,
  getProviderConfig,
  getProviderApiKey,
  getProviderBaseUrl,
  getEnabledProviders,
  clearConfigCache,
  PAIOSConfigSchema,
  getOrchestrationConcurrencyConfig,
  getOrchestrationConcurrencyLimit,
} from '@packages/utils/paiosConfig.js';

describe('paiosConfig', () => {
  beforeEach(() => {
    clearConfigCache();
    vi.resetAllMocks();
    // Clear process.env
    delete process.env.PAIOS_DEFAULT_MODEL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
  });

  afterEach(() => {
    clearConfigCache();
  });

  describe('loadPaiosConfig', () => {
    it('should load valid YAML config file', () => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'src/orchestrator/systemPrompt/paios_orchestrator_prompt.md',
          max_tasks_per_request: 5
        },
        voice: {
          response_voice: 'nova',
          tts_model: 'tts-1',
          speed: 1.0,
        },
        providers: {
          gemini: {
            enabled: true,
            model: 'gemini-2.0-flash-exp',
            api_key_env: 'GEMINI_API_KEY'
          },
          local: {
            enabled: true,
            model: 'qwen2.5-coder:7b',
            base_url_env: 'OLLAMA_BASE_URL'
          }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

      const config = loadPaiosConfig();

      expect(config).toBeDefined();
      expect(config.orchestrator.default_model).toBe('gemini');
      expect(config.voice.response_voice).toBe('nova');
      expect(config.providers.gemini?.enabled).toBe(true);
    });

    it('should use .env fallback when config file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      process.env.PAIOS_DEFAULT_MODEL = 'local';
      process.env.OLLAMA_MODEL = 'qwen2.5-coder:7b';

      const config = loadPaiosConfig();

      expect(config).toBeDefined();
      expect(config.orchestrator.default_model).toBe('local');
      expect(config.providers.local?.model).toBe('qwen2.5-coder:7b');
      expect(config.voice.response_voice).toBe('nova');
    });

    it('should cache config after first load', () => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: { enabled: true, model: 'test-model', api_key_env: 'TEST_KEY' }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

      // First load
      const config1 = loadPaiosConfig();
      
      // Second load (should use cache)
      const config2 = loadPaiosConfig();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(config1).toBe(config2);
    });

    it('should reject invalid default_model', () => {
      const invalidConfig = {
        orchestrator: {
          default_model: 'invalid_model',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {}
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(invalidConfig));

      expect(() => loadPaiosConfig()).toThrow();
    });

    it('should reject max_tasks_per_request > 20', () => {
      const invalidConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 25 // Too high
        },
        providers: {}
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(invalidConfig));

      expect(() => loadPaiosConfig()).toThrow();
    });

    it('should reject invalid voice speed', () => {
      const invalidConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5,
        },
        providers: {},
        voice: {
          response_voice: 'nova',
          tts_model: 'tts-1',
          speed: 5,
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(invalidConfig));

      expect(() => loadPaiosConfig()).toThrow();
    });
  });

  describe('getProviderConfig', () => {
    beforeEach(() => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: {
            enabled: true,
            model: 'gemini-2.0-flash-exp',
            api_key_env: 'GEMINI_API_KEY'
          },
          github: {
            enabled: false,
            model: 'gpt-4.1',
            api_key_env: 'GITHUB_PAT'
          },
          local: {
            enabled: true,
            model: 'qwen2.5-coder:7b',
            base_url_env: 'OLLAMA_BASE_URL'
          }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));
    });

    it('should return config for enabled provider', () => {
      const geminiConfig = getProviderConfig('gemini');
      
      expect(geminiConfig).toBeDefined();
      expect(geminiConfig?.enabled).toBe(true);
      expect(geminiConfig?.model).toBe('gemini-2.0-flash-exp');
    });

    it('should return undefined for disabled provider', () => {
      const githubConfig = getProviderConfig('github');
      
      expect(githubConfig).toBeUndefined();
    });

    it('should return undefined for non-existent provider', () => {
      const config = getProviderConfig('anthropic');
      
      expect(config).toBeUndefined();
    });
  });

  describe('getProviderApiKey', () => {
    beforeEach(() => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: {
            enabled: true,
            model: 'gemini-2.0-flash-exp',
            api_key_env: 'GEMINI_API_KEY'
          },
          local: {
            enabled: true,
            model: 'qwen2.5-coder:7b',
            base_url_env: 'OLLAMA_BASE_URL'
          }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));
    });

    it('should return API key from process.env', () => {
      process.env.GEMINI_API_KEY = 'test_gemini_key_12345';
      
      const apiKey = getProviderApiKey('gemini');
      
      expect(apiKey).toBe('test_gemini_key_12345');
    });

    it('should return undefined if env var not set', () => {
      const apiKey = getProviderApiKey('gemini');
      
      expect(apiKey).toBeUndefined();
    });

    it('should return undefined if provider has no api_key_env', () => {
      const apiKey = getProviderApiKey('local'); // Local has base_url_env, not api_key_env
      
      expect(apiKey).toBeUndefined();
    });
  });

  describe('getProviderBaseUrl', () => {
    beforeEach(() => {
      const mockConfig = {
        orchestrator: {
          default_model: 'local',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          local: {
            enabled: true,
            model: 'qwen2.5-coder:7b',
            base_url_env: 'OLLAMA_BASE_URL'
          }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));
    });

    it('should return base URL from process.env', () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      
      const baseUrl = getProviderBaseUrl('local');
      
      expect(baseUrl).toBe('http://localhost:11434');
    });

    it('should return undefined if env var not set', () => {
      const baseUrl = getProviderBaseUrl('local');
      
      expect(baseUrl).toBeUndefined();
    });
  });

  describe('getEnabledProviders', () => {
    it('should return list of enabled providers', () => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: { enabled: true, model: 'gemini-2.0-flash-exp', api_key_env: 'GEMINI_API_KEY' },
          github: { enabled: false, model: 'gpt-4.1', api_key_env: 'GITHUB_PAT' },
          local: { enabled: true, model: 'qwen2.5-coder:7b', base_url_env: 'OLLAMA_BASE_URL' },
          anthropic: { enabled: true, model: 'claude-sonnet-3-5', api_key_env: 'ANTHROPIC_API_KEY' }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

      const enabledProviders = getEnabledProviders();

      expect(enabledProviders).toEqual(['gemini', 'local', 'anthropic']);
      expect(enabledProviders).not.toContain('github');
    });

    it('should return empty array if no providers enabled', () => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: { enabled: false, model: 'gemini-2.0-flash-exp', api_key_env: 'GEMINI_API_KEY' },
          github: { enabled: false, model: 'gpt-4.1', api_key_env: 'GITHUB_PAT' }
        }
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

      const enabledProviders = getEnabledProviders();

      expect(enabledProviders).toEqual([]);
    });
  });

  describe('PAIOSConfigSchema', () => {
    it('should validate complete config', () => {
      const validConfig: PAIOSConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'src/orchestrator/systemPrompt/paios_orchestrator_prompt.md',
          max_tasks_per_request: 5
        },
        providers: {
          gemini: {
            enabled: true,
            model: 'gemini-2.0-flash-exp',
            api_key_env: 'GEMINI_API_KEY'
          }
        },
        phoenix: {
          retry_max_attempts: 3,
          retry_base_delay_ms: 1000,
          checkpoint_interval_ms: 30000,
          heartbeat_interval_ms: 5000
        },
        dashboard: {
          base_url: 'http://localhost:5173',
          chat_panel_enabled: true,
          phoenix_events_enabled: true,
          model_selector_enabled: true
        }
      };

      const result = PAIOSConfigSchema.safeParse(validConfig);

      expect(result.success).toBe(true);
    });

    it('should allow optional phoenix and dashboard sections', () => {
      const minimalConfig = {
        orchestrator: {
          default_model: 'local',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 3
        },
        providers: {}
      };

      const result = PAIOSConfigSchema.safeParse(minimalConfig);

      expect(result.success).toBe(true);
    });

    it('should enforce retry_max_attempts range (1-10)', () => {
      const invalidConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {},
        phoenix: {
          retry_max_attempts: 15, // Too high
          retry_base_delay_ms: 1000,
          checkpoint_interval_ms: 30000,
          heartbeat_interval_ms: 5000
        }
      };

      const result = PAIOSConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });

    it('should enforce valid URL for dashboard.base_url', () => {
      const invalidConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {},
        dashboard: {
          base_url: 'not-a-valid-url',
          chat_panel_enabled: true,
          phoenix_events_enabled: true,
          model_selector_enabled: true
        }
      };

      const result = PAIOSConfigSchema.safeParse(invalidConfig);

      expect(result.success).toBe(false);
    });
  });

  describe('clearConfigCache', () => {
    it('should clear cached config', () => {
      const mockConfig = {
        orchestrator: {
          default_model: 'gemini',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5
        },
        providers: {}
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

      // Load config (cached)
      loadPaiosConfig();
      
      // Clear cache
      clearConfigCache();
      
      // Load again (should read file again)
      loadPaiosConfig();

      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('orchestration concurrency', () => {
    beforeEach(() => {
      const mockConfig = {
        orchestrator: {
          default_model: 'github',
          system_prompt_path: 'test.md',
          max_tasks_per_request: 5,
          concurrency: {
            profile: 'balanced',
            max_concurrent_tasks: 3,
          },
        },
        providers: {},
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));
    });

    it('should expose the balanced default concurrency profile', () => {
      expect(getOrchestrationConcurrencyConfig()).toEqual({
        profile: 'balanced',
        max_concurrent_tasks: 3,
      });
      expect(getOrchestrationConcurrencyLimit()).toBe(3);
    });
  });
});
