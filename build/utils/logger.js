import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    logFile;
    useStructuredLogging;
    constructor(filename, useStructuredLogging = true) {
        this.logFile = path.join(config.systemLogDir, filename);
        this.useStructuredLogging = useStructuredLogging || process.env.STRUCTURED_LOGGING !== '0';
    }
    async writeLog(entry) {
        try {
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            if (this.useStructuredLogging) {
                // JSON structured logging
                const jsonEntry = JSON.stringify(entry) + '\n';
                await fs.appendFile(this.logFile, jsonEntry);
            }
            else {
                // Plain text logging (backward compatible)
                const timestamp = entry.timestamp;
                const metaStr = entry.meta ? ' ' + JSON.stringify(entry.meta) : '';
                const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';
                const logEntry = `[${timestamp}] [${entry.level}] ${entry.message}${metaStr}${errorStr}\n`;
                await fs.appendFile(this.logFile, logEntry);
            }
        }
        catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }
    async log(message, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.INFO,
            message,
            meta
        };
        await this.writeLog(entry);
    }
    async debug(message, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.DEBUG,
            message,
            meta
        };
        await this.writeLog(entry);
    }
    async warn(message, meta) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: LogLevel.WARN,
            message,
            meta
        };
        await this.writeLog(entry);
    }
    async error(message, error, meta) {
        const entry = {
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
