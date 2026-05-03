import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Logger } from "../utils/logger.js";
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { chatWithOllama } from '../core/llm_client.js';

const logger = new Logger('pipeline.log');
/** Configurable via PIPELINE_SANDBOX_TIMEOUT_MS. Stronger isolation (e.g. isolated-vm) optional for future. */
const SANDBOX_TIMEOUT_MS = Number(process.env.PIPELINE_SANDBOX_TIMEOUT_MS) || 5000;

/**
 * Run untrusted code in an isolated subprocess with timeout.
 * Replaces vm2 (deprecated, critical CVEs). Uses temp file + node child_process.
 */
async function runCodeInSubprocess(code: string): Promise<{ success: boolean; error?: string }> {
    const tmpDir = config.systemLogDir;
    const tmpFile = path.join(tmpDir, `pipeline_sandbox_${Date.now()}_${process.pid}.js`);
    try {
        await fs.mkdir(tmpDir, { recursive: true });
        await fs.writeFile(tmpFile, code, 'utf-8');
        const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
            const child = spawn(process.execPath, [tmpFile], {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: SANDBOX_TIMEOUT_MS,
                env: { ...process.env, NODE_OPTIONS: '--no-warnings' },
            });
            let stderr = '';
            child.stderr?.on('data', (d) => { stderr += String(d); });
            child.on('error', () => resolve({ success: false, error: 'Process spawn error' }));
            child.on('close', (exitCode, signal) => {
                if (exitCode === 0 && signal === null) return resolve({ success: true });
                resolve({ success: false, error: (stderr || `exit ${exitCode} signal ${String(signal)}`).trim() });
            });
        });
        await fs.unlink(tmpFile).catch(() => {});
        return result;
    } catch (e: any) {
        await fs.unlink(tmpFile).catch(() => {});
        return { success: false, error: e.message };
    }
}

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

            const prompt = attempt === 1
                ? `Write a Node.js script for: ${task}. Output ONLY code, no markdown. No explanations.`
                : `The previous code failed with: "${lastError}". Fix the code for: ${task}. Output ONLY code.`;

            this.emit('progress', `🧠 Kód generálása (Ollama)...`);

            try {
                currentCode = await chatWithOllama(prompt, "qwen2.5-coder:1.5b");

                currentCode = currentCode.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "").trim();

                this.emit('progress', `💻 Kód generálva (${currentCode.length} karakter).`);
                this.emit('progress', `🧪 Tesztelés sandboxban (subprocess, ${SANDBOX_TIMEOUT_MS}ms timeout)...`);

                const { success: ok, error } = await runCodeInSubprocess(currentCode);
                if (ok) {
                    success = true;
                    this.emit('progress', `✅ Teszt SIKERES!`);
                } else {
                    lastError = error ?? 'Unknown error';
                    this.emit('progress', `❌ Hiba történt: ${lastError}`);
                    await logger.log(`Attempt ${attempt} failed: ${lastError}`);
                }
            } catch (e: any) {
                lastError = e.message ?? String(e);
                this.emit('progress', `❌ Hiba történt: ${lastError}`);
                await logger.log(`Attempt ${attempt} failed: ${lastError}`);
            }
        }

        if (success) {
            this.emit('complete', { success: true, code: currentCode });
            return currentCode;
        }
        this.emit('complete', { success: false, error: lastError });
        throw new Error(`Pipeline failed after ${this.maxAttempts} attempts.`);
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