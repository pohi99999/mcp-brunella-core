// FILE: src/core/llm_client.ts
// PURPOSE: Multi-provider kliens implementálása LangSmith tracing-gel.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { execSync } from "child_process";
import { traceable } from "langsmith/traceable";
import { logInfo, logError } from "../utils/logger.js";

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '120000'); // 2 minutes default

// Default LLM provider (agents read this)
const DEFAULT_LLM_PROVIDER = process.env.LLM_PROVIDER || 'github';

// GitHub Models configuration
const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';
const GITHUB_MODELS_DEFAULT_MODEL = process.env.GITHUB_MODELS_DEFAULT_MODEL || 'gpt-4o';

// GitHub token cache (5 min TTL)
let _ghTokenCache: { token: string; expires: number } | null = null;

function getGitHubToken(): string {
    // 1. Explicit env var
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    // 2. PAT fallback env var
    if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) return process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    // 3. gh auth token (cached 5 min)
    if (_ghTokenCache && Date.now() < _ghTokenCache.expires) return _ghTokenCache.token;
    try {
        const token = execSync('gh auth token', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (!token) throw new Error('gh auth token returned empty');
        _ghTokenCache = { token, expires: Date.now() + 5 * 60 * 1000 };
        return token;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`GitHub token not available. Set GITHUB_TOKEN env var or run 'gh auth login'. (${msg})`);
    }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Poliglott generálási metódus, amely támogatja a helyi (Ollama) és felhő (Gemini) modelleket.
 * Automatikus fallback mechanizmussal rendelkezik.
 */
