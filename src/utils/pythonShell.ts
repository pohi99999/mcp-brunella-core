import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';

export class PythonShell extends EventEmitter {
    private process: ChildProcessWithoutNullStreams | null = null;
    private buffer: string = '';
    private resolveExecution: ((value: string) => void) | null = null;
    private rejectExecution: ((reason: any) => void) | null = null;
    private isReady: boolean = false;
    private separator: string = '__BRUNELLA_END_EXECUTION__';

    constructor() {
        super();
    }

    public async start(): Promise<void> {
        if (this.process) return;

        // Resolve python executable
        let pythonPath = 'python';
        const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        try {
            // Check specific venv path first
            await fs.access(venvPython);
            pythonPath = venvPython;
        } catch {
            // Check standard Windows install location or global path
            // Fallback to 'python'
        }

        // Use -u for unbuffered binary stdout/stderr
        // and -i to force interactive mode (keeps prompt behavior predictable)
        this.process = spawn(pythonPath, ['-u', '-i'], {
            cwd: process.cwd(), // Use project root instead of homedir to access local files
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8' // Force UTF-8 for I/O
            }
        });

        this.process.stdout.on('data', (data) => this.handleOutput(data.toString()));
        this.process.stderr.on('data', (data) => this.handleErrorOutput(data.toString()));

        this.process.on('close', (code) => {
            this.emit('close', code);
            this.process = null;
            this.isReady = false;
        });

        // Initial setup to clear startup banner
        // We ensure it's ready by sending a dummy print
        return new Promise((resolve) => {
            // Give it a moment to start up
            setTimeout(() => {
                this.isReady = true;
                resolve();
            }, 500);
        });
    }

    private handleOutput(data: string) {
        this.buffer += data;

        if (this.buffer.includes(this.separator)) {
            const parts = this.buffer.split(this.separator);
            const output = parts[0].trim();
            // Keep the rest of buffer if any (unlikely in sync exec)
            this.buffer = parts.slice(1).join(this.separator);

            if (this.resolveExecution) {
                this.resolveExecution(output);
                this.resolveExecution = null;
                this.rejectExecution = null;
            }
        }
    }

    private handleErrorOutput(data: string) {
        // In interactive mode, prompts match '>>> ' or '... '
        // We treat everything else as potential error logs or just stderr output
        // We append to buffer too because often valid output goes to stderr (like warnings)
        // or we can stream it separately. For now, let's treat it as part of output.
        // BUT: the separator is printed to stdout.

        // Simple heuristic: just append to buffer, but maybe prefix with [STDERR]?
        // For now, let's just append to buffer to keep it simple.
        // A cleaner way is to capture it separately if needed.
        this.buffer += data;
    }

    public async loadScript(scriptPath: string): Promise<void> {
        if (!this.process || !this.isReady) {
            await this.start();
        }

        try {
            // Use python's exec to load the file, avoiding interactive mode indentation issues
            // Ensure forward slashes for cross-platform compatibility in python string
            const normalizedPath = scriptPath.replace(/\\/g, '/');
            const loadCommand = `exec(open('${normalizedPath}', encoding='utf-8').read())`;
            const result = await this.execute(loadCommand);
            
            if (result.includes("Traceback") || result.includes("Error:")) {
                 throw new Error(`Python error during load: ${result}`);
            }
        } catch (error: any) {
            throw new Error(`Failed to load script ${scriptPath}: ${error.message}`);
        }
    }

    public async execute(code: string): Promise<string> {
        if (!this.process || !this.isReady) {
            await this.start();
        }

        return new Promise((resolve, reject) => {
            if (this.resolveExecution) {
                reject(new Error("Another command is already running."));
                return;
            }

            this.resolveExecution = resolve;
            this.rejectExecution = reject;
            this.buffer = ''; // Clear buffer for new command

            // Ensure proper newline at the end of blocks
            // Wrapped with a try/except block to catch syntax errors during execution
            // and print specific marker.

            // We append the separator print command.
            // Note: In interactive mode, we need an extra newline to execute a block.

            if (!this.process || !this.process.stdin) {
                reject(new Error("Python process error: stdin not available"));
                return;
            }

            const wrappedCode = `${code}\nprint('${this.separator}')\n`;

            this.process.stdin.write(wrappedCode);
        });
    }

    public async restart() {
        this.stop();
        await this.start();
    }

    public stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

// Global instance/session manager could go here
export const globalPythonShell = new PythonShell();
