// src/utils/logger.ts

import { EventEmitter } from 'events';
import { ensureError } from './ensureError.js';

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
export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  agent?: string;
  details?: unknown;
}

export interface AgentStatusEvent {
  agentName: string;
  status: string;
  message?: string;
  timestamp: string;
  agent?: string;
  task?: string;
}

export const logEmitter = new EventEmitter();

function emitLog(level: LogLevel, message: string, details?: unknown) {
  const event: LogEvent = { timestamp: getTimestamp(), level, message, source: message, details };
  try {
    logEmitter.emit('log', event);
  } catch (error: unknown) {
    const normalized = ensureError(error);
    console.warn(`[${getTimestamp()}] [WARN]`, `Logger emit failed: ${normalized.message}`);
  }
}

export function logError(message: string, ...args: unknown[]) {
  if (LOG_LEVELS.error <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.error(`[${getTimestamp()}] [ERROR]`, message, ...args);
    emitLog('error', String(message), args.length ? args : undefined);
  }
}

export function logWarn(message: string, ...args: unknown[]) {
  if (LOG_LEVELS.warn <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.warn(`[${getTimestamp()}] [WARN]`, message, ...args);
    emitLog('warn', String(message), args.length ? args : undefined);
  }
}

export function logInfo(message: string, ...args: unknown[]) {
  if (LOG_LEVELS.info <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.info(`[${getTimestamp()}] [INFO]`, message, ...args);
    emitLog('info', String(message), args.length ? args : undefined);
  }
}

export function logDebug(message: string, ...args: unknown[]) {
  if (LOG_LEVELS.debug <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.debug(`[${getTimestamp()}] [DEBUG]`, message, ...args);
    emitLog('debug', String(message), args.length ? args : undefined);
  }
}

export function setAgentStatus(agentName: string, status: string, message?: string) {
  const ev: AgentStatusEvent = {
    agentName,
    agent: agentName,
    status,
    message,
    task: message,
    timestamp: getTimestamp(),
  };
  try {
    logEmitter.emit('agentStatus', ev);
  } catch (error: unknown) {
    const normalized = ensureError(error);
    console.warn(`[${getTimestamp()}] [WARN]`, `[AgentStatus] emit failed for ${agentName}: ${normalized.message}`);
  }
  logInfo(`[AgentStatus] ${agentName} -> ${status} ${message ?? ''}`);
}

export class Logger {
  prefix: string;
  constructor(prefix = '') {
    this.prefix = prefix;
  }
  info(msg: string, ...args: unknown[]) { logInfo(`${this.prefix} ${msg}`, ...args); }
  warn(msg: string, ...args: unknown[]) { logWarn(`${this.prefix} ${msg}`, ...args); }
  error(msg: string, ...args: unknown[]) { logError(`${this.prefix} ${msg}`, ...args); }
  debug(msg: string, ...args: unknown[]) { logDebug(`${this.prefix} ${msg}`, ...args); }
  async log(msg: string, meta?: unknown) { logInfo(`${this.prefix} ${msg}`, meta); return Promise.resolve(); }
  structured(level: LogLevel, msg: string, meta?: unknown) { emitLog(level, `${this.prefix} ${msg}`, meta); }
}

export const cliLogger = {
  info: async (m: string, ...a: unknown[]) => { logInfo(m, ...a); return Promise.resolve(); },
  warn: async (m: string, ...a: unknown[]) => { logWarn(m, ...a); return Promise.resolve(); },
  error: async (m: string, ...a: unknown[]) => { logError(m, ...a); return Promise.resolve(); },
  debug: async (m: string, ...a: unknown[]) => { logDebug(m, ...a); return Promise.resolve(); },
  log: async (m: string, meta?: unknown) => { logInfo(m, meta); return Promise.resolve(); },
  structured: async (level: LogLevel, m: string, meta?: unknown) => { emitLog(level, m, meta); return Promise.resolve(); }
};
