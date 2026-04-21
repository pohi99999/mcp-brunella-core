import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateResponse } from "@packages/core-logic/llm_client.js";

export function registerGeminiTool(server: McpServer) {
    server.tool(
        "gemini_generate",
        "Generate text using Google Gemini API (2.5 Pro, 2.0 Flash, etc.).",
        {
            prompt: z.string().describe("The user prompt to send"),
            model: z.string().optional().describe("Model name, e.g. 'gemini-2.5-pro-preview-06-05'. Defaults to GEMINI_MODEL env."),
            system: z.string().optional().describe("Optional system prompt"),
        },
        async ({ prompt, model, system }) => {
            try {
                // Combine system and prompt if system is provided
                const fullPrompt = system ? `System: ${system}\n\nUser: ${prompt}` : prompt;
                const response = await generateResponse(fullPrompt, 'gemini', model);
                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [{ type: "text", text: `Gemini hiba: ${msg}` }]
                };
            }
        }
    );
}

