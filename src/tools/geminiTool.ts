import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateWithGemini, listGeminiModels } from "../core/llm_client.js";

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
                const response = await generateWithGemini(prompt, model, system);
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

    server.tool(
        "gemini_list_models",
        "List available Gemini models.",
        {},
        async () => {
            const models = listGeminiModels();
            return {
                content: [{ type: "text", text: JSON.stringify(models, null, 2) }]
            };
        }
    );
}
