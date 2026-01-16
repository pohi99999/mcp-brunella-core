import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Logger } from "../utils/logger.js";

const logger = new Logger('ollama.log');

export function registerOllamaTool(server: McpServer) {
    server.tool(
        "ollama_generate",
        "Generates text using a local Ollama model.",
        {
            model: z.string().default("llama3.1").describe("The model to use"),
            prompt: z.string().describe("The prompt to generate from"),
            options: z.object({
                temperature: z.number().optional(),
                num_predict: z.number().optional(),
            }).optional()
        },
        async ({ model, prompt, options }) => {
            const endpoint = "http://localhost:11434/api/generate";
            
            await logger.log(`Request: ${model}`, { promptLength: prompt.length });

            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model,
                        prompt,
                        stream: false,
                        options
                    })
                });

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.statusText}`);
                }

                const data = await response.json();
                await logger.log(`Response received`, { duration: data.total_duration });

                return {
                    content: [{
                        type: "text",
                        text: data.response
                    }]
                };

            } catch (error: any) {
                await logger.log(`Error`, { message: error.message });
                return {
                    isError: true,
                    content: [{ type: "text", text: `Ollama error: ${error.message}` }]
                };
            }
        }
    );
}
