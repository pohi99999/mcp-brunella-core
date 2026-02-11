// src/utils/pythonShell.ts
// Compatible with both Node.js and Cloudflare Workers (via dynamic imports)

import { config } from '../config/index.js';

// Dynamic imports holder
let exec: any = null;
let execSync: any = null;
let path: any = null;
let fs: any = null;

async function ensureNodeDeps() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!exec) {
            const cp = await import('child_process');
            exec = cp.exec;
            execSync = cp.execSync;
        }
        if (!path) path = (await import('path')).default;
        if (!fs) fs = (await import('fs/promises')).default;
    }
}

export class PythonShell {
    private scriptPath: string = '';
    private pythonPath: string = 'python';
    private apiUrl: string;
    private useApi: boolean = true;

    constructor(scriptRelativePath: string) {
        // Initialize basic config immediately
        this.apiUrl = process.env.BRUNELLA_PYTHON_API_URL || "http://127.0.0.1:8000";
        
        // Node.js specific initialization logic wrapped in promise or handled lazily
        // For constructor, we can't be async, so we'll init paths in run() or runLegacy()
        // but we can try a sync check if strictly needed, though dynamic import is async.
        // We'll defer path resolution to execution time.
        this.scriptPath = scriptRelativePath;
    }

    /** Zone IV: Phoenix Protocol – retry on failure, then fallback. */
    async run(code: string, context?: any): Promise<string> {
        if (this.useApi) {
            try {
                return await this.runViaApi(code, context);
            } catch (e) {
                // Phoenix: retry once after short delay
                await new Promise((r) => setTimeout(r, 1500));
                try {
                    return await this.runViaApi(code, context);
                } catch (e2) {
                    // Fallback to legacy subprocess
                }
            }
        }
        return this.runLegacy(code, context);
    }

    private async runViaApi(code: string, context?: any): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(`${this.apiUrl}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, context }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${await response.text()}`);
            }

            const data = await response.json() as { stdout: string, error?: string };
            if (data.error) {
                return JSON.stringify({ error: data.error });
            }
            return data.stdout;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async runLegacy(code: string, context?: any): Promise<string> {
        await ensureNodeDeps();
        if (!exec || !fs || !path) {
            return JSON.stringify({ error: "Legacy Python execution unavailable: Node.js dependencies missing." });
        }

        // Initialize paths if not already done (lazy init)
        const root = config.workspaceRoot.replace(/\\/g, '/');
        const resolvedScriptPath = path.resolve(config.workspaceRoot, this.scriptPath);

        // Determine python path (lazy check)
        if (this.pythonPath === 'python') {
             const venvRel = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
             const candidatePath = path.resolve(config.workspaceRoot, venvRel);
             try {
                 execSync(`"${candidatePath}" --version`, { stdio: 'ignore' });
                 this.pythonPath = candidatePath;
             } catch (e) {
                 this.pythonPath = 'python';
             }
        }

        const tempIn = path.join(config.systemLogDir, `py_in_${Date.now()}.json`);
        const tempPy = path.join(config.systemLogDir, `py_run_${Date.now()}.py`);

        try {
            await fs.mkdir(config.systemLogDir, { recursive: true });
        } catch (e) { } // Ignore if dir exists

        try {
            await fs.writeFile(tempIn, JSON.stringify(context || {}), 'utf-8');
            
            // Indent the code to fit inside the try block
            const indentedCode = code.split('\n').map((line: string) => '    ' + line).join('\n');

            const wrapperCode = `
import sys, json, os
import traceback

sys.path.append('${root}')

try:
    with open('${tempIn.replace(/\\/g, '/')}', 'r', encoding='utf-8') as f:
        context = json.load(f)
${indentedCode}
except Exception as e:
    traceback.print_exc()
    print(json.dumps({"error": str(e)}))
`;
            await fs.writeFile(tempPy, wrapperCode, 'utf-8');

            return new Promise((resolve, reject) => {
                exec(`"${this.pythonPath}" "${tempPy}"`, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, async (error: any, stdout: string, stderr: string) => {
                    await fs.unlink(tempIn).catch(() => {});
                    await fs.unlink(tempPy).catch(() => {});
                    if (error) { 
                        // If output contains JSON error, prefer that
                        if (stdout.trim().startsWith('{') && stdout.includes('"error"')) {
                             resolve(stdout.trim());
                             return;
                        }
                        reject(stderr || error.message); 
                        return; 
                    }
                    resolve(stdout.trim());
                });
            });
        } catch (e: any) {
            return JSON.stringify({ error: e.message });
        }
    }
}

export const globalPythonShell = new PythonShell('interactive.py');