export const generateResponse: (prompt: string, provider?: string, options?: { model?: string; system?: string }) => Promise<string> = traceable(async (prompt: string, provider: string = 'ollama', options?: { model?: string; system?: string }): Promise<string> => {
    let lastError: Error | null = null;

    try {
        if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY not configured');
            }
            const geminiModelName = options?.model || GEMINI_MODEL;
            const systemPrompt = options?.system;
            const modelConfig: any = { model: geminiModelName };
            if (systemPrompt) {
                modelConfig.systemInstruction = systemPrompt;
            }
            const model = genAI.getGenerativeModel(modelConfig);
            const result = await model.generateContent(prompt);
            return result.response.text();
        }

        if (provider === 'github') {
            const token = getGitHubToken();
            const ghModel = (options as any)?.model || GITHUB_MODELS_DEFAULT_MODEL;
            const systemPrompt = (options as any)?.system;
            const messages: Array<{ role: string; content: string }> = [];
            if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
            messages.push({ role: 'user', content: prompt });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
            try {
                const response = await fetch(`${GITHUB_MODELS_BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ model: ghModel, messages }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errBody = await response.text().catch(() => '');
                    throw new Error(`GitHub Models HTTP ${response.status}: ${errBody || response.statusText}`);
                }
                const data: any = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (!content) throw new Error('GitHub Models returned empty response');
                return content;
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error(`GitHub Models timeout after ${LLM_TIMEOUT_MS}ms`);
                }
                throw fetchError;
            }
        }

        // Default: Ollama (Helyi)
        if (!OLLAMA_BASE_URL || OLLAMA_BASE_URL === 'undefined') {
            throw new Error('OLLAMA_BASE_URL not configured');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama HTTP error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.response) {
                throw new Error('No response from Ollama - empty response body');
            }
            return data.response;
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error(`Ollama timeout after ${LLM_TIMEOUT_MS}ms`);
            }
            throw fetchError;
        }

    } catch (error: any) {
        lastError = error;
        logError("LLM_CLIENT", `Hiba a(z) ${provider} szolgáltatónál: ${error.message}`);

        // Fallback: if not already using Ollama, try Ollama as fallback
        if (provider !== 'ollama') {
            logInfo("LLM_CLIENT", "Fallback indítása Ollama-ra...");
            try {
                const fallbackResponse = await generateResponse(prompt, 'ollama');
                return fallbackResponse;
            } catch (fallbackError: any) {
                logError("LLM_CLIENT", `Ollama fallback is sikertelen: ${fallbackError.message}`);
                // Throw original error, not the fallback error
                throw lastError;
            }
        }

        throw error;
    }
}, { name: "MultiProvider_Generate", run_type: "llm" });

/**
 * Backwards-compatible chat function for Ollama.
 * @param prompt User prompt
 * @param system System prompt (prepended to user prompt if provided)
 * @param model Model name (used for logging, actual model comes from env)
 */
export async function chatWithOllama(
    prompt: string,
    system?: string,
    model?: string
): Promise<string> {
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    logInfo("LLM_CLIENT", `chatWithOllama called with model hint: ${model || OLLAMA_MODEL}`);
    return generateResponse(fullPrompt, 'ollama');
}

/**
 * Generate text using GitHub Models (OpenAI-compatible API).
 */
export async function generateWithGithubModels(
    prompt: string,
    model?: string,
    system?: string
): Promise<string> {
    logInfo("LLM_CLIENT", `generateWithGithubModels model=${model || GITHUB_MODELS_DEFAULT_MODEL}`);
    return generateResponse(prompt, 'github', { model, system });
}

/** Well-known GitHub Models available via Pro+ subscription */
const GITHUB_MODELS_CATALOG = [
    { name: 'gpt-4o', provider: 'OpenAI' },
    { name: 'gpt-4o-mini', provider: 'OpenAI' },
    { name: 'openai/o3-mini', provider: 'OpenAI' },
    { name: 'openai/o4-mini', provider: 'OpenAI' },
    { name: 'deepseek/DeepSeek-R1', provider: 'DeepSeek' },
    { name: 'meta/Llama-4-Scout-17B-16E-Instruct', provider: 'Meta' },
    { name: 'mistralai/Mistral-Small-3.1-24B-Instruct', provider: 'Mistral' },
    { name: 'xai/grok-3-mini', provider: 'xAI' },
    { name: 'cohere/cohere-command-a', provider: 'Cohere' },
];

/**
 * List available GitHub Models.
 * Returns the built-in catalog (API listing requires separate auth scope).
 */
export function listGithubModels(): Array<{ name: string; provider: string }> {
    return GITHUB_MODELS_CATALOG;
}

/**
 * Generate text using Google Gemini API.
 */
export async function generateWithGemini(
    prompt: string,
    model?: string,
    system?: string
): Promise<string> {
    logInfo("LLM_CLIENT", `generateWithGemini model=${model || GEMINI_MODEL}`);
    return generateResponse(prompt, 'gemini', { model, system });
}

/** Available Gemini models */
const GEMINI_MODELS_CATALOG = [
    { name: 'gemini-2.5-pro-preview-06-05', provider: 'Google', tier: 'premium' },
    { name: 'gemini-2.5-flash-preview-05-20', provider: 'Google', tier: 'free' },
    { name: 'gemini-2.0-flash', provider: 'Google', tier: 'free' },
    { name: 'gemini-2.0-flash-lite', provider: 'Google', tier: 'free' },
    { name: 'gemini-1.5-pro', provider: 'Google', tier: 'free' },
    { name: 'gemini-1.5-flash', provider: 'Google', tier: 'free' },
];

/**
 * List available Gemini models.
 */
export function listGeminiModels(): Array<{ name: string; provider: string; tier: string }> {
    return GEMINI_MODELS_CATALOG;
}

/**
 * Returns the configured default LLM provider.
 * Set via LLM_PROVIDER env var. Default: 'github'.
 */
export function getDefaultProvider(): string {
    return DEFAULT_LLM_PROVIDER;
}

/**
 * Unified chat function that uses the configured default provider.
 * This is the recommended way for agents to call LLM.
 *
 * - LLM_PROVIDER=github → GPT-4.1 via GitHub Models API
 * - LLM_PROVIDER=gemini → Gemini
 * - LLM_PROVIDER=ollama → local Ollama (default)
 */
export async function chat(
    prompt: string,
    system?: string,
    model?: string,
    provider?: string
): Promise<string> {
    const selectedProvider = provider || DEFAULT_LLM_PROVIDER;
    logInfo("LLM_CLIENT", `chat() provider=${selectedProvider} model=${model || 'default'}`);

    if (selectedProvider === 'github') {
        return generateResponse(prompt, 'github', { model, system });
    }
    if (selectedProvider === 'gemini') {
        return generateResponse(prompt, 'gemini', { model, system });
    }
    // Default: ollama
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    return generateResponse(fullPrompt, 'ollama', { model });
}
