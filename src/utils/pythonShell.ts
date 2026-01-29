import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';

export class PythonShell {
    private scriptPath: string;
    private pythonPath: string;

    constructor(scriptRelativePath: string) {
        this.scriptPath = path.resolve(config.workspaceRoot, scriptRelativePath);
        this.pythonPath = path.resolve(config.workspaceRoot, '.venv/Scripts/python.exe');
    }

    async run(code: string, context?: any): Promise<string> {
        const root = config.workspaceRoot.replace(/\\/g, '/');
        const tempIn = path.join(config.systemLogDir, `py_in_${Date.now()}.json`);
        const tempPy = path.join(config.systemLogDir, `py_run_${Date.now()}.py`);

        try {
            await fs.writeFile(tempIn, JSON.stringify(context || {}), 'utf-8');
            const wrapperCode = `
import sys, json, os
sys.path.append('${root}')
try:
    with open('${tempIn.replace(/\\/g, '/')}', 'r', encoding='utf-8') as f:
        context = json.load(f)
    ${code}
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
            await fs.writeFile(tempPy, wrapperCode, 'utf-8');

            return new Promise((resolve, reject) => {
                exec(`"${this.pythonPath}" "${tempPy}"`, async (error, stdout, stderr) => {
                    await fs.unlink(tempIn).catch(() => {});
                    await fs.unlink(tempPy).catch(() => {});
                    if (error) { reject(stderr || error.message); return; }
                    resolve(stdout.trim());
                });
            });
        } catch (e: any) {
            return JSON.stringify({ error: e.message });
        }
    }
}

export const globalPythonShell = new PythonShell('interactive.py');
