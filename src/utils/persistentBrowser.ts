import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logInfo, logError } from './logger.js';
import fs from 'fs';

export interface BrowserCommand {
    action: string;
    url?: string;
    selector?: string;
    text?: string;
    headless?: boolean;
}

export interface BrowserResponse {
    status: 'success' | 'error';
    message?: string;
    url?: string;
    screenshot?: string; // base64
    content?: string;
}

export class PersistentBrowser {
    private process: ChildProcess | null = null;
    private lastScreenshot: Buffer | null = null;
    private pendingCommands: { resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];
    private buffer: string = '';

    constructor() {}

    private getPythonPath(): string {
        const venvPath = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
        if (fs.existsSync(venvPath)) {
            return venvPath;
        }
        return 'python';
    }

    private startProcess() {
        if (this.process) return;

        const scriptPath = path.resolve(process.cwd(), 'myai/interactive_browser.py');
        const pythonExec = this.getPythonPath();

        logInfo('BrowserManager', `Spawning browser process: ${pythonExec} ${scriptPath}`);

        this.process = spawn(pythonExec, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout?.on('data', (data) => {
            this.buffer += data.toString();

            let lines = this.buffer.split('\n');
            this.buffer = lines.pop() || ''; // Keep the last partial line

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                } catch (e) {
                    logError('BrowserManager', `Failed to parse response: ${line}`);
                }
            }
        });

        this.process.stderr?.on('data', (data) => {
            logError('BrowserManager', `Python Error: ${data.toString()}`);
        });

        this.process.on('close', (code) => {
            logInfo('BrowserManager', `Browser process exited with code ${code}`);
            this.process = null;
            // Reject all pending
            while (this.pendingCommands.length > 0) {
                const { reject } = this.pendingCommands.shift()!;
                reject(new Error('Browser process exited'));
            }
        });
    }

    private handleResponse(response: BrowserResponse) {
        if (this.pendingCommands.length > 0) {
            const { resolve, reject } = this.pendingCommands.shift()!;

            if (response.status === 'success') {
                if (response.screenshot) {
                    try {
                        this.lastScreenshot = Buffer.from(response.screenshot, 'base64');
                        // Remove base64 from object to keep it light
                        delete response.screenshot;
                    } catch (e) {
                        logError('BrowserManager', 'Failed to decode screenshot');
                    }
                }
                resolve(response);
            } else {
                reject(new Error(response.message || 'Unknown error'));
            }
        }
    }

    public async sendCommand(command: BrowserCommand): Promise<BrowserResponse> {
        if (!this.process) {
            this.startProcess();
            // Wait a small delay to let python start up?
            // The python script loops immediately, so it should buffer stdin until ready.
        }

        return new Promise((resolve, reject) => {
            this.pendingCommands.push({ resolve, reject });
            const jsonCmd = JSON.stringify(command) + '\n';
            if (this.process && this.process.stdin) {
                this.process.stdin.write(jsonCmd);
            } else {
                reject(new Error("Process failed to start"));
            }
        });
    }

    public getLastScreenshot(): Buffer | null {
        return this.lastScreenshot;
    }

    public async close() {
        if (this.process) {
            await this.sendCommand({ action: 'close' }).catch(() => {}); // Ignore error if already closed
            this.process.kill();
            this.process = null;
            this.lastScreenshot = null;
        }
    }
}

export const persistentBrowser = new PersistentBrowser();
