import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export class PythonBridge {
    private venvPath: string;
    private pythonExecutable: string;

    constructor() {
        this.venvPath = this.findVenv();
        this.pythonExecutable = this.getPythonExecutable();
    }

    private findVenv(): string {
        // Feltételezzük, hogy a .venv a projekt gyökerében van
        const projectRoot = process.cwd();
        const possibleVenv = path.join(projectRoot, '.venv');
        
        if (fs.existsSync(possibleVenv)) {
            return possibleVenv;
        }
        
        console.warn('Warning: Python virtual environment (.venv) not found. Using system python.');
        return '';
    }

    private getPythonExecutable(): string {
        if (!this.venvPath) return 'python'; // Fallback to system python

        const isWin = process.platform === 'win32';
        if (isWin) {
            return path.join(this.venvPath, 'Scripts', 'python.exe');
        } else {
            return path.join(this.venvPath, 'bin', 'python');
        }
    }

    public async runScript(scriptPath: string, args: string[] = []): Promise<string> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonExecutable, [scriptPath, ...args]);
            
            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(stdoutData.trim());
                } else {
                    reject(new Error(`Python script exited with code ${code}.\nStderr: ${stderrData}`));
                }
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });
        });
    }

    public getPythonPath(): string {
        return this.pythonExecutable;
    }
}
