type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const AGENT_NAME = "research-agent";

function formatMessage(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${AGENT_NAME}] [${level.toUpperCase()}] ${message}${suffix}`;
}

export function logInfo(message: string, context?: LogContext) {
  console.info(formatMessage("info", message, context));
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(formatMessage("warn", message, context));
}

export function logError(message: string, context?: LogContext) {
  console.error(formatMessage("error", message, context));
}