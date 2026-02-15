/**
 * Metrics Service - Business logic for metrics handling
 * Path: src/services/metricsService.ts
 * 
 * Handles:
 * - Saving metrics to D1
 * - Aggregating metrics per worker/fleet
 * - Prometheus format generation
 */

import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';

export interface MetricsSample {
  latency_p50?: number;
  latency_p95?: number;
  latency_p99?: number;
  request_count?: number;
  error_count?: number;
  error_rate?: number;
  memory_usage_mb?: number;
  cloudflare_location?: string;
}

export interface AggregatedMetrics {
  worker_count: number;
  avg_latency_p50: number;
  avg_latency_p95: number;
  avg_latency_p99: number;
  avg_error_rate: number;
  total_requests: number;
  total_errors: number;
}

export class MetricsService {
  constructor(private db: Database) {}

  /**
   * Save metrics for a worker
   */
  saveWorkerMetrics(workerId: string, metrics: MetricsSample): boolean {
    try {
      const metricId = `metric-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO cean_metrics_cache
        (id, worker_id, timestamp, latency_p50, latency_p95, latency_p99,
         request_count, error_count, error_rate, memory_usage_mb, cloudflare_location, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        metricId,
        workerId,
        now,
        metrics.latency_p50 || null,
        metrics.latency_p95 || null,
        metrics.latency_p99 || null,
        metrics.request_count || 0,
        metrics.error_count || 0,
        metrics.error_rate || 0,
        metrics.memory_usage_mb || 0,
        metrics.cloudflare_location || null,
        now
      );

      logInfo('MetricsService', `Metrics saved for worker ${workerId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsService', `saveWorkerMetrics error: ${msg}`);
      return false;
    }
  }

  /**
   * Get latest metrics for a worker
   */
  getLatestWorkerMetrics(workerId: string): Record<string, unknown> | null {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          worker_id, timestamp, latency_p50, latency_p95, latency_p99,
          request_count, error_count, error_rate, memory_usage_mb, cloudflare_location
        FROM cean_metrics_cache
        WHERE worker_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const metric = stmt.get(workerId);

      if (!metric) {
        return null;
      }

      return metric as Record<string, unknown>;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsService', `getLatestWorkerMetrics error: ${msg}`);
      return null;
    }
  }

  /**
   * Get aggregated metrics for a fleet
   */
  getFleetAggregateMetrics(fleetId: string): AggregatedMetrics | null {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(DISTINCT w.id) as worker_count,
          AVG(m.latency_p50) as avg_latency_p50,
          AVG(m.latency_p95) as avg_latency_p95,
          AVG(m.latency_p99) as avg_latency_p99,
          AVG(m.error_rate) as avg_error_rate,
          SUM(m.request_count) as total_requests,
          SUM(m.error_count) as total_errors
        FROM cean_workers w
        LEFT JOIN cean_metrics_cache m ON w.id = m.worker_id
        WHERE w.fleet_id = ?
      `);

      const result = stmt.get(fleetId) as Record<string, unknown>;

      return {
        worker_count: (result.worker_count as number) || 0,
        avg_latency_p50: (result.avg_latency_p50 as number) || 0,
        avg_latency_p95: (result.avg_latency_p95 as number) || 0,
        avg_latency_p99: (result.avg_latency_p99 as number) || 0,
        avg_error_rate: (result.avg_error_rate as number) || 0,
        total_requests: (result.total_requests as number) || 0,
        total_errors: (result.total_errors as number) || 0
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsService', `getFleetAggregateMetrics error: ${msg}`);
      return null;
    }
  }

  /**
   * Clear old metrics (keep last 7 days)
   */
  cleanupOldMetrics(daysToKeep: number = 7): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM cean_metrics_cache
        WHERE timestamp < datetime('now', '-${daysToKeep} days')
      `);

      const result = stmt.run();
      const resultObj = result as unknown as Record<string, unknown>;
      const deletedCount = resultObj.changes as number;

      logInfo('MetricsService', `Cleaned up ${deletedCount} old metrics`);
      return deletedCount;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsService', `cleanupOldMetrics error: ${msg}`);
      return 0;
    }
  }

  /**
   * Get metrics for time range
   */
  getMetricsInRange(
    workerId: string,
    fromTime: string,
    toTime: string,
    limit: number = 100
  ): Record<string, unknown>[] {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          worker_id, timestamp, latency_p50, latency_p95, latency_p99,
          request_count, error_count, error_rate, memory_usage_mb
        FROM cean_metrics_cache
        WHERE worker_id = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const results = stmt.all(workerId, fromTime, toTime, limit) as Record<string, unknown>[];

      logInfo('MetricsService', `Retrieved ${results.length} metrics for worker ${workerId}`);
      return results;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsService', `getMetricsInRange error: ${msg}`);
      return [];
    }
  }
}
