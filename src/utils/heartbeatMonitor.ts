/**
 * Phoenix Protocol v2 - Heartbeat Monitor
 *
 * Continuously monitors critical services (Ollama, FastAPI, Dashboard, Python Shell)
 * with configurable interval, timeout, and retry logic. Triggers recovery callbacks
 * on service failure.
 *
 * @version 1.0.0
 */

import { logInfo, logWarn, logError } from './logger.js';
import { phoenixEventBus } from '../core/phoenixEventBus.js';
import { degradationPolicy } from './degradationPolicy.js';

// ============================================================================
// CONFIG
// ============================================================================

export interface HeartbeatConfig {
  /** Check interval in milliseconds (default: 5000ms = 5s) */
  intervalMs: number;
  /** Request timeout in milliseconds (default: 10000ms = 10s) */
  timeoutMs: number;
  /** Max retries before marking service as unhealthy (default: 3) */
  maxRetries: number;
  /** Enable heartbeat monitoring (default: true) */
  enabled: boolean;
  /** Suppress startup failures for a short warmup window */
  startupGraceMs: number;
}

export interface ServiceConfig {
  name: string;
  /** Health check URL or function */
  healthCheck: string | (() => Promise<boolean>);
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Critical = system cannot function without it */
  critical: boolean;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: Number(process.env.PHOENIX_HEARTBEAT_INTERVAL) || 5000,
  timeoutMs: Number(process.env.PHOENIX_HEARTBEAT_TIMEOUT) || 10000,
  maxRetries: Number(process.env.PHOENIX_MAX_RETRIES) || 3,
  enabled: process.env.PHOENIX_HEARTBEAT_ENABLED !== 'false',
  startupGraceMs: Number(process.env.PHOENIX_STARTUP_GRACE_MS) || 15000,
};

const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    name: 'ollama',
    healthCheck: `${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}/api/tags`,
    timeoutMs: 5000,
    critical: true,
  },
  {
    name: 'fastapi',
    healthCheck: `${process.env.PYTHON_API_URL || 'http://127.0.0.1:8000'}/health`,
    timeoutMs: 3000,
    critical: true,
  },
  {
    name: 'dashboard',
    healthCheck: `http://localhost:${process.env.PORT || 3000}/api/health`,
    timeoutMs: 3000,
    critical: false,
  },
];

// ============================================================================
// TYPES
// ============================================================================

export type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded' | 'checking';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  lastCheck: Date;
  lastSuccess: Date | null;
  consecutiveFailures: number;
  latencyMs: number | null;
  error: string | null;
}

export type FailureHandler = (service: ServiceHealth) => void | Promise<void>;

// ============================================================================
// HEARTBEAT MONITOR
// ============================================================================

class HeartbeatMonitorClass {
  private config: HeartbeatConfig = DEFAULT_CONFIG;
  private services: Map<string, ServiceHealth> = new Map();
  private intervalHandle: NodeJS.Timeout | null = null;
  private failureHandlers: Map<string, FailureHandler[]> = new Map();
  private isRunning = false;
  private isCheckRunning = false;
  private startedAt = 0;

  constructor() {
    // Initialize service health records
    for (const svc of DEFAULT_SERVICES) {
      this.services.set(svc.name, {
        name: svc.name,
        status: 'checking',
        lastCheck: new Date(),
        lastSuccess: null,
        consecutiveFailures: 0,
        latencyMs: null,
        error: null,
      });
    }
  }

  /**
   * Start the heartbeat monitor.
   */
  start(customConfig?: Partial<HeartbeatConfig>): void {
    if (this.isRunning) {
      logWarn('HeartbeatMonitor', 'Already running');
      return;
    }

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    if (!this.config.enabled) {
      logInfo('HeartbeatMonitor', 'Disabled via config');
      return;
    }

    this.isRunning = true;
    this.startedAt = Date.now();
    logInfo('HeartbeatMonitor', `Started (interval: ${this.config.intervalMs}ms, timeout: ${this.config.timeoutMs}ms)`);

    // Initial check
    void this.runChecks();

    // Schedule periodic checks
    this.intervalHandle = setInterval(() => {
      void this.runChecks();
    }, this.config.intervalMs);
  }

  /**
   * Stop the heartbeat monitor.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    logInfo('HeartbeatMonitor', 'Stopped');
  }

  /**
   * Check all registered services.
   */
  private async checkAllServices(): Promise<void> {
    const checks = DEFAULT_SERVICES.map((svc) => this.checkService(svc));
    await Promise.all(checks);

    // Assess system degradation after all checks complete
    const overall = this.getOverallHealth();
    degradationPolicy.assessDegradation(overall.unhealthyServices);
  }

  private async runChecks(): Promise<void> {
    if (this.isCheckRunning) {
      return;
    }

    this.isCheckRunning = true;
    try {
      await this.checkAllServices();
    } finally {
      this.isCheckRunning = false;
    }
  }

