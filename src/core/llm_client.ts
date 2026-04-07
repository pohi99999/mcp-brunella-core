// FILE: src/core/llm_client.ts
// PURPOSE: Multi-provider kliens implementálása LangSmith tracing-gel.
// UPDATED: G3.1 — Model Router integráció

import { GoogleGenAI } from "@google/genai";
import { traceable } from "langsmith/traceable";
import { logInfo, logError } from "../utils/logger.js";
import {
  routeTask,
  type RoutingDecision,
  type ProviderName,
} from "./modelRouter.js";
import { aiGateway } from "../utils/aiGateway.js";
import { recordLlmUsageAndCost } from "../utils/metrics.js";
import { bifrostGateway } from "./bifrost_gateway.js";

// Configuration
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "120000"); // 2 minutes default

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Poliglott generálási metódus, amely támogatja a helyi és felhő providereket.
 * Automatikus fallback mechanizmussal rendelkezik.
 *
 * @param prompt - A generálási prompt
 * @param provider - A szolgáltató neve ('ollama', 'gemini', 'github', 'anthropic', 'cloudflare', 'copilot')
 * @param modelName - Opcionális: egyedi modell név felülíráshoz
 */
export const generateResponse: (
  prompt: string,
  provider?: string,
  modelName?: string,
) => Promise<string> = traceable(
  async (
    prompt: string,
    provider: string = "ollama",
    modelName?: string,
  ): Promise<string> => {
    let lastError: Error | null;

    try {
      if (provider === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY not configured");
        }
        const systemInstruction = "Te vagy a BAS (Brunella Agent System) Specialistája. Beszélj folyékony magyarul. Válaszaid legyenek mérnöki pontosságúak.";
        const response = await genAI.models.generateContent({
          model: modelName || GEMINI_MODEL,
          contents: `${systemInstruction}\n\nKérés: ${prompt}`,
        });
        const text = response.text ?? '';
        recordLlmUsageAndCost({
          provider: "gemini",
          model: modelName || GEMINI_MODEL,
          prompt,
          completion: text,
        });
        return text;
      }

      if (provider === "github") {
        const apiKey = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
        if (!apiKey) {
          throw new Error("GH_TOKEN or GITHUB_TOKEN not configured");
        }

        const modelRaw = modelName || "gpt-4.1";
        const model = modelRaw.includes('/') ? modelRaw : `openai/${modelRaw}`;
        const response = await fetch(
          "https://models.github.ai/inference/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              messages: [
                { 
                  role: "system", 
                  content: "Te vagy a BAS (Brunella Agent System) Master Orchestrator. Beszélj kizárólag folyékony, professzionális magyar nyelven. Feladatod a komplex fejlesztési és üzleti folyamatok koordinálása a rendelkezésre álló ügynökök (Developer, Robotkez, Researcher, stb.) segítségével. Válaszaid legyenek tömörek, mérnöki szemléletűek és cselekvésorientáltak." 
                },
                { role: "user", content: prompt },
              ],
              model: model,
              temperature: 0.7,
              max_tokens: 4096,
              top_p: 1.0,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            `GitHub Models API error: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        const text = data.choices[0].message.content;
        recordLlmUsageAndCost({
          provider: "github",
          model,
          prompt,
          completion: text,
        });
        return text;
      }

      if (
        provider === "anthropic"
        || provider === "cloudflare"
        || provider === "copilot"
      ) {
        const response = await bifrostGateway.generate({
          prompt,
          provider,
          model: modelName,
          taskType: /code|test|refactor|debug|implement/i.test(prompt) ? "code" : "general",
        });

        if (!response.success || !response.content) {
          throw new Error(response.error || `${provider} generation failed`);
        }

        recordLlmUsageAndCost({
          provider,
          model: response.model || modelName || provider,
          prompt,
          completion: response.content,
        });
        return response.content;
      }

      // Default: Ollama / AI Gateway path

      const response = await aiGateway.generate(prompt, {
        model: modelName || OLLAMA_MODEL,
        temperature: 0.7,
        maxTokens: 4096,
      });

      recordLlmUsageAndCost({
        provider: provider || "ollama",
        model: modelName || OLLAMA_MODEL,
        prompt,
        completion: response,
      });

      return response;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(String(error));
      logError(
        "LLM_CLIENT",
        `Hiba a(z) ${provider} szolgáltatónál: ${errorMsg}`,
      );

      // Fallback: prefer Gemini 2.0 Flash if Ollama is unavailable
      if (provider === "ollama" && process.env.GEMINI_API_KEY) {
        logInfo("LLM_CLIENT", "Ollama hiba → fallback Gemini 2.0 Flash...");
        try {
          const fallbackResponse = await generateResponse(
            prompt,
            "gemini",
            GEMINI_MODEL,
          );
          return fallbackResponse;
        } catch (fallbackError: unknown) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          logError(
            "LLM_CLIENT",
            `Gemini fallback is sikertelen: ${fallbackMsg}`,
          );
          throw lastError;
        }
      }

      // Fallback: if not already using Ollama, try Ollama
      if (provider !== "ollama") {
        logInfo("LLM_CLIENT", "Fallback indítása Ollama-ra...");
        try {
          const fallbackResponse = await generateResponse(
            prompt,
            "ollama",
            modelName,
          );
          return fallbackResponse;
        } catch (fallbackError: unknown) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          logError(
            "LLM_CLIENT",
            `Ollama fallback is sikertelen: ${fallbackMsg}`,
          );
          // Throw original error, not the fallback error
          throw lastError;
        }
      }

      throw error;
    }
  },
  { name: "MultiProvider_Generate", run_type: "llm" },
);

// Alias for backward compatibility and clarity
export const chatWithOllama = (prompt: string, modelName?: string) =>
  generateResponse(prompt, "ollama", modelName);

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
  routerConfig?: Record<string, unknown>,
): Promise<{ response: string; decision: RoutingDecision }> {
  const decision = routeTask(taskDescription || prompt, routerConfig);

  logInfo(
    "LLM_CLIENT",
    `Routed → ${decision.model.name} (${decision.model.provider}) — ${decision.reason}`,
  );

  try {
    const response = await generateResponse(
      prompt,
      decision.model.provider,
      decision.model.name,
    );
    return { response, decision };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError(
      "LLM_CLIENT",
      `Routed model (${decision.model.name}) failed: ${errorMsg}`,
    );

    // RULE-MR4: Fallback to Ollama if we have a fallback defined
    if (decision.fallback && decision.model.provider !== "ollama") {
      logInfo("LLM_CLIENT", `[MR4] Falling back to ${decision.fallback.name}`);
      const fallbackResponse = await generateResponse(
        prompt,
        decision.fallback.provider,
        decision.fallback.name,
      );
      return {
        response: fallbackResponse,
        decision: {
          ...decision,
          reason: `${decision.reason} [FALLBACK: ${decision.fallback.name}]`,
        },
      };
    }

    throw error;
  }
}
