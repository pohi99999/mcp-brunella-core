import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
export class Logger {
    logFile;
    constructor(filename) {
        this.logFile = path.join(config.systemLogDir, filename);
    }
    async log(message, meta) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
        try {
            // Ensure logs directory exists (redundant if ensured at startup but safe)
            await fs.mkdir(path.dirname(this.logFile), { recursive: true });
            await fs.appendFile(this.logFile, logEntry);
        }
        catch (error) {
            console.error(`Failed to write to log file: ${this.logFile}`, error);
        }
    }
}
export const systemLogger = new Logger('system_commands.log');
export const cliLogger = new Logger('cli_tools.log');
