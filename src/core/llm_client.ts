// FILE: src/core/llm_client.ts
// PURPOSE: Multi-provider kliens implementálása LangSmith tracing-gel.
// UPDATED: G3.1 — Model Router integráció

import { GoogleGenerativeAI } from "@google/generative-ai";
import { traceable } from "langsmith/traceable";
import { logInfo, logError } from "../utils/logger.js";
import { routeTask, type RoutingDecision, type ProviderName } from './modelRouter.js';

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '120000'); // 2 minutes default

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Poliglott generálási metódus, amely támogatja a helyi (Ollama) és felhő (Gemini) modelleket.
 * Automatikus fallback mechanizmussal rendelkezik.
 * 
 * @param prompt - A generálási prompt
 * @param provider - A szolgáltató neve ('ollama' vagy 'gemini')
 * @param modelName - Opcionális: egyedi modell név felülíráshoz
 */
export const generateResponse: (prompt: string, provider?: string, modelName?: string) => Promise<string> = traceable(async (prompt: string, provider: string = 'ollama', modelName?: string): Promise<string> => {
    let lastError: Error | null = null;

    try {
        if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY not configured');
            }
            const model = genAI.getGenerativeModel({ model: modelName || GEMINI_MODEL });
            const result = await model.generateContent(prompt);
            return result.response.text();
        }

        if (provider === 'github') {
            const apiKey = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
            if (!apiKey) {
                throw new Error('GITHUB_TOKEN or GITHUB_PAT not configured');
            }

            const model = modelName || 'gpt-4o';
            const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "You are a helpful AI assistant." },
                        { role: "user", content: prompt }
                    ],
                    model: model,
                    temperature: 0.7,
                    max_tokens: 4096,
                    top_p: 1.0
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub Models API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
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
                body: JSON.stringify({ model: modelName || OLLAMA_MODEL, prompt, stream: false }),
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
                const fallbackResponse = await generateResponse(prompt, 'ollama', modelName);
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

// Alias for backward compatibility and clarity
export const chatWithOllama = (prompt: string, modelName?: string) => generateResponse(prompt, 'ollama', modelName);

/**
 * Routed generation — automatically selects the best model based on task description.
 * Uses the Model Router (G3) to pick brain/muscle model.
 * Falls back to Ollama if the selected cloud model fails (RULE-MR4).
 * 
 * @param prompt - The generation prompt
 * @param taskDescription - Natural language description for routing (if different from prompt)
 * @param routerConfig - Optional router configuration overrides
 * @returns The generated response string
 */
export async function generateRouted(
  prompt: string,
  taskDescription?: string,
  routerConfig?: Record<string, unknown>
): Promise<{ response: string; decision: RoutingDecision }> {
  const decision = routeTask(taskDescription || prompt, routerConfig);

  logInfo('LLM_CLIENT', `Routed → ${decision.model.name} (${decision.model.provider}) — ${decision.reason}`);

  try {
    const response = await generateResponse(prompt, decision.model.provider, decision.model.name);
    return { response, decision };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError('LLM_CLIENT', `Routed model (${decision.model.name}) failed: ${errorMsg}`);

    // RULE-MR4: Fallback to Ollama if we have a fallback defined
    if (decision.fallback && decision.model.provider !== 'ollama') {
      logInfo('LLM_CLIENT', `[MR4] Falling back to ${decision.fallback.name}`);
      const fallbackResponse = await generateResponse(prompt, decision.fallback.provider, decision.fallback.name);
      return {
        response: fallbackResponse,
        decision: {
          ...decision,
          reason: `${decision.reason} [FALLBACK: ${decision.fallback.name}]`
        }
      };
    }

    throw error;
  }
}
