import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chatWithOllama } from "@packages/core-logic/llm_client.js";
import { mcpCatch, mcpText } from "@packages/utils/mcpResponse.js";

export function registerOllamaTool(server: McpServer) {
    server.tool(
        "ollama_generate",
        "Generates text using a local Ollama model.",
        {
            model: z.string().optional().describe("The model to use"),
            prompt: z.string().describe("The prompt to generate from")
        },
        async ({ model, prompt }) => {
            try {
                const response = await chatWithOllama(prompt, model);
                return mcpText(response);
            } catch (error: unknown) {
                return mcpCatch(error, "ollama_generate");
            }
        }
    );
}
