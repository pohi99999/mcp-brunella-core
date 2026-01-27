import { Logger } from '../utils/logger.js';
import fetch from 'node-fetch';


const logger = new Logger('llm_core.log');

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string; // For tool outputs
    tool_calls?: ToolCall[];
}

export interface ToolCall {
    id: string; // Ollama might generate this, or we mock it
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any; // JSON Schema
    };
}

export interface LLMConfig {
    provider: 'ollama' | 'openai';
    model: string;
    baseUrl: string;
    apiKey?: string;
}

export type StreamHandler = (chunk: string) => void;

export class LLMClient {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    async chatStream(
        messages: Message[],
        tools: Tool[] = [],
        onChunk: StreamHandler
    ): Promise<Message> {
        if (this.config.provider === 'ollama') {
            return this.chatStreamOllama(messages, tools, onChunk);
        } else {
            throw new Error(`Provider ${this.config.provider} not implemented yet.`);
        }
    }

    private async chatStreamOllama(
        messages: Message[],
        tools: Tool[] = [],
        onChunk: StreamHandler
    ): Promise<Message> {
        try {
            const body: any = {
                model: this.config.model,
                messages: messages,
                stream: true
            };

            if (tools.length > 0) {
                // Ollama format for tools (standard OpenAI compatible since 0.1.25+)
                body.tools = tools;
            }

            const response = await fetch(`${this.config.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${text}`);
            }

            if (!response.body) throw new Error("No response body");

            let fullContent = "";
            let finalToolCalls: ToolCall[] = [];
            // Temporary buffer for tool calls if they come in chunks (usually they come in one go or we need to assemble)
            // Ollama streaming with tools is a bit tricky, sometimes it sends tool calls at the end.

            // Note: node-fetch body is a Node stream
            for await (const chunk of response.body) {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);

                        if (json.done) {
                            // Final stats, ignore
                            continue;
                        }

                        if (json.message) {
                            const content = json.message.content;
                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }

                            if (json.message.tool_calls) {
                                // Accumulate tool calls
                                const calls = json.message.tool_calls as any[];
                                calls.forEach(c => {
                                    finalToolCalls.push({
                                        id: c.function.name + '_' + Date.now(), // Generate ID if missing
                                        type: 'function',
                                        function: {
                                            name: c.function.name,
                                            arguments: JSON.stringify(c.function.arguments) // Ensure it's string
                                        }
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        // Some lines might be partial JSON? unlikely with Ollama's line-delimited format
                        console.error("Error parsing chunk", e);
                    }
                }
            }

            return {
                role: 'assistant',
                content: fullContent,
                tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
            };

        } catch (error: any) {
            logger.log(`LLM Stream Error: ${error.message}`, 'error');
            throw error;
        }
    }
}
