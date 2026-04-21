/**
 * Logging Utility for Grant Monitor Worker
 * Provides structured logging with timestamps and levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private context: string;
  private level: LogLevel;

  constructor(context: string = 'GrantMonitor', level: LogLevel = 'info') {
    this.context = context;
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.level];
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog('error')) {
      const data = error instanceof Error ? { message: error.message, stack: error.stack } : error;
      console.error(this.formatMessage('error', message, data));
    }
  }
}

export { Logger, LogLevel };
