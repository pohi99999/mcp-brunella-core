import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateResponse } from "../core/llm_client.js";

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
                const response = await generateResponse(prompt, 'ollama');
                
                return {
                    content: [{
                        type: "text",
                        text: response
                    }]
                };

            } catch (error: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Ollama error: ${error.message}` }]
                };
            }
        }
    );
}