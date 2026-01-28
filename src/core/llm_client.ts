export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_calls?: any[];
}

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

export class LLMClient {
    private baseUrl: string;
    private model: string;

    constructor(config: { provider: string; model: string; baseUrl: string }) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.model = config.model;
    }

    async chatStream(messages: Message[], tools: Tool[], onChunk: (chunk: string) => void): Promise<Message> {
        const url = `${this.baseUrl}/api/chat`;
        
        // Convert Tools to Ollama format if needed, but for now we focus on basic chat
        // to restore functionality.
        const body = {
            model: this.model,
            messages: messages,
            stream: true
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                console.error(`Debug: URL=${url}, Body=${JSON.stringify(body)}`);
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            let fullContent = "";
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message?.content) {
                                const content = json.message.content;
                                fullContent += content;
                                onChunk(content);
                            }
                            if (json.done) break;
                        } catch (e) {
                            // Partial JSON or error
                        }
                    }
                }
            }

            return {
                role: 'assistant',
                content: fullContent
            };

        } catch (error: any) {
            const errorMsg = `LLM Error: ${error.message}`;
            onChunk(errorMsg);
            return { role: 'assistant', content: errorMsg };
        }
    }
}

export async function chatWithOllama(prompt: string, system?: string, modelOverride?: string): Promise<string> {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = modelOverride || process.env.OLLAMA_MODEL || "gemma2:9b"; // Default to a known model

    const messages: Message[] = [];
    if (system) {
        messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });

    const client = new LLMClient({ provider: 'ollama', model, baseUrl });
    let fullText = "";
    await client.chatStream(messages, [], (chunk) => {
        fullText += chunk;
    });
    return fullText;
}
