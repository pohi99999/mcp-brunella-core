/**
 * Prometheus Metrics Client
 * Path: src/core/prometheus.ts
 *
 * Initialize and manage Prometheus metrics for CEAN fleet monitoring
 */

import {
  Counter,
  Gauge,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';

// Enable default Node.js metrics (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'nodejs_' });

/**
 * Gauge: Total workers in a fleet
 */
export const fleetWorkersTotal = new Gauge({
  name: 'fleet_workers_total',
  help: 'Total workers in a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Gauge: Healthy (active) workers in a fleet
 */
export const fleetWorkersHealthy = new Gauge({
  name: 'fleet_workers_healthy',
  help: 'Number of healthy workers in a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Counter: Total requests processed
 */
export const fleetRequestsTotal = new Counter({
  name: 'fleet_requests_total',
  help: 'Total requests processed by a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Counter: Total errors
 */
export const fleetErrorsTotal = new Counter({
  name: 'fleet_errors_total',
  help: 'Total errors in a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Counter: Scaling events
 */
export const scalingEventsTotal = new Counter({
  name: 'scaling_events_total',
  help: 'Total scaling events in a fleet',
  labelNames: ['fleet_id', 'event_type'],
});

/**
 * Histogram: Worker latency in milliseconds
 * Buckets: 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, +Inf
 */
export const workerLatencyMs = new Histogram({
  name: 'worker_latency_ms',
  help: 'Worker response latency in milliseconds',
  labelNames: ['fleet_id'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

/**
 * Gauge: Current error rate percentage
 */
export const fleetErrorRatePercent = new Gauge({
  name: 'fleet_error_rate_percent',
  help: 'Current error rate percentage in a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Gauge: P95 latency in milliseconds
 */
export const fleetLatencyP95Ms = new Gauge({
  name: 'fleet_latency_p95_ms',
  help: 'P95 latency in milliseconds for a fleet',
  labelNames: ['fleet_id'],
});

/**
 * Record a metric (abstraction for easier use)
 */
export function recordMetric(
  fleetId: string,
  metricName: string,
  value: number,
  labels?: Record<string, string>
): void {
  try {
    switch (metricName) {
      case 'request':
        fleetRequestsTotal.labels({ fleet_id: fleetId }).inc();
        break;
      case 'error':
        fleetErrorsTotal.labels({ fleet_id: fleetId }).inc();
        break;
      case 'latency':
        workerLatencyMs.labels({ fleet_id: fleetId }).observe(value);
        break;
      case 'error_rate':
        fleetErrorRatePercent.labels({ fleet_id: fleetId }).set(value);
        break;
      case 'latency_p95':
        fleetLatencyP95Ms.labels({ fleet_id: fleetId }).set(value);
        break;
      case 'scaling_up':
        scalingEventsTotal
          .labels({ fleet_id: fleetId, event_type: 'scale_up' })
          .inc();
        break;
      case 'scaling_down':
        scalingEventsTotal
          .labels({ fleet_id: fleetId, event_type: 'scale_down' })
          .inc();
        break;
      case 'workers_total':
        fleetWorkersTotal.labels({ fleet_id: fleetId }).set(value);
        break;
      case 'workers_healthy':
        fleetWorkersHealthy.labels({ fleet_id: fleetId }).set(value);
        break;
      default:
        // Ignore unknown metrics
        break;
    }
  } catch (error) {
    console.error(`Failed to record metric ${metricName}:`, error);
  }
}

/**
 * Get all metrics in Prometheus text format
 */
export async function getMetricsText(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error) {
    console.error('Failed to generate metrics text:', error);
    return '# Error generating metrics\n';
  }
}

/**
 * Get metrics as JSON (for WebSocket events)
 */
export function getMetricsJson() {
  return register.getMetricsAsJSON();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}

/**
 * Get specific metric value
 */
export async function getMetricValue(metricName: string, labels?: Record<string, string>): Promise<number | null> {
  try {
    const metrics = await register.getMetricsAsJSON();
    const metric = metrics.find((m) => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) {
      return null;
    }

    // If no labels, return first value
    if (!labels) {
      return metric.values[0]?.value ?? null;
    }

    // Find matching labels
    const matchingValue = metric.values.find((v) => {
      if (!v.labels) return false;
      return Object.entries(labels).every(([key, value]) => String(v.labels?.[key]) === value);
    });

    return matchingValue?.value ?? null;
  } catch (error) {
    console.error('Failed to get metric value:', error);
    return null;
  }
}

// Export register for testing
export { register };
