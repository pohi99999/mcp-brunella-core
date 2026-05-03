import { EventEmitter } from 'events';
import { ensureError } from './ensureError.js';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const CURRENT_LOG_LEVEL = 'debug';

function getTimestamp() {
  return new Date().toISOString();
}

export const logEmitter = new EventEmitter();

function emitLog(level, message, details, agent) {
  const event = {
    timestamp: getTimestamp(),
    level,
    message,
    source: typeof agent === 'string' && agent.trim() ? agent : message,
    agent: typeof agent === 'string' ? agent : undefined,
    details,
  };
  try {
    logEmitter.emit('log', event);
  } catch (error) {
    const normalized = ensureError(error);
    console.warn(`[${getTimestamp()}] [WARN]`, `Logger emit failed: ${normalized.message}`);
  }
}

export function logError(message, details, agent) {
  if (LOG_LEVELS.error <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.error(`[${getTimestamp()}] [ERROR]`, message, details || '');
    emitLog('error', String(message), details, agent);
  }
}

export function logWarn(message, details, agent) {
  if (LOG_LEVELS.warn <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.warn(`[${getTimestamp()}] [WARN]`, message, details || '');
    emitLog('warn', String(message), details, agent);
  }
}

export function logInfo(message, details, agent) {
  if (LOG_LEVELS.info <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.info(`[${getTimestamp()}] [INFO]`, message, details || '');
    emitLog('info', String(message), details, agent);
  }
}

export function logDebug(message, details, agent) {
  if (LOG_LEVELS.debug <= LOG_LEVELS[CURRENT_LOG_LEVEL]) {
    console.debug(`[${getTimestamp()}] [DEBUG]`, message, details || '');
    emitLog('debug', String(message), details, agent);
  }
}

export function setAgentStatus(agentName, status, message) {
  const ev = {
    agentName,
    agent: agentName,
    status,
    message,
    task: message,
    timestamp: getTimestamp(),
  };
  try {
    logEmitter.emit('agentStatus', ev);
  } catch (error) {
    const normalized = ensureError(error);
    console.warn(`[${getTimestamp()}] [WARN]`, `[AgentStatus] emit failed for ${agentName}: ${normalized.message}`);
  }
  logInfo(`[AgentStatus] ${agentName} -> ${status} ${message ?? ''}`);
}

export class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
  }
  info(msg, ...args) { logInfo(`${this.prefix} ${msg}`, ...args); }
  warn(msg, ...args) { logWarn(`${this.prefix} ${msg}`, ...args); }
  error(msg, ...args) { logError(`${this.prefix} ${msg}`, ...args); }
  debug(msg, ...args) { logDebug(`${this.prefix} ${msg}`, ...args); }
  async log(msg, meta) { logInfo(`${this.prefix} ${msg}`, meta); return Promise.resolve(); }
  structured(level, msg, meta) { emitLog(level, `${this.prefix} ${msg}`, meta); }
}

export const cliLogger = {
  info: async (m, ...a) => { logInfo(m, ...a); return Promise.resolve(); },
  warn: async (m, ...a) => { logWarn(m, ...a); return Promise.resolve(); },
  error: async (m, ...a) => { logError(m, ...a); return Promise.resolve(); },
  debug: async (m, ...a) => { logDebug(m, ...a); return Promise.resolve(); },
  log: async (m, meta) => { logInfo(m, meta); return Promise.resolve(); },
  structured: async (level, m, meta) => { emitLog(level, m, meta); return Promise.resolve(); },
};
