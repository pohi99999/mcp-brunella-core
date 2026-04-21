/**
 * Process Health Monitor — Gold Protocol Phoenix (RULE-PH3)
 *
 * Monitors external processes (Python shell, Ollama) and performs
 * silent restart on crash (max 3 attempts).
 *
 * @version 1.0.0
 */

import { logInfo, logWarn, logError } from '@packages/utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ProcessStatus = 'running' | 'stopped' | 'crashed' | 'restarting' | 'unknown';

export interface MonitoredProcess {
  name: string;
  status: ProcessStatus;
  pid?: number;
  restartCount: number;
  maxRestarts: number;
  lastChecked?: string;
  healthCheckFn: () => Promise<boolean>;
  restartFn: () => Promise<boolean>;
}

export interface ProcessHealthReport {
  processes: Array<{
    name: string;
    status: ProcessStatus;
    pid?: number;
    restartCount: number;
    lastChecked?: string;
  }>;
  overallHealthy: boolean;
}

// ---------------------------------------------------------------------------
// PROCESS MONITOR
// ---------------------------------------------------------------------------

export class ProcessMonitor {
  private processes: Map<string, MonitoredProcess> = new Map();
  private checkInterval?: ReturnType<typeof setInterval>;
  private readonly DEFAULT_MAX_RESTARTS = 3;
  private readonly CHECK_INTERVAL_MS = 30_000; // 30 seconds

  /**
   * Register a process to monitor.
   */
  register(
    name: string,
    healthCheckFn: () => Promise<boolean>,
    restartFn: () => Promise<boolean>,
    maxRestarts: number = this.DEFAULT_MAX_RESTARTS
  ): void {
    this.processes.set(name, {
      name,
      status: 'unknown',
      restartCount: 0,
      maxRestarts,
      healthCheckFn,
      restartFn
    });
    logInfo('ProcessMonitor', `Registered: ${name} (max restarts: ${maxRestarts})`);
  }

  /**
   * Remove a process from monitoring.
   */
  unregister(name: string): void {
    this.processes.delete(name);
  }

  /**
   * Check health of all registered processes.
   * Attempts silent restart on failure (RULE-PH3).
   */
  async checkAll(): Promise<ProcessHealthReport> {
    const report: ProcessHealthReport = { processes: [], overallHealthy: true };

    for (const [name, proc] of this.processes) {
      try {
        const healthy = await proc.healthCheckFn();
        proc.lastChecked = new Date().toISOString();

        if (healthy) {
          proc.status = 'running';
        } else {
          proc.status = 'crashed';
          report.overallHealthy = false;

          // Silent restart attempt (RULE-PH3)
          if (proc.restartCount < proc.maxRestarts) {
            await this.silentRestart(proc);
          } else {
            logError('ProcessMonitor', `${name}: Max restarts (${proc.maxRestarts}) exceeded — manual intervention needed`);
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logWarn('ProcessMonitor', `Health check failed for ${name}: ${msg}`);
        proc.status = 'unknown';
        proc.lastChecked = new Date().toISOString();
        report.overallHealthy = false;
      }

      report.processes.push({
        name: proc.name,
        status: proc.status,
        pid: proc.pid,
        restartCount: proc.restartCount,
        lastChecked: proc.lastChecked
      });
    }

    return report;
  }

  /**
   * Check health of a single process by name.
   */
  async checkOne(name: string): Promise<ProcessStatus> {
    const proc = this.processes.get(name);
    if (!proc) return 'unknown';

    try {
      const healthy = await proc.healthCheckFn();
      proc.lastChecked = new Date().toISOString();
      proc.status = healthy ? 'running' : 'crashed';
      return proc.status;
    } catch {
      proc.status = 'unknown';
      return 'unknown';
    }
  }

  /**
   * Attempt silent restart (RULE-PH3: max 3x).
   */
  private async silentRestart(proc: MonitoredProcess): Promise<boolean> {
    proc.status = 'restarting';
    proc.restartCount++;

    logWarn('ProcessMonitor', `Silent restart (${proc.name}) — attempt ${proc.restartCount}/${proc.maxRestarts}`);

    try {
      const success = await proc.restartFn();

      if (success) {
        proc.status = 'running';
        logInfo('ProcessMonitor', `${proc.name} restarted successfully`);
        return true;
      }

      proc.status = 'crashed';
      logError('ProcessMonitor', `${proc.name} restart failed`);
      return false;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      proc.status = 'crashed';
      logError('ProcessMonitor', `${proc.name} restart exception: ${msg}`);
      return false;
    }
  }

  /**
   * Start periodic health checks.
   */
  startMonitoring(intervalMs: number = this.CHECK_INTERVAL_MS): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(async () => {
      await this.checkAll();
    }, intervalMs);

    logInfo('ProcessMonitor', `Monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic health checks.
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      logInfo('ProcessMonitor', 'Monitoring stopped');
    }
  }

  /**
   * Get current health report (no active checks, last-known state).
   */
  getReport(): ProcessHealthReport {
    const processes = Array.from(this.processes.values()).map(p => ({
      name: p.name,
      status: p.status,
      pid: p.pid,
      restartCount: p.restartCount,
      lastChecked: p.lastChecked
    }));

    return {
      processes,
      overallHealthy: processes.every(p => p.status === 'running')
    };
  }

  /**
   * Reset restart count for a process (e.g., after manual fix).
   */
  resetRestartCount(name: string): void {
    const proc = this.processes.get(name);
    if (proc) {
      proc.restartCount = 0;
      logInfo('ProcessMonitor', `Restart count reset for ${name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// BUILT-IN HEALTH CHECK FACTORIES
// ---------------------------------------------------------------------------

/**
 * Create a health check for Ollama (HTTP /api/tags).
 */
export function createOllamaHealthCheck(baseUrl: string = 'http://localhost:11434'): () => Promise<boolean> {
  return async () => {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  };
}

/**
 * Create a health check for Python FastAPI server.
 */
export function createPythonHealthCheck(baseUrl: string = 'http://localhost:8000'): () => Promise<boolean> {
  return async () => {
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  };
}

// ---------------------------------------------------------------------------
// SINGLETON
// ---------------------------------------------------------------------------

export const processMonitor = new ProcessMonitor();

