// src/utils/logger.ts

import { EventEmitter } from 'events';
import { ensureError } from './ensureError.js';

export const EventEmitterClass = EventEmitter;
export const logEmitter = new EventEmitter();

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  success: 2,
  info: 3,
  debug: 4,
};

// In a real app, this would come from env or config
const CURRENT_LOG_LEVEL = 4; // debug

export type LogLevel = keyof typeof LOG_LEVELS;

export type LogEvent = {
  level: LogLevel;
  message: string;
  meta?: any;
  timestamp: string;
  agent?: string;
  source?: string;
};

export type AgentStatusEvent = {
  agentName: string;
  status: string;
  taskDescription?: string;
  message?: string;
  timestamp: number;
};

function emitLog(level: LogLevel, message: string, meta?: any) {
  const agent = meta?.agent || (typeof meta === 'string' ? meta : undefined);
  const source = meta?.source || 'System';

  logEmitter.emit('log', {
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
    agent,
    source
  } as LogEvent);

  if (LOG_LEVELS[level] <= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const metaStr = meta && typeof meta !== 'string' ? ` ${JSON.stringify(meta)}` : (meta ? ` ${meta}` : '');
    const output = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }
}

export function logSuccess(contextOrMsg: string, message?: any, meta?: unknown) {
  const ctx = message !== undefined ? contextOrMsg : 'System';
  const msg = message !== undefined ? message : contextOrMsg;
  emitLog('success', `${ctx}: ${msg}`, meta);
}

export function logError(contextOrMsg: string, message?: any, error?: unknown) {
  const ctx = message !== undefined ? contextOrMsg : 'System';
  const msg = message !== undefined ? message : contextOrMsg;
  const err = error ? ensureError(error) : (typeof msg !== 'string' ? ensureError(msg) : undefined);
  
  emitLog('error', `${ctx}: ${typeof msg === 'string' ? msg : 'Error'}`, err ? { 
    message: err.message, 
    stack: err.stack,
    name: err.name
  } : undefined);
}

export function logWarn(contextOrMsg: string, message?: any, meta?: unknown) {
  const ctx = message !== undefined ? contextOrMsg : 'System';
  const msg = message !== undefined ? message : contextOrMsg;
  emitLog('warn', `${ctx}: ${msg}`, meta);
}

export function logInfo(contextOrMsg: string, message?: any, meta?: unknown) {
  const ctx = message !== undefined ? contextOrMsg : 'System';
  const msg = message !== undefined ? message : contextOrMsg;
  emitLog('info', `${ctx}: ${msg}`, meta);
}

export function logDebug(contextOrMsg: string, message?: any, meta?: unknown) {
  const ctx = message !== undefined ? contextOrMsg : 'System';
  const msg = message !== undefined ? message : contextOrMsg;
  emitLog('debug', `${ctx}: ${msg}`, meta);
}

export class Logger {
  constructor(private context: string) {}

  error(message: string, error?: unknown) {
    logError(this.context, message, error);
  }

  warn(message: string, meta?: unknown) {
    logWarn(this.context, message, meta);
  }

  success(message: string, meta?: unknown) {
    logSuccess(this.context, message, meta);
  }

  info(message: string, meta?: unknown) {
    logInfo(this.context, message, meta);
  }

  debug(message: string, meta?: unknown) {
    logDebug(this.context, message, meta);
  }

  log(message: string, meta?: unknown) {
    logInfo(this.context, message, meta);
  }

  structured(level: LogLevel, message: string, meta?: unknown) {
    emitLog(level, `${this.context}: ${message}`, meta);
  }
}

export function setAgentStatus(agentName: string, status: string, taskDescription?: string, message?: string) {
  logEmitter.emit('agent:update', {
    agentName,
    status,
    taskDescription,
    message,
    timestamp: Date.now()
  } as AgentStatusEvent);
}

/**
 * Unified Logger interface for both Node and Browser
 */
export const logger = {
  error: async (m: string, error?: unknown) => { logError('System', m, error); return Promise.resolve(); },
  warn: async (m: string, meta?: unknown) => { logWarn('System', m, meta); return Promise.resolve(); },
  success: async (m: string, meta?: unknown) => { logSuccess('System', m, meta); return Promise.resolve(); },
  info: async (m: string, meta?: unknown) => { logInfo('System', m, meta); return Promise.resolve(); },
  debug: async (m: string, meta?: unknown) => { logDebug('System', m, meta); return Promise.resolve(); },
  log: async (m: string, meta?: unknown) => { logInfo('System', m, meta); return Promise.resolve(); },
  structured: async (level: LogLevel, m: string, meta?: unknown) => { emitLog(level, m, meta); return Promise.resolve(); }
};

export const cliLogger = logger;
