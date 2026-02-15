/**
 * Frontend Logger Wrapper
 * Provides console-based logging for dashboard components
 * (Backend logger.ts is Node.js-only and unavailable in browser)
 */

const LOG_COLORS = {
  INFO: '#0ea5e9',    // cyan
  ERROR: '#ef4444',   // red
  WARN: '#f59e0b',    // amber
  DEBUG: '#8b5cf6',   // purple
};

function formatTime(): string {
  return new Date().toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

export function logInfo(component: string, message: string): void {
  console.log(
    `%c[${formatTime()}] ${component}: ${message}`,
    `color: ${LOG_COLORS.INFO}; font-weight: bold;`
  );
}

export function logError(component: string, message: string): void {
  console.error(
    `%c[${formatTime()}] ❌ ${component}: ${message}`,
    `color: ${LOG_COLORS.ERROR}; font-weight: bold;`
  );
}

export function logWarn(component: string, message: string): void {
  console.warn(
    `%c[${formatTime()}] ⚠️ ${component}: ${message}`,
    `color: ${LOG_COLORS.WARN}; font-weight: bold;`
  );
}

export function logDebug(component: string, message: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(
      `%c[${formatTime()}] 🐛 ${component}: ${message}`,
      `color: ${LOG_COLORS.DEBUG}; font-weight: bold;`
    );
  }
}