  /**
   * Check a single service health.
   */
  private async checkService(config: ServiceConfig): Promise<void> {
    const health = this.services.get(config.name);
    if (!health) return;
    const previousStatus = health.status;
    const inStartupGrace = Date.now() - this.startedAt < this.config.startupGraceMs;

    const startTime = Date.now();
    let success = false;
    let errorMsg: string | null = null;

    try {
      if (typeof config.healthCheck === 'string') {
        // HTTP health check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
          const res = await fetch(config.healthCheck, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          success = res.ok;
          if (!success) {
            errorMsg = `HTTP ${res.status}`;
          }
        } catch (e: unknown) {
          clearTimeout(timeoutId);
          const error = e instanceof Error ? e.message : String(e);
          errorMsg = error;
        }
      } else {
        // Function-based health check
        success = await config.healthCheck();
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      errorMsg = error;
    }

    const latencyMs = Date.now() - startTime;

    // Update health record
    health.lastCheck = new Date();
    health.latencyMs = latencyMs;
    health.error = errorMsg;

    if (success) {
      health.status = 'healthy';
      health.lastSuccess = new Date();
      health.consecutiveFailures = 0;
      if (previousStatus === 'degraded' || previousStatus === 'unhealthy') {
        logInfo('HeartbeatMonitor', `${config.name} recovered`);
        phoenixEventBus.publish('phoenix:recovery', {
          type: 'restart',
          agent: config.name,
          details: `Service recovered: ${config.name}`,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      if (inStartupGrace && health.lastSuccess === null) {
        health.status = 'checking';
        health.error = errorMsg;
        this.services.set(config.name, health);
        return;
      }

      health.consecutiveFailures++;

      if (health.consecutiveFailures >= this.config.maxRetries) {
        health.status = 'unhealthy';
        if (previousStatus !== 'unhealthy') {
          logError('HeartbeatMonitor', `${config.name} unhealthy after ${health.consecutiveFailures} failures: ${errorMsg}`);

          // Trigger failure handlers only on transition into unhealthy state.
          await this.triggerFailureHandlers(health);

          // Publish degraded event once when the service becomes unhealthy.
          phoenixEventBus.publish('phoenix:degraded', {
            level: config.critical ? 'partial' : 'minimal',
            services: [config.name],
            message: `Service unhealthy: ${config.name}${errorMsg ? ` — ${errorMsg}` : ''}`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        health.status = 'degraded';
        if (previousStatus !== 'degraded') {
          logWarn('HeartbeatMonitor', `${config.name} degraded (${health.consecutiveFailures}/${this.config.maxRetries}): ${errorMsg}`);
        }
      }
    }

    this.services.set(config.name, health);
  }

  /**
   * Register a failure handler for a specific service.
   */
  onFailure(serviceName: string, handler: FailureHandler): void {
    const handlers = this.failureHandlers.get(serviceName) || [];
    handlers.push(handler);
    this.failureHandlers.set(serviceName, handlers);
    logInfo('HeartbeatMonitor', `Registered failure handler for ${serviceName}`);
  }

  /**
   * Trigger all failure handlers for a service.
   */
  private async triggerFailureHandlers(health: ServiceHealth): Promise<void> {
    const handlers = this.failureHandlers.get(health.name) || [];
    for (const handler of handlers) {
      try {
        await handler(health);
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        logError('HeartbeatMonitor', `Failure handler error for ${health.name}: ${error}`);
      }
    }
  }

  /**
   * Get current health status of all services.
   */
  getStatus(): Map<string, ServiceHealth> {
    return new Map(this.services);
  }

  /**
   * Get health status of a specific service.
   */
  getServiceStatus(name: string): ServiceHealth | undefined {
    return this.services.get(name);
  }

  /**
   * Get overall system health.
   */
  getOverallHealth(): { status: ServiceStatus; unhealthyServices: string[] } {
    const statuses = Array.from(this.services.values());
    const unhealthy = statuses.filter((s) => s.status === 'unhealthy');
    const degraded = statuses.filter((s) => s.status === 'degraded');

    let status: ServiceStatus = 'healthy';
    if (unhealthy.length > 0) {
      status = 'unhealthy';
    } else if (degraded.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      unhealthyServices: unhealthy.map((s) => s.name),
    };
  }

  getAggregatedHealth(): {
    status: ServiceStatus;
    services: { name: string; status: ServiceStatus; error: string | null; latencyMs: number | null; }[];
    timestamp: string;
  } {
    const overall = this.getOverallHealth();
    const detailedServices = Array.from(this.services.values()).map(svc => ({
      name: svc.name,
      status: svc.status,
      error: svc.error,
      latencyMs: svc.latencyMs,
    }));

    return {
      status: overall.status,
      services: detailedServices,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually trigger a health check for a specific service.
   */
  async checkNow(serviceName: string): Promise<ServiceHealth | undefined> {
    const config = DEFAULT_SERVICES.find((s) => s.name === serviceName);
    if (!config) {
      logError('HeartbeatMonitor', `Service ${serviceName} not found`);
      return undefined;
    }
    await this.checkService(config);
    return this.services.get(serviceName);
  }

  /**
   * Reset failure count for a service (useful after manual recovery).
   */
  resetFailures(serviceName: string): void {
    const health = this.services.get(serviceName);
    if (health) {
      health.consecutiveFailures = 0;
      health.status = 'checking';
      health.error = null;
      this.services.set(serviceName, health);
      logInfo('HeartbeatMonitor', `Reset failures for ${serviceName}`);
    }
  }

  /**
   * Check if the monitor is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const heartbeatMonitor = new HeartbeatMonitorClass();
export default heartbeatMonitor;
