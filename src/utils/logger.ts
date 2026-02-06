import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

export class Logger {
    private logFile: string;

    constructor(filename: string) {
        this.logFile = path.join(config.systemLogDir, filename);
    }

    async log(message: string, meta?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }

    /** Structured JSON log: { level, timestamp, message, requestId?, ...meta } */
    async structured(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
        const entry = { level, timestamp: new Date().toISOString(), message, ...meta };
        const line = JSON.stringify(entry) + '\n';
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            await fs.appendFile(this.logFile, line);
        } catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }

    info(message: string, meta?: any) {
        return this.log(`[INFO] ${message}`, meta);
    }

    error(message: string, meta?: any) {
        return this.log(`[ERROR] ${message}`, meta);
    }

    warn(message: string, meta?: any) {
        return this.log(`[WARN] ${message}`, meta);
    }
}

export const systemLogger = new Logger('system_commands.log');
export const cliLogger = new Logger('cli_tools.log');

// --- Mission Control Dashboard Logger (console + Socket.IO) ---
// Lazy-load SocketService to avoid circular deps / init order with server

let _socketService: typeof import('../server/SocketService.js').socketService | null = null;

async function getSocketService() {
    if (_socketService === null) {
        try {
            const mod = await import('../server/SocketService.js');
            _socketService = mod.socketService;
        } catch {
            _socketService = undefined as any;
        }
    }
    return _socketService ?? null;
}

export type AgentStatusType = 'idle' | 'working' | 'error';

/** Log info to console and broadcast to Mission Control dashboard. */
export function logInfo(source: string, message: string): void {
    const full = source ? `[${source}] ${message}` : message;
    console.log(full);
    getSocketService().then((svc) => {
        if (svc?.isReady()) svc.broadcastLog(message, 'info', source);
    }).catch(() => {});
}

/** Log error to console and broadcast to Mission Control dashboard. */
export function logError(source: string, message: string): void {
    const full = source ? `[${source}] ${message}` : message;
    console.error(full);
    getSocketService().then((svc) => {
        if (svc?.isReady()) svc.broadcastLog(message, 'error', source);
    }).catch(() => {});
}

/** Log warning to console and broadcast to Mission Control dashboard. */
export function logWarn(source: string, message: string): void {
    const full = source ? `[${source}] ${message}` : message;
    console.warn(full);
    getSocketService().then((svc) => {
        if (svc?.isReady()) svc.broadcastLog(message, 'info', source); // 'warn' not in LogType, use 'info'
    }).catch(() => {});
}

/** Update agent status on Mission Control dashboard. */
export function setAgentStatus(
    agentName: string,
    status: AgentStatusType,
    taskDescription?: string
): void {
    getSocketService().then((svc) => {
        if (svc?.isReady()) svc.updateAgentStatus(agentName, status, taskDescription);
    }).catch(() => {});
}