import { EventEmitter } from "events";

// Dynamic imports for Node.js-specific modules (Worker compatibility)
let fs: typeof import("fs/promises") | null = null;
let path: typeof import("path") | null = null;

export type LogLevel = "info" | "warn" | "error" | "success";

export interface LogEvent {
  level: LogLevel;
  message: string;
  timestamp: string;
  agent?: string;
  source?: string;
}

export interface AgentStatusEvent {
  agent: string;
  status: string;
  task?: string;
  timestamp: string;
}

export const logEmitter = new EventEmitter();

async function ensureNodeModules() {
  if (typeof process !== "undefined" && process.versions?.node) {
    if (!fs) fs = await import("fs/promises");
    if (!path) path = await import("path");
  }
}

export class Logger {
  private logFile: string;

  constructor(filename: string) {
    // Lazy init - will use config when available
    this.logFile = filename;
  }

  async log(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${meta ? JSON.stringify(meta) : ""}\n`;

    try {
      await ensureNodeModules();
      if (!fs || !path) {
        // Fallback to console in Worker environments
        console.log(logEntry.trim());
        return;
      }

      const { config } = await import("../config/index.js");
      const fullPath = path.join(config.systemLogDir, this.logFile);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, logEntry);
    } catch (error) {
      console.error(`Failed to write to log file: ${this.logFile}`, error);
    }
  }

  /** Structured JSON log: { level, timestamp, message, requestId?, ...meta } */
  async structured(
    level: "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>,
  ) {
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...meta,
    };
    const line = JSON.stringify(entry) + "\n";

    try {
      await ensureNodeModules();
      if (!fs || !path) {
        // Fallback to console in Worker environments
        console.log(line.trim());
        return;
      }

      const { config } = await import("../config/index.js");
      const fullPath = path.join(config.systemLogDir, this.logFile);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, line);
    } catch (error) {
      console.error(`Failed to write to log file: ${this.logFile}`, error);
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

export const systemLogger = new Logger("system_commands.log");
export const cliLogger = new Logger("cli_tools.log");

// Simple helper functions for quick logging (exported for agent use)
export function logInfo(agent: string, message: string) {
  if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
    console.log(`[INFO] [${agent}] ${message}`);
  }
  logEmitter.emit("log", {
    level: "info",
    message,
    timestamp: new Date().toISOString(),
    agent,
  } satisfies LogEvent);
}

export function logError(agent: string, message: string) {
  if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
    console.error(`[ERROR] [${agent}] ${message}`);
  }
  logEmitter.emit("log", {
    level: "error",
    message,
    timestamp: new Date().toISOString(),
    agent,
  } satisfies LogEvent);
}

export function logWarn(agent: string, message: string) {
  if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
    console.warn(`[WARN] [${agent}] ${message}`);
  }
  logEmitter.emit("log", {
    level: "warn",
    message,
    timestamp: new Date().toISOString(),
    agent,
  } satisfies LogEvent);
}

export function setAgentStatus(agent: string, status: string, task?: string) {
  const statusMsg = task ? `${status} - ${task}` : status;
  if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
    console.log(`[STATUS] [${agent}] ${statusMsg}`);
  }
  logEmitter.emit("agent_status", {
    agent,
    status,
    task,
    timestamp: new Date().toISOString(),
  } satisfies AgentStatusEvent);
}
