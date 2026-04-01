/**
 * EdgeHealthMonitor - Continuous Edge Health Monitoring
 *
 * Phoenix Protocol Szint 5: Proactive edge health monitoring with
 * event broadcasting and multi-step failover chain.
 *
 * Failover chain: edge → local → cloud → escalate
 *
 * @version 1.0.0
 */

import { logInfo, logError } from '../utils/logger.js';
import { phoenixEventBus } from './phoenixEventBus.js';

// ============================================================================
// INTERFACES
// ============================================================================

export type EdgeHealthStatus = 'healthy' | 'degraded' | 'offline';

export interface EdgeHealthSnapshot {
  status: EdgeHealthStatus;
  latencyMs: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastCheckAt: string;
}

interface HealthHistoryEntry {
  status: EdgeHealthStatus;
  latencyMs: number;
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PROBE_INTERVAL = 30_000; // 30s
const DEGRADED_LATENCY_THRESHOLD = 2000; // 2s
const OFFLINE_CONSECUTIVE_FAILURES = 3;
const MAX_HEALTH_HISTORY = 100;

// ============================================================================
// EDGE HEALTH MONITOR
// ============================================================================

class EdgeHealthMonitorClass {
  private probeInterval: ReturnType<typeof setInterval> | null = null;
  private currentStatus: EdgeHealthStatus = 'offline';
  private consecutiveFailures = 0;
  private lastSuccessAt: string | null = null;
  private lastCheckAt = '';
  private lastLatency = -1;
  private workerUrl: string;
  private healthHistory: HealthHistoryEntry[] = [];
  private probeIntervalMs: number;

  constructor() {
    this.workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://bas-orchestrator.workers.dev';
    this.probeIntervalMs = parseInt(process.env.EDGE_HEALTH_PROBE_INTERVAL || String(DEFAULT_PROBE_INTERVAL), 10);
  }

  /**
   * Start continuous background health probing.
   */
  start(): void {
    if (this.probeInterval) return; // Already running

    logInfo('EdgeHealthMonitor', `Starting continuous monitoring (interval: ${this.probeIntervalMs}ms)`);

    // Immediate first check
    void this.probe();

    this.probeInterval = setInterval(() => void this.probe(), this.probeIntervalMs);
  }

  /**
   * Stop health probing.
   */
  stop(): void {
    if (this.probeInterval) {
      clearInterval(this.probeInterval);
      this.probeInterval = null;
      logInfo('EdgeHealthMonitor', 'Monitoring stopped');
    }
  }

  /**
   * Single health probe — fetches edge /health endpoint.
   */
  async probe(): Promise<EdgeHealthSnapshot> {
    const startTime = Date.now();
    const previousStatus = this.currentStatus;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${this.workerUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latency = Date.now() - startTime;
      this.lastLatency = latency;
      this.lastCheckAt = new Date().toISOString();

      if (response.ok) {
        this.consecutiveFailures = 0;
        this.lastSuccessAt = this.lastCheckAt;
        this.currentStatus = latency > DEGRADED_LATENCY_THRESHOLD ? 'degraded' : 'healthy';
      } else {
        this.consecutiveFailures++;
        this.currentStatus = this.consecutiveFailures >= OFFLINE_CONSECUTIVE_FAILURES ? 'offline' : 'degraded';
      }
    } catch {
      this.lastLatency = Date.now() - startTime;
      this.lastCheckAt = new Date().toISOString();
      this.consecutiveFailures++;
      this.currentStatus = this.consecutiveFailures >= OFFLINE_CONSECUTIVE_FAILURES ? 'offline' : 'degraded';
    }

    // Record history
    const entry: HealthHistoryEntry = {
      status: this.currentStatus,
      latencyMs: this.lastLatency,
      timestamp: this.lastCheckAt,
    };
    this.healthHistory.push(entry);
    if (this.healthHistory.length > MAX_HEALTH_HISTORY) {
      this.healthHistory.splice(0, this.healthHistory.length - MAX_HEALTH_HISTORY);
    }

    // Broadcast status change via PhoenixEventBus
    if (previousStatus !== this.currentStatus) {
      phoenixEventBus.publish('phoenix:edge_health', {
        status: this.currentStatus,
        previousStatus,
        latencyMs: this.lastLatency,
        timestamp: this.lastCheckAt,
      });

      logInfo('EdgeHealthMonitor', `Status changed: ${previousStatus} → ${this.currentStatus} (latency: ${this.lastLatency}ms)`);
    }

    return this.getSnapshot();
  }

  /**
   * Get current health snapshot.
   */
  getSnapshot(): EdgeHealthSnapshot {
    return {
      status: this.currentStatus,
      latencyMs: this.lastLatency,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessAt: this.lastSuccessAt,
      lastCheckAt: this.lastCheckAt,
    };
  }

  /**
   * Get health history entries.
   */
  getHistory(limit = 50): HealthHistoryEntry[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Whether edge is currently usable (healthy or degraded-but-reachable).
   */
  isEdgeAvailable(): boolean {
    return this.currentStatus !== 'offline';
  }

  /**
   * Whether edge is in optimal state.
   */
  isEdgeHealthy(): boolean {
    return this.currentStatus === 'healthy';
  }

  /**
   * Update the worker URL dynamically.
   */
  setWorkerUrl(url: string): void {
    this.workerUrl = url;
    this.consecutiveFailures = 0;
    this.currentStatus = 'offline'; // Will be updated on next probe
  }
}

export const edgeHealthMonitor = new EdgeHealthMonitorClass();
export default edgeHealthMonitor;
