import { logInfo, logError } from './logger.js';

export interface BrowserCommand {
    action: 'launch' | 'navigate' | 'click' | 'type' | 'screenshot' | 'content' | 'scroll' | 'wait' | 'extract' | 'close';
    url?: string;
    selector?: string;
    text?: string;
    headless?: boolean;
    // NEW: scroll parameters
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
    // NEW: wait parameters
    timeout?: number;
    // NEW: extract parameters
    type?: 'text' | 'attribute' | 'html';
    attribute?: string;
}

export interface BrowserResponse {
    status: 'success' | 'error';
    message?: string;
    url?: string;
    screenshot?: string; // base64
    content?: string;
    data?: any; // NEW: for extract results
    count?: number; // NEW: number of extracted elements
}

export class PersistentBrowser {
    private process: any = null; // ChildProcess
    private lastScreenshot: Uint8Array | null = null;
    private pendingCommands: { resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];
    private buffer: string = '';
    private startPromise: Promise<void> | null = null;

    constructor() {}

    private async getPythonPath(): Promise<string> {
        if (typeof process === 'undefined' || !process.versions?.node) return 'python';
        const fs = await import('fs');
        const venvPath = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
        if (fs.existsSync(venvPath)) {
            return venvPath;
        }
        return 'python';
    }

    private async startProcess() {
        if (this.process) return;
        if (typeof process === 'undefined' || !process.versions?.node) {
             throw new Error("Browser agent only supported in Node.js environment");
        }

        const path = (await import('path')).default;
        const { spawn } = await import('child_process');

        const scriptPath = path.resolve(process.cwd(), 'myai/interactive_browser.py');
        const pythonExec = await this.getPythonPath();

        logInfo('PersistentBrowser', `Starting browser process: ${pythonExec} ${scriptPath}`);

        this.process = spawn(pythonExec, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.on('data', (data: any) => {
            this.buffer += data.toString();

            let lines = this.buffer.split('\n');
            this.buffer = lines.pop() || ''; // Keep the last partial line

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                } catch (e) {
                    logError('PersistentBrowser', `Failed to parse response: ${line}`);
                }
            }
        });

        this.process.stderr.on('data', (data: any) => {
            logError('PersistentBrowser', `Python stderr: ${data.toString()}`);
        });

        this.process.on('close', (code: any) => {
            logInfo('PersistentBrowser', `Browser process exited with code ${code}`);
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
                        logError('PersistentBrowser', 'Failed to decode screenshot');
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
            if (!this.startPromise) {
                this.startPromise = this.startProcess();
            }
            try {
                await this.startPromise;
            } catch (e) {
                this.startPromise = null;
                throw new Error("Failed to start browser process: " + String(e));
            }
        }

        return new Promise((resolve, reject) => {
            this.pendingCommands.push({ resolve, reject });
            const jsonCmd = JSON.stringify(command) + '\n';
            if (this.process && this.process.stdin) {
                this.process.stdin.write(jsonCmd);
            } else {
                reject(new Error("Process failed to start or is not running"));
            }
        });
    }

    public getLastScreenshot(): Uint8Array | null {
        return this.lastScreenshot;
    }

    public async close() {
        if (this.process) {
            await this.sendCommand({ action: 'close' }).catch(() => {}); // Ignore error if already closed
            if (this.process) this.process.kill();
            this.process = null;
            this.lastScreenshot = null;
        }
    }
}

export const persistentBrowser = new PersistentBrowser();
