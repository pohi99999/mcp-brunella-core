/**
 * AI Gateway Wrapper (v3.0 - Pure Fetch API)
 *
 * Cloudflare AI Gateway + Workers AI integráció.
 * OpenAI SDK NÉLKÜL - egyszerű fetch API.
 *
 * Routing:
 * - AI_GATEWAY_ENABLED=true → CF Workers AI (llama-3.1)
 * - AI_GATEWAY_ENABLED=false → Local Ollama
 *
 * @author Brunella Core Team
 * @version 3.0.0
 */

import { logInfo, logError, logWarn } from "./logger.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_GATEWAY_ENABLED = process.env.AI_GATEWAY_ENABLED === "true";
const CF_ACCOUNT_ID =
  process.env.CF_ACCOUNT_ID || "dd107933ac970dac857f27cee7a7ff46";
const CF_GATEWAY_ID = process.env.CF_GATEWAY_ID || "brunella-gateway";
const CF_API_TOKEN = process.env.CF_AI_API_TOKEN || process.env.CF_API_TOKEN || process.env.CF_TOKEN;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const OLLAMA_EMBEDDING_TIMEOUT_MS = parseInt(process.env.OLLAMA_EMBEDDING_TIMEOUT_MS || process.env.EMBEDDING_TIMEOUT_MS || "15000", 10);
const CF_MODEL = process.env.CF_MODEL || "@cf/meta/llama-3.1-8b-instruct";
const CF_EMBEDDING_MODEL = process.env.CF_EMBEDDING_MODEL || "@cf/baai/bge-large-en-v1.5";

// ============================================================================
// TYPES
// ============================================================================

