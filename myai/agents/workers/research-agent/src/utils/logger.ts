type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const getLogStore = (): LogEntry[] => {
  const store = (globalThis as unknown as { __cean_logs?: LogEntry[] })
    .__cean_logs;
  if (store) {
    return store;
  }

  const created: LogEntry[] = [];
  (globalThis as unknown as { __cean_logs?: LogEntry[] }).__cean_logs = created;
  return created;
};

const writeLog = (
  level: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) => {
  getLogStore().push({
    level,
    scope,
    message,
    meta,
    timestamp: new Date().toISOString(),
  });
};

export const logInfo = (
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) => writeLog("info", scope, message, meta);

export const logWarn = (
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) => writeLog("warn", scope, message, meta);

export const logError = (
  scope: string,
  message: string,
  meta?: Record<string, unknown>,
) => writeLog("error", scope, message, meta);