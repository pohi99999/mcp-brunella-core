import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Logger } from "@packages/utils/logger.js";
import { mcpError, mcpText } from "@packages/utils/mcpResponse.js";
import { ensureError } from "@packages/utils/ensureError.js";

const logger = new Logger('claude.log');

export function registerClaudeTool(server: McpServer) {
    server.tool(
        "claude_message",
        "Sends a message to the Anthropic Claude API.",
        {
            model: z.string().default("claude-3-opus-20240229").describe("The model to use"),
            messages: z.array(z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string()
            })).describe("Conversation history"),
            system: z.string().optional().describe("System prompt"),
            max_tokens: z.number().default(1024)
        },
        async ({ model, messages, system, max_tokens }) => {
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

                const data = await response.json() as { content: Array<{ text: string }>; id: string };
                const textContent = data.content[0].text;
                
                await logger.log(`Response received`, { id: data.id });

                return mcpText(textContent);

            } catch (error: unknown) {
                const normalized = ensureError(error);
                await logger.log(`Error`, { message: normalized.message });
                return mcpError(`Claude error: ${normalized.message}`);
            }
        }
    );
}

