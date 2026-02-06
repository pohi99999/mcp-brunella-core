import { config } from '../config/index.js';

export class Logger {
    private logFile: string;

    constructor(filename: string) {
        // Delay path.join until needed, or use string concatenation if path module is unavailable
        this.logFile = filename;
    }

    async log(message: string, meta?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;

        try {
            // Dynamic import to avoid build errors in non-Node environments (e.g. Cloudflare Workers)
            const fs = await import('fs/promises');
            const path = await import('path');
            const fullPath = path.join(config.systemLogDir, this.logFile);

            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.appendFile(fullPath, logEntry);
        } catch (error) {
            // Fallback to console in environments without filesystem access
            console.log(message, meta || '');
        }
    }

    /** Structured JSON log: { level, timestamp, message, requestId?, ...meta } */
    async structured(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
        const entry = { level, timestamp: new Date().toISOString(), message, ...meta };
        const line = JSON.stringify(entry) + '\n';

        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const fullPath = path.join(config.systemLogDir, this.logFile);

            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.appendFile(fullPath, line);
        } catch (error) {
             // Fallback to console in environments without filesystem access
             console.log(`[${level.toUpperCase()}] ${message}`, meta || '');
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
