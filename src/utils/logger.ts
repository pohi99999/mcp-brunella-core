import path from 'path';
import { config } from '../config/index.js';

export class Logger {
    private logFile: string;

    constructor(filename: string) {
        this.logFile = path.join(config.systemLogDir, filename);
    }

    private async writeToFile(content: string) {
        try {
            // Dynamic import to avoid bundling fs in non-Node environments (e.g. Cloudflare Workers)
            const fs = await import('fs/promises');
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            await fs.appendFile(this.logFile, content);
        } catch (error) {
            // Fallback to console in environments where fs is unavailable or fails
            // console.warn(`Logger: Failed to write to file (using console fallback):`, error);
        }
    }

    async log(message: string, meta?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;

        // Always log to console for visibility
        console.log(logEntry.trim());

        await this.writeToFile(logEntry);
    }

    /** Structured JSON log: { level, timestamp, message, requestId?, ...meta } */
    async structured(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
        const entry = { level, timestamp: new Date().toISOString(), message, ...meta };
        const line = JSON.stringify(entry) + '\n';

        // Always log to console
        if (level === 'error') console.error(JSON.stringify(entry));
        else if (level === 'warn') console.warn(JSON.stringify(entry));
        else console.log(JSON.stringify(entry));

        await this.writeToFile(line);
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
