import { Logger } from "./logger.js";

const logger = new Logger('llm.log');

export async function chatWithOllama(prompt: string, system: string = "", model: string = "qwen2.5-coder:1.5b"): Promise<string> {
    try {
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                system: system,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.response || "";
    } catch (e: any) {
        logger.log(`Ollama Error: ${e.message}`, 'error');
        return `[LLM Error: ${e.message}. Is Ollama running?]`;
    }
}

export async function chatWithOllamaHistory(messages: { role: string, content: string }[], model: string = "qwen2.5-coder:1.5b"): Promise<string> {
    try {
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.message || !data.message.content) {
            logger.log(`Ollama returned empty response: ${JSON.stringify(data)}`, 'warn');
            return "[Empty response from Ollama]";
        }
        return data.message.content;
    } catch (e: any) {
        logger.log(`Ollama Chat Error: ${e.message}`, 'error');
        return `[LLM Error: ${e.message}]`;
    }
}
