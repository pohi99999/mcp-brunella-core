/**
 * PAIOS Unified Configuration System
 * 
 * Zod-validated YAML configuration for all PAIOS-specific settings.
 * Replaces scattered config from .env, registry.json, and hardcoded values.
 * 
 * @track paios_unified_config_20260223
 */

import { z } from 'zod';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { logError, logInfo, logWarn } from '@packages/utils/logger.js';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const ProviderSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string(),
  api_key_env: z.string().optional(),
  base_url_env: z.string().optional(),
  gateway_url_env: z.string().optional(),
  fallback_models: z.array(z.string()).optional(),
});

const PaiosVoiceSchema = z.object({
  response_voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).default('nova'),
  tts_model: z.enum(['tts-1', 'tts-1-hd']).default('tts-1'),
  speed: z.number().min(0.25).max(4).default(1),
});

export const OrchestrationConcurrencySchema = z.object({
  profile: z.enum(['balanced', 'aggressive', 'conservative']).default('balanced'),
  max_concurrent_tasks: z.number().int().min(1).max(10).default(3),
});

export const PAIOSConfigSchema = z.object({
  orchestrator: z.object({
    default_model: z.enum(['github', 'gemini', 'local', 'anthropic', 'cloudflare', 'copilot']).default('github'),
    system_prompt_path: z.string().optional(),
    max_tasks_per_request: z.number().int().min(1).max(20).default(5),
    concurrency: OrchestrationConcurrencySchema.default({
      profile: 'balanced',
      max_concurrent_tasks: 3,
    }),
  }),
  providers: z.object({
    github: ProviderSchema.optional(),
    gemini: ProviderSchema.optional(),
    local: ProviderSchema.optional(),
    anthropic: ProviderSchema.optional(),
    cloudflare: ProviderSchema.optional(),
    copilot: ProviderSchema.optional(),
  }),
  phoenix: z.object({
    retry_max_attempts: z.number().int().min(1).max(10).default(3),
    retry_base_delay_ms: z.number().int().min(100).max(10000).default(1000),
    checkpoint_interval_ms: z.number().int().min(5000).max(300000).default(30000),
    heartbeat_interval_ms: z.number().int().min(1000).max(60000).default(5000),
  }).optional(),
  dashboard: z.object({
    base_url: z.string().url().default('http://localhost:5173'),
    chat_panel_enabled: z.boolean().default(true),
    phoenix_events_enabled: z.boolean().default(true),
    model_selector_enabled: z.boolean().default(true),
  }).optional(),
  voice: PaiosVoiceSchema.default({
    response_voice: 'nova',
    tts_model: 'tts-1',
    speed: 1,
  }),
});

export type PAIOSConfig = z.infer<typeof PAIOSConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderSchema>;
export type ModelProvider = 'github' | 'gemini' | 'local' | 'anthropic' | 'cloudflare' | 'copilot';
export type OrchestrationConcurrency = z.infer<typeof OrchestrationConcurrencySchema>;

// ============================================================================
// CONFIG LOADER
// ============================================================================

let cachedConfig: PAIOSConfig | null = null;

/**
 * Load and validate PAIOS configuration from YAML file.
 * Falls back to sensible defaults if file doesn't exist.
 */
export function loadPaiosConfig(configPath = 'paios.config.yaml'): PAIOSConfig {
  // Return cached config if already loaded
  if (cachedConfig) {
    return cachedConfig;
  }

  const fullPath = path.resolve(process.cwd(), configPath);

  // If config file doesn't exist, use .env fallback
  if (!fs.existsSync(fullPath)) {
    logWarn('PAIOS Config', `File not found: ${fullPath} - using .env fallback`);
    
    const fallbackConfig = {
      orchestrator: {
        default_model: (process.env.PAIOS_DEFAULT_MODEL as ModelProvider) ?? 'github',
        system_prompt_path: process.env.PAIOS_SYSTEM_PROMPT_PATH,
        max_tasks_per_request: 5,
        concurrency: {
          profile: 'balanced',
          max_concurrent_tasks: 3,
        },
      },
      providers: {
        local: {
          enabled: true,
          model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
          base_url_env: 'OLLAMA_BASE_URL',
        },
        gemini: {
          enabled: !!process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-exp',
          api_key_env: 'GEMINI_API_KEY',
        },
      },
      voice: {
        response_voice: 'nova',
        tts_model: 'tts-1',
        speed: 1,
      },
    };

    cachedConfig = PAIOSConfigSchema.parse(fallbackConfig);
    return cachedConfig;
  }

  try {
    // Read and parse YAML
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const rawConfig = yaml.load(fileContent) as unknown;

    // Validate with Zod
    cachedConfig = PAIOSConfigSchema.parse(rawConfig);
    
    logInfo('PAIOS Config', `Loaded from ${fullPath}`);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logError('PAIOS Config', `Validation failed: ${JSON.stringify(error.issues)}`);
      throw new Error(`PAIOS config validation failed: ${error.issues.map((issue) => issue.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Get a specific provider configuration.
 * Returns undefined if provider is not configured or disabled.
 */
export function getProviderConfig(provider: ModelProvider): ProviderConfig | undefined {
  const config = loadPaiosConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig || !providerConfig.enabled) {
    return undefined;
  }

  return providerConfig;
}

/**
 * Get the API key for a provider from environment variables.
 */
export function getProviderApiKey(provider: ModelProvider): string | undefined {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig || !providerConfig.api_key_env) {
    return undefined;
  }

  return process.env[providerConfig.api_key_env];
}

/**
 * Get the base URL for a provider from environment variables.
 */
export function getProviderBaseUrl(provider: ModelProvider): string | undefined {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig || !providerConfig.base_url_env) {
    return undefined;
  }

  return process.env[providerConfig.base_url_env];
}

/**
 * Clear cached config (useful for tests or hot reload).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get list of enabled providers.
 */
export function getEnabledProviders(): ModelProvider[] {
  const config = loadPaiosConfig();
  const providers: ModelProvider[] = [];

  for (const [key, value] of Object.entries(config.providers)) {
    if (value && value.enabled) {
      providers.push(key as ModelProvider);
    }
  }

  return providers;
}

/**
 * Get the current orchestration concurrency profile.
 */
export function getOrchestrationConcurrencyConfig(): OrchestrationConcurrency {
  return loadPaiosConfig().orchestrator.concurrency;
}

/**
 * Get the current max concurrent task limit for subagent execution.
 */
export function getOrchestrationConcurrencyLimit(): number {
  return getOrchestrationConcurrencyConfig().max_concurrent_tasks;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default loadPaiosConfig;

