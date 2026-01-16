import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Logger } from "../utils/logger.js";
import { EventEmitter } from 'events';

const logger = new Logger('pipeline.log');

export class SelfHealingPipeline extends EventEmitter {
    private maxAttempts: number;

    constructor(maxAttempts: number = 3) {
        super();
        this.maxAttempts = maxAttempts;
    }

    async run(task: string): Promise<string> {
        let currentCode = "";
        let attempt = 0;
        let success = false;
        let lastError = "";

        await logger.log(`Starting Self-Healing Pipeline: ${task}`);
        this.emit('progress', `🚀 Feladat indítása: ${task}`);

        while (attempt < this.maxAttempts && !success) {
            attempt++;
            this.emit('progress', `🔄 Próbálkozás ${attempt}/${this.maxAttempts}...`);

            // 1. GENERATE / FIX
            const prompt = attempt === 1 
                ? `Write a Node.js script for: ${task}. Output ONLY code, no markdown. No explanations.`
                : `The previous code failed with: "${lastError}". Fix the code for: ${task}. Output ONLY code.`;

            this.emit('progress', `🧠 Kód generálása (Ollama)...`);
            
            try {
                const ollamaRes = await fetch("http://localhost:11434/api/generate", {
                    method: "POST",
                    body: JSON.stringify({ model: "llama3.1", prompt: prompt, stream: false })
                });
                
                if (!ollamaRes.ok) throw new Error("Ollama connection failed");
                
                const ollamaData = await ollamaRes.json();
                currentCode = ollamaData.response;
                
                // Cleanup markdown
                currentCode = currentCode.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "").trim();

                this.emit('progress', `💻 Kód generálva (${currentCode.length} karakter).`);

                // 2. VALIDATE (Run in Sandbox)
                this.emit('progress', `🧪 Tesztelés sandboxban...`);
                
                const { VM } = await import('vm2');
                const vm = new VM({
                    timeout: 2000, 
                    sandbox: {
                        console: { log: () => {} }, // Mute console in check
                        require: (pkg: string) => {
                            if (['fs', 'path', 'http', 'net'].includes(pkg)) throw new Error(`Modul '${pkg}' tiltott a sandboxban.`);
                            return {}; // Mock other requires
                        }
                    }
                });
                
                vm.run(currentCode); 
                
                success = true;
                this.emit('progress', `✅ Teszt SIKERES!`);
                
            } catch (e: any) {
                lastError = e.message;
                this.emit('progress', `❌ Hiba történt: ${lastError}`);
                await logger.log(`Attempt ${attempt} failed: ${lastError}`);
            }
        }

        if (success) {
            this.emit('complete', { success: true, code: currentCode });
            return currentCode;
        } else {
            this.emit('complete', { success: false, error: lastError });
            throw new Error(`Pipeline failed after ${this.maxAttempts} attempts.`);
        }
    }
}

// Wrapper for MCP Tool registration
export function registerPipelineTools(server: McpServer) {
    server.tool(
        "pipeline_self_healing_gen",
        "Generates code with self-healing capabilities.",
        {
            task: z.string().describe("The coding task"),
            max_attempts: z.number().default(3)
        },
        async ({ task, max_attempts }) => {
            const pipeline = new SelfHealingPipeline(max_attempts);
            // We can't stream progress via standard MCP tool response easily yet (needs server-sent events support in client),
            // so we just await the result.
            try {
                const code = await pipeline.run(task);
                return {
                    content: [{ type: "text", text: `SUCCESS:\n${code}` }]
                };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `FAILED: ${e.message}` }] };
            }
        }
    );
}