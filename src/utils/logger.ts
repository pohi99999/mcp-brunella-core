import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

export class Logger {
    private logFile: string;
    private useStructuredLogging: boolean;

    constructor(filename: string, useStructuredLogging: boolean = true) {
        this.logFile = path.join(config.systemLogDir, filename);
        this.useStructuredLogging = useStructuredLogging || process.env.STRUCTURED_LOGGING !== '0';
    }

    private async writeLog(entry: LogEntry) {
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            
            if (this.useStructuredLogging) {
                // JSON structured logging
                const jsonEntry = JSON.stringify(entry) + '\n';
                await fs.appendFile(this.logFile, jsonEntry);
            } else {
                // Plain text logging (backward compatible)
                const timestamp = entry.timestamp;
                const metaStr = entry.meta ? ' ' + JSON.stringify(entry.meta) : '';
                const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';
                const logEntry = `[${timestamp}] [${entry.level}] ${entry.message}${metaStr}${errorStr}\n`;
                await fs.appendFile(this.logFile, logEntry);
            }
        } catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }

    async log(message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.INFO,
            message,
            meta
        };
        await this.writeLog(entry);
    }

    async debug(message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.DEBUG,
            message,
            meta
        };
        await this.writeLog(entry);
    }

    async warn(message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.WARN,
            message,
            meta
        };
        await this.writeLog(entry);
    }

    async error(message: string, error?: Error, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.ERROR,
            message,
            meta,
            error: error ? {
                message: error.message,
                stack: error.stack
            } : undefined
        };
        await this.writeLog(entry);
    }
}

export const systemLogger = new Logger('system_commands.log');
export const cliLogger = new Logger('cli_tools.log');
