/**
 * CEAN Metrics Collection Module
 * Provides metric gathering from D1 database and formatting for Prometheus/JSON
 */

import { logError } from './utils/logger.js';

export interface MetricsData {
  pipelines_total: number;
  pipelines_completed: number;
  pipelines_failed: number;
  success_rate_pct: number;
  avg_latency_ms: number;
  cache_hit_rate_pct: number;
  cost_usd: number;
  timestamp: string;
}

export interface FormattedMetricsJson {
  metrics: {
    pipelines: {
      total: number;
      completed: number;
      failed: number;
      success_rate_pct: number;
    };
    latency: {
      avg_ms: number;
    };
    cache: {
      hit_rate_pct: number;
    };
    database: {
      timestamp: string;
    };
    cost: {
      estimated_usd: number;
    };
  };
  timestamp: string;
}

/**
 * Gather metrics from D1 database
 */
export async function gatherMetrics(db: unknown): Promise<MetricsData> {
  try {
    // Database is typically any due to D1 mock/Cloudflare APIs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d1db = db as any;
    // Query pipeline statistics
    const result = await d1db.prepare(
      `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(latency_ms) as avg_latency
      FROM edge_executions
      `
    ).first();

    const total = result?.total || 0;
    const completed = result?.completed || 0;
    const failed = result?.failed || 0;
    const avgLatency = result?.avg_latency || 0;

    // Query cache statistics
    const cacheResult = await d1db.prepare(
      `
      SELECT 
        SUM(CASE WHEN cache_hit = true THEN 1 ELSE 0 END) as hits,
        COUNT(*) as total
      FROM edge_executions
      `
    ).first();

    const cacheHits = cacheResult?.hits || 0;
    const cacheTotal = cacheResult?.total || 1;
    const cacheHitRate = cacheTotal > 0 ? (cacheHits / cacheTotal) * 100 : 0;

    // Calculate success rate
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    // Estimate cost (example: $0.01 per execution)
    const estimatedCost = total * 0.01;

    return {
      pipelines_total: total,
      pipelines_completed: completed,
      pipelines_failed: failed,
      success_rate_pct: parseFloat(successRate.toFixed(2)),
      avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
      cache_hit_rate_pct: parseFloat(cacheHitRate.toFixed(2)),
      cost_usd: parseFloat(estimatedCost.toFixed(4)),
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    logError('metrics', error instanceof Error ? error.message : String(error));
    // Return zero metrics on error
    return {
      pipelines_total: 0,
      pipelines_completed: 0,
      pipelines_failed: 0,
      success_rate_pct: 0,
      avg_latency_ms: 0,
      cache_hit_rate_pct: 0,
      cost_usd: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Format metrics for Prometheus
 */
export function formatPrometheusMetrics(metrics: MetricsData): string {
  const lines: string[] = [
    '# HELP cean_pipelines_total Total number of pipeline executions',
    '# TYPE cean_pipelines_total counter',
    `cean_pipelines_total ${metrics.pipelines_total}`,
    '',
    '# HELP cean_pipelines_completed Successfully completed pipelines',
    '# TYPE cean_pipelines_completed counter',
    `cean_pipelines_completed ${metrics.pipelines_completed}`,
    '',
    '# HELP cean_pipelines_failed Failed pipeline executions',
    '# TYPE cean_pipelines_failed counter',
    `cean_pipelines_failed ${metrics.pipelines_failed}`,
    '',
    '# HELP cean_pipeline_success_rate Success rate percentage',
    '# TYPE cean_pipeline_success_rate gauge',
    `cean_pipeline_success_rate ${metrics.success_rate_pct}`,
    '',
    '# HELP cean_latency_ms Average latency in milliseconds',
    '# TYPE cean_latency_ms gauge',
    `cean_latency_ms ${metrics.avg_latency_ms}`,
    '',
    '# HELP cean_cache_hit_rate Cache hit rate percentage',
    '# TYPE cean_cache_hit_rate gauge',
    `cean_cache_hit_rate ${metrics.cache_hit_rate_pct}`,
    '',
    '# HELP cean_cost_usd Estimated cost in USD',
    '# TYPE cean_cost_usd gauge',
    `cean_cost_usd ${metrics.cost_usd}`,
  ];

  return lines.join('\n');
}

/**
 * Format metrics as JSON
 */
export function formatJsonMetrics(metrics: MetricsData): FormattedMetricsJson {
  return {
    metrics: {
      pipelines: {
        total: metrics.pipelines_total,
        completed: metrics.pipelines_completed,
        failed: metrics.pipelines_failed,
        success_rate_pct: metrics.success_rate_pct,
      },
      latency: {
        avg_ms: metrics.avg_latency_ms,
      },
      cache: {
        hit_rate_pct: metrics.cache_hit_rate_pct,
      },
      database: {
        timestamp: metrics.timestamp,
      },
      cost: {
        estimated_usd: metrics.cost_usd,
      },
    },
    timestamp: metrics.timestamp,
  };
}
