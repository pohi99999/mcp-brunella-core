import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';

export class PythonShell {
    private scriptPath: string;
    private pythonPath: string;

    constructor(scriptRelativePath: string) {
        this.scriptPath = path.resolve(config.workspaceRoot, scriptRelativePath);
        const venvRel = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
        const candidatePath = path.resolve(config.workspaceRoot, venvRel);
        
        // Validate python path
        try {
            // Check if file exists AND is executable/valid
            execSync(`"${candidatePath}" --version`, { stdio: 'ignore' });
            this.pythonPath = candidatePath;
        } catch (e) {
            console.warn(`[PythonShell] Venv python at ${candidatePath} is invalid or missing. Falling back to system python.`);
            this.pythonPath = 'python'; // Fallback
        }
    }

    async run(code: string, context?: any): Promise<string> {
        const root = config.workspaceRoot.replace(/\\/g, '/');
        const tempIn = path.join(config.systemLogDir, `py_in_${Date.now()}.json`);
        const tempPy = path.join(config.systemLogDir, `py_run_${Date.now()}.py`);

        // Ensure log dir exists
        try {
            await fs.mkdir(config.systemLogDir, { recursive: true });
        } catch (e) { }

        try {
            await fs.writeFile(tempIn, JSON.stringify(context || {}), 'utf-8');
            
            // Indent the code to fit inside the try block
            const indentedCode = code.split('\n').map(line => '    ' + line).join('\n');

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
                exec(`"${this.pythonPath}" "${tempPy}"`, { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, async (error, stdout, stderr) => {
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
