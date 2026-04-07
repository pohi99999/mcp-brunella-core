import type { ChildProcess } from 'child_process';
import { logInfo, logError } from './logger.js';
import { exec } from 'child_process';
import { safeJsonParse } from './aiHelpers.js';

export interface BrowserCommand {
    action: 'launch' | 'navigate' | 'click' | 'type' | 'screenshot' | 'content' | 'scroll' | 'wait' | 'extract' | 'close' | 'press' | 'state' | 'query';
    url?: string;
    selector?: string;
    description?: string;
    text?: string;
    key?: string; // NEW: for press action
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
    title?: string; // NEW: for state results
    screenshot?: string; // base64
    selector?: string;
    content?: string;
    data?: unknown; // NEW: for extract results
    count?: number; // NEW: number of extracted elements
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function isBrowserResponse(value: unknown): value is BrowserResponse {
    if (!isRecord(value)) return false;

    if (value.status !== 'success' && value.status !== 'error') return false;
    if ('message' in value && value.message !== undefined && typeof value.message !== 'string') return false;
    if ('url' in value && value.url !== undefined && typeof value.url !== 'string') return false;
    if ('title' in value && value.title !== undefined && typeof value.title !== 'string') return false;
    if ('screenshot' in value && value.screenshot !== undefined && typeof value.screenshot !== 'string') return false;
    if ('selector' in value && value.selector !== undefined && typeof value.selector !== 'string') return false;
    if ('content' in value && value.content !== undefined && typeof value.content !== 'string') return false;
    if ('count' in value && value.count !== undefined && typeof value.count !== 'number') return false;

    return true;
}

export class PersistentBrowser {
    private process: ChildProcess | null = null; 
    private lastScreenshot: Uint8Array | null = null;
    private pendingCommands: { resolve: (value: BrowserResponse) => void; reject: (reason?: unknown) => void }[] = [];
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

        this.process.stdout?.on('data', (data: Buffer | string) => {
            this.buffer += data.toString();

            const lines = this.buffer.split('\n');
            this.buffer = lines.pop() || ''; // Keep the last partial line

            for (const line of lines) {
                if (!line.trim()) continue;
                const response = safeJsonParse<unknown>(line, null);
                if (!isBrowserResponse(response)) {
                    logError('PersistentBrowser', `Failed to parse response: ${line}`);
                    continue;
                }
                this.handleResponse(response);
            }
        });

        this.process.stderr?.on('data', (data: Buffer | string) => {
            logError('PersistentBrowser', `Python stderr: ${data.toString()}`);
        });

        this.process.on('close', (code: number | null) => {
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
                    } catch {
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

    public isConnected(): boolean {
        return this.process !== null;
    }

    public forceKill() {
        if (this.process) {
            this.process.kill('SIGKILL');
            this.process = null;
        }
        
        // OS-level cleanup for chromium

        if (process.platform === 'win32') {
            exec('taskkill /F /IM chrome.exe /T');
            exec('taskkill /F /IM chromedriver.exe /T');
        } else {
            exec('pkill -f chromium');
            exec('pkill -f chrome');
        }
    }
}

export const persistentBrowser = new PersistentBrowser();
