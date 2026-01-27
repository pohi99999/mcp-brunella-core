import { Logger } from "./logger.js";

const logger = new Logger('llm.log');

export async function chatWithOllama(prompt: string, system: string = "", model: string = "qwen2.5-coder:1.5b"): Promise<string> {
    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                system: system,
                stream: false
            })
        });
        const data = await response.json();
        return data.response || "";
    } catch (e: any) {
        logger.log(`Ollama Error: ${e.message}`, 'error');
        return "";
    }
}
