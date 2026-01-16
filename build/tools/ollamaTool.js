"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOllamaTool = registerOllamaTool;
const zod_1 = require("zod");
const logger_js_1 = require("../utils/logger.js");
const logger = new logger_js_1.Logger('ollama.log');
function registerOllamaTool(server) {
    server.tool("ollama_generate", "Generates text using a local Ollama model.", {
        model: zod_1.z.string().default("llama3.1").describe("The model to use"),
        prompt: zod_1.z.string().describe("The prompt to generate from"),
        options: zod_1.z.object({
            temperature: zod_1.z.number().optional(),
            num_predict: zod_1.z.number().optional(),
        }).optional()
    }, async ({ model, prompt, options }) => {
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
        }
        catch (error) {
            await logger.log(`Error`, { message: error.message });
            return {
                isError: true,
                content: [{ type: "text", text: `Ollama error: ${error.message}` }]
            };
        }
    });
}
