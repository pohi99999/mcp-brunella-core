"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClaudeTool = registerClaudeTool;
const zod_1 = require("zod");
const logger_js_1 = require("../utils/logger.js");
const logger = new logger_js_1.Logger('claude.log');
function registerClaudeTool(server) {
    server.tool("claude_message", "Sends a message to the Anthropic Claude API.", {
        model: zod_1.z.string().default("claude-3-opus-20240229").describe("The model to use"),
        messages: zod_1.z.array(zod_1.z.object({
            role: zod_1.z.enum(["user", "assistant"]),
            content: zod_1.z.string()
        })).describe("Conversation history"),
        system: zod_1.z.string().optional().describe("System prompt"),
        max_tokens: zod_1.z.number().default(1024)
    }, async ({ model, messages, system, max_tokens }) => {
        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            return {
                isError: true,
                content: [{ type: "text", text: "Error: CLAUDE_API_KEY environment variable is not set." }]
            };
        }
        const endpoint = "https://api.anthropic.com/v1/messages";
        await logger.log(`Request: ${model}`, { messageCount: messages.length });
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model,
                    messages,
                    system,
                    max_tokens
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Claude API error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            const textContent = data.content[0].text;
            await logger.log(`Response received`, { id: data.id });
            return {
                content: [{
                        type: "text",
                        text: textContent
                    }]
            };
        }
        catch (error) {
            await logger.log(`Error`, { message: error.message });
            return {
                isError: true,
                content: [{ type: "text", text: `Claude error: ${error.message}` }]
            };
        }
    });
}
