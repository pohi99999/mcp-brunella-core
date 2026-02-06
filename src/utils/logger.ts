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

export const logInfo = (category: string, message: string) => {
    return systemLogger.info(`[${category}] ${message}`);
};

export const logError = (category: string, message: string) => {
    return systemLogger.error(`[${category}] ${message}`);
};

export const setAgentStatus = (agent: string, status: string, details?: string) => {
    return systemLogger.info(`[STATUS] Agent ${agent} is now ${status}${details ? `: ${details}` : ''}`);
};