export interface AIGatewayConfig {
  enabled: boolean;
  cfAccountId: string;
  cfGatewayId: string;
  cfApiToken?: string;
  cfGlobalApiKey?: string;
  cfEmail?: string;
  cfModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export interface AIGatewayStats {
  totalRequests: number;
  cfRequests: number;
  ollamaRequests: number;
  errors: number;
  averageLatency: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ============================================================================
// AI GATEWAY CLIENT (Pure Fetch)
// ============================================================================

export class AIGatewayClient {
  private config: AIGatewayConfig;
  private stats: AIGatewayStats;

  constructor(config?: Partial<AIGatewayConfig>) {
    this.config = {
      enabled: config?.enabled ?? AI_GATEWAY_ENABLED,
      cfAccountId: config?.cfAccountId || CF_ACCOUNT_ID,
      cfGatewayId: config?.cfGatewayId || CF_GATEWAY_ID,
      cfApiToken: config?.cfApiToken || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
      cfGlobalApiKey: config?.cfGlobalApiKey || process.env.CF_GLOBAL_API_KEY || process.env.CLOUDFLARE_GLOBAL_API_KEY,
      cfEmail: config?.cfEmail || process.env.CF_EMAIL || process.env.CLOUDFLARE_EMAIL,
      cfModel: config?.cfModel || CF_MODEL,
      ollamaBaseUrl: config?.ollamaBaseUrl || OLLAMA_BASE_URL,
      ollamaModel: config?.ollamaModel || OLLAMA_MODEL,
    };

    this.stats = {
      totalRequests: 0,
      cfRequests: 0,
      ollamaRequests: 0,
      errors: 0,
      averageLatency: 0,
    };

    // Validate CF config
    if (this.config.enabled && !this.config.cfApiToken) {
      logError("AIGateway", "CF_API_TOKEN missing! Falling back to Ollama.");
      this.config.enabled = false;
    }

    const mode = this.config.enabled
      ? `CF Workers AI (${this.config.cfModel})`
      : `Ollama (${this.config.ollamaModel})`;
    logInfo("AIGateway", `✅ AI Gateway v3.0 initialized: ${mode}`);
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Chat completion (routing: CF Workers AI or Ollama)
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      forceLocal?: boolean;
    },
  ): Promise<string> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Force local Ollama if requested
      if (options?.forceLocal || !this.config.enabled) {
        return await this.chatOllama(messages, options);
      }

      // Try CF Workers AI first
      try {
        return await this.callCFWorkerModel(options?.model || this.config.cfModel, messages, options);
      } catch (cfError) {
        logError("AIGateway", `CF failed, falling back to Ollama: ${cfError}`);
        return await this.chatOllama(messages, options);
      }
    } finally {
      this.updateLatency(Date.now() - startTime);
    }
  }

  /**
   * Simple generate (single prompt → response)
   */
  async generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      forceLocal?: boolean;
    },
  ): Promise<string> {
    return this.chat([{ role: "user", content: prompt }], options);
  }

  /**
   * Generate embeddings (routing: CF Workers AI or Ollama)
   */
  async embeddings(
    text: string,
    options?: { model?: string; expectedDimension?: number; forceLocal?: boolean },
  ): Promise<number[]> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const expectedDimension = options?.expectedDimension ?? 768;
    const useCF = this.config.enabled && !options?.forceLocal;

    try {
      if (useCF) {
        let model = options?.model || CF_EMBEDDING_MODEL;
        
        // Intelligent mapping: if using CF but got an Ollama model name, use CF default
        if (!model.startsWith('@cf/') && (model.includes('nomic') || model.includes('mxbai') || model.includes('llama'))) {
          logInfo("AIGateway", `Mapping Ollama model '${model}' to CF model '${CF_EMBEDDING_MODEL}'`);
          model = CF_EMBEDDING_MODEL;
        }
        
        // AI Gateway requires API Token (Bearer). Direct API supports Global Key.
        const useDirectApi = Boolean(this.config.cfGlobalApiKey && this.config.cfEmail);
        const url = useDirectApi
          ? `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/${model}`
          : `https://gateway.ai.cloudflare.com/v1/${this.config.cfAccountId}/${this.config.cfGatewayId}/workers-ai/${model}`;

        const response = await fetch(url, {
          method: "POST",
          headers: this.getCFHeaders(),
          signal: AbortSignal.timeout(OLLAMA_EMBEDDING_TIMEOUT_MS),
          body: JSON.stringify({
            text: [text.slice(0, 8000)],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logWarn("AIGateway", `CF embeddings failed (${response.status}), falling back to Ollama: ${errorText}`);
          return await this.embeddingsOllama(text, options);
        }

        const data = (await response.json()) as { result?: { data?: number[][] } };
        const vector = data.result?.data?.[0];
        
        if (!vector) throw new Error("Empty embedding in CF response");
        
        this.stats.cfRequests++;
        this.updateLatency(Date.now() - startTime);
        return vector;
      } else {
        return await this.embeddingsOllama(text, options);
      }
    } catch (error) {
      this.stats.errors++;
      logError("AIGateway", `Embeddings failed: ${error}`);
      return new Array(expectedDimension).fill(0); // Zero vector fallback
    }
  }

  private async embeddingsOllama(
    text: string,
    options?: { model?: string; expectedDimension?: number },
  ): Promise<number[]> {
    const startTime = Date.now();
    this.stats.ollamaRequests++;
    const expectedDimension = options?.expectedDimension ?? 768;

    try {
      const url = `${this.config.ollamaBaseUrl}/api/embeddings`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(OLLAMA_EMBEDDING_TIMEOUT_MS),
        body: JSON.stringify({
          model: options?.model || "nomic-embed-text",
          prompt: text.slice(0, 8000),
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${response.status}`);
      }

      const data = (await response.json()) as { embedding?: number[] };
      this.updateLatency(Date.now() - startTime);

      return data.embedding || new Array(expectedDimension).fill(0);
    } catch (error) {
      throw error;
    }
  }

  /**
   * List models (Ollama only)
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }

  // ========================================================================
  // CF WORKERS AI
  // ========================================================================

  private getCFHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.cfGlobalApiKey && this.config.cfEmail) {
      headers["X-Auth-Key"] = this.config.cfGlobalApiKey;
      headers["X-Auth-Email"] = this.config.cfEmail;
    } else if (this.config.cfApiToken) {
      headers["Authorization"] = `Bearer ${this.config.cfApiToken}`;
    }

    return headers;
  }

  /**
   * Call CF Workers AI with a specific model (public — used by BifrostGateway and ModelRouter).
   * Falls back to config.cfModel if model is empty.
   */
  async callCFWorkerModel(
    model: string,
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    this.stats.cfRequests++;

    const resolvedModel = model || this.config.cfModel;
    
    // AI Gateway requires API Token (Bearer). Direct API supports Global Key.
    const useDirectApi = Boolean(this.config.cfGlobalApiKey && this.config.cfEmail);
    const url = useDirectApi
      ? `https://api.cloudflare.com/client/v4/accounts/${this.config.cfAccountId}/ai/run/${model}`
      : `https://gateway.ai.cloudflare.com/v1/${this.config.cfAccountId}/${this.config.cfGatewayId}/workers-ai/${model}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.getCFHeaders(),
      body: JSON.stringify({
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CF Workers AI error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      result?: { response?: string };
      response?: string;
    };

    // CF Workers AI response format
    const content = data.result?.response || data.response;
    if (!content) {
      throw new Error("Empty response from CF Workers AI");
    }

    logInfo("AIGateway", `CF response received (${resolvedModel})`);
    return content;
  }

  // ========================================================================
  // LOCAL OLLAMA
  // ========================================================================

  private async chatOllama(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number; forceLocal?: boolean },
  ): Promise<string> {
    this.stats.ollamaRequests++;

    const model = options?.model || this.config.ollamaModel;
    const url = `${this.config.ollamaBaseUrl}/api/chat`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content;

    if (!content) {
      throw new Error("Empty response from Ollama");
    }

    return content;
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private updateLatency(latency: number): void {
    if (this.stats.averageLatency === 0) {
      this.stats.averageLatency = latency;
    } else {
      this.stats.averageLatency =
        this.stats.averageLatency * 0.9 + latency * 0.1;
    }
  }

  isUsingGateway(): boolean {
    return this.config.enabled;
  }

  getConfig(): AIGatewayConfig {
    return { ...this.config };
  }

  getStats(): AIGatewayStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cfRequests: 0,
      ollamaRequests: 0,
      errors: 0,
      averageLatency: 0,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Lazy singleton: do NOT instantiate AIGatewayClient at module import time.
// Some CLIs import many modules; creating the client eagerly pollutes help output
// with initialization logs. We use a Proxy to lazily construct the real client
// only when a method/property is first accessed.

let _aiGatewayInstance: AIGatewayClient | null = null;
function ensureAiGateway(): AIGatewayClient {
  if (!_aiGatewayInstance) _aiGatewayInstance = new AIGatewayClient();
  return _aiGatewayInstance;
}

export const aiGateway: AIGatewayClient = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      const inst = ensureAiGateway();
      const value = (inst as any)[prop];
      if (typeof value === "function") return value.bind(inst);
      return value;
    },
    set(_target, prop: string | symbol, val: unknown) {
      const inst = ensureAiGateway();
      (inst as any)[prop] = val;
      return true;
    },
    has(_target, prop: string | symbol) {
      const inst = ensureAiGateway();
      return prop in inst;
    },
  },
) as unknown as AIGatewayClient;

// ============================================================================
// HELPER FUNCTIONS (backward compatible)
// ============================================================================

export async function llmChat(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  return ensureAiGateway().chat(messages, options);
}

export async function llmGenerate(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<string> {
  return ensureAiGateway().generate(prompt, options);
}

export async function llmEmbeddings(
  text: string,
  options?: { model?: string; expectedDimension?: number },
): Promise<number[]> {
  return ensureAiGateway().embeddings(text, options);
}

export function getAIGatewayStats(): AIGatewayStats {
  return ensureAiGateway().getStats();
}

export function isUsingCFGateway(): boolean {
  return ensureAiGateway().isUsingGateway();
}
