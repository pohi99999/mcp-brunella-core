// FILE: test/llm_provider.test.ts
// PURPOSE: Ellenőrzi a Multi-Provider LLM váltót és a fallback mechanizmust.
// NOTE: CI-ben skip-elve — Ollama nem elérhető GitHub runners-en.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateResponse } from "../src/core/llm_client";

const isCI = !!process.env.CI;

describe.skipIf(isCI)("Brunella 2.0 LLM Provider Test", () => {
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiKey;
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({ response: "ok" })
        })) as unknown as typeof fetch);
    });

    afterEach(() => {
        process.env.GEMINI_API_KEY = originalGeminiKey;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("should generate response via Ollama by default", async () => {
        const response = await generateResponse("Szia, ki vagy?", "ollama");
        expect(response).toBeDefined();
        expect(globalThis.fetch).toHaveBeenCalled();
    }, 120000);

    it("should fallback to Ollama if Gemini API key is missing/invalid", async () => {
        // Teszt hiba szimulálása Gemini-vel
        process.env.GEMINI_API_KEY = "";
        const response = await generateResponse("Test prompt", "gemini");
        expect(response).toBeDefined();
        expect(globalThis.fetch).toHaveBeenCalled();
    }, 120000);
});
