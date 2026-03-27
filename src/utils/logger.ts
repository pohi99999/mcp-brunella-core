// src/utils/logger.ts

import { EventEmitter } from 'events';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// In a real app, this would come from env vars
const CURRENT_LOG_LEVEL = 'debug';

function getTimestamp(): string {
  return new Date().toISOString();
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | string;
export type LogEvent = Record<string, any>;
export type AgentStatusEvent = Record<string, any>;

export const logEmitter = new EventEmitter();

function emitLog(level: LogLevel, message: string, details?: any) {
  const event: LogEvent = { timestamp: getTimestamp(), level, message, details };
  try {
    logEmitter.emit('log', event);
  } catch (e) {
    // best effort
  }
}

export function logError(message: string, ...args: any[]) {
  if (LOG_LEVELS.error <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.error(`[${getTimestamp()}] [ERROR]`, message, ...args);
    emitLog('error', String(message), args.length ? args : undefined);
  }
}

export function logWarn(message: string, ...args: any[]) {
  if (LOG_LEVELS.warn <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.warn(`[${getTimestamp()}] [WARN]`, message, ...args);
    emitLog('warn', String(message), args.length ? args : undefined);
  }
}

export function logInfo(message: string, ...args: any[]) {
  if (LOG_LEVELS.info <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.log(`[${getTimestamp()}] [INFO]`, message, ...args);
    emitLog('info', String(message), args.length ? args : undefined);
  }
}

export function logDebug(message: string, ...args: any[]) {
  if (LOG_LEVELS.debug <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.debug(`[${getTimestamp()}] [DEBUG]`, message, ...args);
    emitLog('debug', String(message), args.length ? args : undefined);
  }
}

export function setAgentStatus(agentName: string, status: string, message?: string) {
  const ev: AgentStatusEvent = { agentName, status, message, timestamp: getTimestamp() };
  try {
    logEmitter.emit('agentStatus', ev);
  } catch (e) {
    // ignore
  }
  logInfo(`[AgentStatus] ${agentName} -> ${status} ${message ?? ''}`);
}

export class Logger {
  prefix: string;
  constructor(prefix = '') {
    this.prefix = prefix;
  }
  info(msg: string, ...args: any[]) { logInfo(`${this.prefix} ${msg}`, ...args); }
  warn(msg: string, ...args: any[]) { logWarn(`${this.prefix} ${msg}`, ...args); }
  error(msg: string, ...args: any[]) { logError(`${this.prefix} ${msg}`, ...args); }
  debug(msg: string, ...args: any[]) { logDebug(`${this.prefix} ${msg}`, ...args); }
  async log(msg: string, meta?: any) { logInfo(`${this.prefix} ${msg}`, meta); return Promise.resolve(); }
  structured(level: LogLevel, msg: string, meta?: any) { emitLog(level, `${this.prefix} ${msg}`, meta); }
}

export const cliLogger = {
  info: async (m: string, ...a: any[]) => { logInfo(m, ...a); return Promise.resolve(); },
  warn: async (m: string, ...a: any[]) => { logWarn(m, ...a); return Promise.resolve(); },
  error: async (m: string, ...a: any[]) => { logError(m, ...a); return Promise.resolve(); },
  debug: async (m: string, ...a: any[]) => { logDebug(m, ...a); return Promise.resolve(); },
  log: async (m: string, meta?: any) => { logInfo(m, meta); return Promise.resolve(); },
  structured: async (level: LogLevel, m: string, meta?: any) => { emitLog(level, m, meta); return Promise.resolve(); }
};
