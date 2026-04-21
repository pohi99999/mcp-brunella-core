/**
 * Code Quality P5: Config Validation with Zod
 *
 * Validates all environment variables at startup, ensuring:
 * - Type safety (strings, numbers, URLs, enums)
 * - Sensible defaults for optional values
 * - Early error detection (fails fast on invalid config)
 *
 * @see conductor/tracks/code_quality_improvements_20260210/spec.md (P5)
 */

import { z } from 'zod';
import { writeLine } from './cliOutput.js';

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

export const ConfigSchema = z.object({
  // Server
  port: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // LLM Providers
  ollamaBaseUrl: z.string().url().default('http://localhost:11434'),
  ollamaModel: z.string().optional(),

  geminiApiKey: z.string().optional(),
  geminiModel: z.string().default('gemini-2.5-flash'),

  githubToken: z.string().optional(),
  githubPat: z.string().optional(), // Alternative to githubToken
  githubModel: z.string().default('gpt-4.1'),
  githubWebhookSecret: z.string().optional(),

  // Python Backend
  pythonBaseUrl: z.string().url().default('http://localhost:8000'),

  // External Services
  anythingllmApiKey: z.string().optional(),
  langchainApiKey: z.string().optional(), // LangSmith tracing

  // Workspace
  workspaceRoot: z.string().default(process.cwd()),
  dataDir: z.string().default('data'),
  systemLogDir: z.string().default('logs'),
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================================================
// PARSE & VALIDATE
// ============================================================================

/**
 * Parse and validate environment variables.
 * Throws ZodError if validation fails (with detailed error messages).
 */
function parseConfig(): Config {
  try {
    return ConfigSchema.parse({
      // Server
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,

      // LLM Providers
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
      ollamaModel: process.env.OLLAMA_MODEL,

      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiModel: process.env.GEMINI_MODEL,

      githubToken: process.env.GITHUB_TOKEN,
      githubPat: process.env.GITHUB_PAT,
      githubModel: process.env.GITHUB_MODEL,
      githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,

      // Python Backend (normalize PYTHON_SUBSET_URL to pythonBaseUrl)
      pythonBaseUrl: process.env.PYTHON_BASE_URL || process.env.PYTHON_SUBSET_URL,

      // External Services
      anythingllmApiKey: process.env.ANYTHINGLLM_API_KEY,
      langchainApiKey: process.env.LANGCHAIN_API_KEY,

      // Workspace
      workspaceRoot: process.env.BRUNELLA_WORKSPACE_ROOT,
      dataDir: process.env.BRUNELLA_DATA_DIR,
      systemLogDir: process.env.BRUNELLA_LOG_DIR || process.env.BRUNELLA_SYSTEM_LOG_DIR,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.issues.map(
        (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');

      throw new Error(
        `❌ Config Validation Failed:\n${formattedErrors}\n\n` +
        `Please check your .env file or environment variables.`
      );
    }
    throw error;
  }
}

// ============================================================================
// EXPORT VALIDATED CONFIG
// ============================================================================

/**
 * Validated configuration object.
 * Safe to use throughout the application.
 */
export const config = parseConfig();

// Log successful config load (development only)
if (config.nodeEnv === 'development') {
  writeLine('✅ Config validated successfully');
  writeLine(`   - Port: ${config.port}`);
  writeLine(`   - Ollama: ${config.ollamaBaseUrl}`);
  writeLine(`   - Python: ${config.pythonBaseUrl}`);
  writeLine(`   - Node Env: ${config.nodeEnv}`);
}

