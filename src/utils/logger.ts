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
export const logInfo = (source: string, message: string) => systemLogger.info(`[${source}] ${message}`);
export const logError = (source: string, message: string) => systemLogger.error(`[${source}] ${message}`);
export const setAgentStatus = (agentName: string, status: string, task?: string) =>
    systemLogger.structured('info', 'Agent Status Update', { agentName, status, task });
