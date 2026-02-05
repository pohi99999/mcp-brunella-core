// FILE: src/core/llm_client.ts
// PURPOSE: Multi-provider kliens implementálása LangSmith tracing-gel.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { traceable } from "langsmith/traceable";
import { logInfo, logError } from "../utils/logger.js";

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '120000'); // 2 minutes default

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Poliglott generálási metódus, amely támogatja a helyi (Ollama) és felhő (Gemini) modelleket.
 * Automatikus fallback mechanizmussal rendelkezik.
 */
export const generateResponse: (prompt: string, provider?: string) => Promise<string> = traceable(async (prompt: string, provider: string = 'ollama'): Promise<string> => {
    let lastError: Error | null = null;

    try {
        if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY not configured');
            }
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const result = await model.generateContent(prompt);
            return result.response.text();
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

export async function chatWithOllama(prompt: string, system?: string, model?: string) {
    return generateResponse(system ? `${system}\n\n${prompt}` : prompt, 'ollama');
}
