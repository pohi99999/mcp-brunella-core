// FILE: test/llm_provider.test.ts
// PURPOSE: Ellenőrzi a Multi-Provider LLM váltót és a fallback mechanizmust.
// NOTE: CI-ben skip-elve — Ollama nem elérhető GitHub runners-en.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { aiGatewayGenerate, geminiGenerateContent } = vi.hoisted(() => ({
  aiGatewayGenerate: vi.fn(),
  geminiGenerateContent: vi.fn(),
}));

vi.mock("../src/utils/aiGateway.js", () => ({
  aiGateway: {
    generate: aiGatewayGenerate,
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: geminiGenerateContent,
    },
  })),
}));

import { generateResponse } from "../src/core/llm_client";

const isCI = !!process.env.CI;

describe.skipIf(isCI)("Brunella 2.0 LLM Provider Test", () => {
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiKey;
        aiGatewayGenerate.mockReset();
        geminiGenerateContent.mockReset();
        aiGatewayGenerate.mockResolvedValue("ok-ollama");
        geminiGenerateContent.mockResolvedValue({ text: "ok-gemini" });
    });

    afterEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiKey;
        vi.restoreAllMocks();
    });

    it("should generate response via Ollama by default", async () => {
        const response = await generateResponse("Szia, ki vagy?", "ollama");
        expect(response).toBe("ok-ollama");
        expect(aiGatewayGenerate).toHaveBeenCalled();
    }, 120000);

    it("should fallback to Ollama if Gemini API key is missing/invalid", async () => {
        process.env.GEMINI_API_KEY = "";
        const response = await generateResponse("Test prompt", "gemini");
        expect(response).toBe("ok-ollama");
        expect(aiGatewayGenerate).toHaveBeenCalled();
    }, 120000);
});
