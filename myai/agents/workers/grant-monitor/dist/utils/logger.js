/**
 * Logging Utility for Grant Monitor Worker
 * Provides structured logging with timestamps and levels
 */
class Logger {
    context;
    level;
    constructor(context = 'GrantMonitor', level = 'info') {
        this.context = context;
        this.level = level;
    }
    shouldLog(level) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
        };
        return levels[level] >= levels[this.level];
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data)}`;
        }
        return `${prefix} ${message}`;
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }
    error(message, error) {
        if (this.shouldLog('error')) {
            const data = error instanceof Error ? { message: error.message, stack: error.stack } : error;
            console.error(this.formatMessage('error', message, data));
        }
    }
}
export { Logger };
