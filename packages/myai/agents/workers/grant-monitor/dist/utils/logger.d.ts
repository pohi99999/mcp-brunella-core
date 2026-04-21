/**
 * Logging Utility for Grant Monitor Worker
 * Provides structured logging with timestamps and levels
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class Logger {
    private context;
    private level;
    constructor(context?: string, level?: LogLevel);
    private shouldLog;
    private formatMessage;
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error | any): void;
}
export { Logger, LogLevel };
