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

import { logInfo, logError } from './logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_GATEWAY_ENABLED = process.env.AI_GATEWAY_ENABLED === 'true';
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'dd107933ac970dac857f27cee7a7ff46';
const CF_GATEWAY_ID = process.env.CF_GATEWAY_ID || 'brunella-gateway';
const CF_API_TOKEN = process.env.CF_API_TOKEN || process.env.CF_TOKEN;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const CF_MODEL = process.env.CF_MODEL || '@cf/meta/llama-3.1-8b-instruct';

// ============================================================================
// TYPES
// ============================================================================

export interface AIGatewayConfig {
    enabled: boolean;
    cfAccountId: string;
    cfGatewayId: string;
    cfApiToken?: string;
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
    role: 'user' | 'assistant' | 'system';
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
            cfApiToken: config?.cfApiToken !== undefined ? config.cfApiToken : CF_API_TOKEN,
            cfModel: config?.cfModel || CF_MODEL,
            ollamaBaseUrl: config?.ollamaBaseUrl || OLLAMA_BASE_URL,
            ollamaModel: config?.ollamaModel || OLLAMA_MODEL
        };

        this.stats = {
            totalRequests: 0,
            cfRequests: 0,
            ollamaRequests: 0,
            errors: 0,
            averageLatency: 0
        };

        // Validate CF config
        if (this.config.enabled && !this.config.cfApiToken) {
            logError('AIGateway', 'CF_API_TOKEN missing! Falling back to Ollama.');
            this.config.enabled = false;
        }

        const mode = this.config.enabled ? `CF Workers AI (${this.config.cfModel})` : `Ollama (${this.config.ollamaModel})`;
        logInfo('AIGateway', `✅ AI Gateway v3.0 initialized: ${mode}`);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Chat completion (routing: CF Workers AI or Ollama)
     */
    async chat(messages: ChatMessage[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        forceLocal?: boolean;
    }): Promise<string> {
        const startTime = Date.now();
        this.stats.totalRequests++;

        try {
            // Force local Ollama if requested
            if (options?.forceLocal || !this.config.enabled) {
                return await this.chatOllama(messages, options);
            }

            // Try CF Workers AI first
            try {
                return await this.chatCloudflare(messages, options);
            } catch (cfError) {
                logError('AIGateway', `CF failed, falling back to Ollama: ${cfError}`);
                return await this.chatOllama(messages, options);
            }
        } finally {
            this.updateLatency(Date.now() - startTime);
        }
    }

    /**
     * Simple generate (single prompt → response)
     */
    async generate(prompt: string, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        forceLocal?: boolean;
    }): Promise<string> {
        return this.chat([{ role: 'user', content: prompt }], options);
    }

    /**
     * Generate embeddings (always Ollama - CF doesn't expose embeddings directly)
     */
    async embeddings(text: string, options?: { model?: string }): Promise<number[]> {
        const startTime = Date.now();
        this.stats.totalRequests++;
        this.stats.ollamaRequests++;

        try {
            const url = `${this.config.ollamaBaseUrl}/api/embeddings`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options?.model || 'nomic-embed-text',
                    prompt: text.slice(0, 8000)
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama embeddings error: ${response.status}`);
            }

            const data = await response.json() as { embedding?: number[] };
            this.updateLatency(Date.now() - startTime);

            return data.embedding || new Array(768).fill(0);
        } catch (error) {
            this.stats.errors++;
            logError('AIGateway', `Embeddings failed: ${error}`);
            return new Array(768).fill(0); // Zero vector fallback
        }
    }

    /**
     * List models (Ollama only)
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json() as { models?: Array<{ name: string }> };
            return data.models?.map(m => m.name) || [];
        } catch {
            return [];
        }
    }

    // ========================================================================
    // CF WORKERS AI
    // ========================================================================

    private async chatCloudflare(messages: ChatMessage[], options?: any): Promise<string> {
        this.stats.cfRequests++;

        const model = options?.model || this.config.cfModel;
        const url = `https://gateway.ai.cloudflare.com/v1/${this.config.cfAccountId}/${this.config.cfGatewayId}/workers-ai/${model}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.cfApiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 2048
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`CF Workers AI error ${response.status}: ${errorText}`);
        }

        const data = await response.json() as { result?: { response?: string }; response?: string };
        
        // CF Workers AI response format
        const content = data.result?.response || data.response;
        if (!content) {
            throw new Error('Empty response from CF Workers AI');
        }

        logInfo('AIGateway', `CF response received (${model})`);
        return content;
    }

    // ========================================================================
    // LOCAL OLLAMA
    // ========================================================================

    private async chatOllama(messages: ChatMessage[], options?: any): Promise<string> {
        this.stats.ollamaRequests++;

        const model = options?.model || this.config.ollamaModel;
        const url = `${this.config.ollamaBaseUrl}/api/chat`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.7,
                    num_predict: options?.maxTokens ?? 2048
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json() as { message?: { content?: string } };
        const content = data.message?.content;

        if (!content) {
            throw new Error('Empty response from Ollama');
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
            this.stats.averageLatency = this.stats.averageLatency * 0.9 + latency * 0.1;
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
            averageLatency: 0
        };
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const aiGateway = new AIGatewayClient();

// ============================================================================
// HELPER FUNCTIONS (backward compatible)
// ============================================================================

export async function llmChat(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
    return aiGateway.chat(messages, options);
}

export async function llmGenerate(
    prompt: string,
    options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
    return aiGateway.generate(prompt, options);
}

export async function llmEmbeddings(
    text: string,
    options?: { model?: string }
): Promise<number[]> {
    return aiGateway.embeddings(text, options);
}

export function getAIGatewayStats(): AIGatewayStats {
    return aiGateway.getStats();
}

export function isUsingCFGateway(): boolean {
    return aiGateway.isUsingGateway();
}
