import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateResponse } from "../core/llm_client.js";

export function registerGithubModelsTool(server: McpServer) {
    server.tool(
        "github_models_generate",
        "Generate text using GitHub Models API (GPT-4o, DeepSeek-R1, Grok 3, etc.). Requires GitHub Pro+ subscription.",
        {
            prompt: z.string().describe("The user prompt to send"),
            model: z.string().optional().describe("Model name, e.g. 'gpt-4o'. Defaults to GITHUB_MODELS_DEFAULT_MODEL env."),
            system: z.string().optional().describe("Optional system prompt"),
        },
        async ({ prompt, model, system }) => {
            try {
                // Combine system and prompt if system is provided
                const fullPrompt = system ? `System: ${system}\n\nUser: ${prompt}` : prompt;
                const response = await generateResponse(fullPrompt, 'github', model);
                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                return {
                    isError: true,
                    content: [{ type: "text", text: `GitHub Models hiba: ${msg}` }]
                };
            }
        }
    );
}
