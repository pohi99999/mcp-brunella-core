/**
 * CEAN Metrics Collection Module
 * Prometheus-compatible metrics export
 *
 * Metrics tracked:
 * - cean_pipelines_total: Total pipelines executed
 * - cean_pipeline_success_rate: Success rate percentage
 * - cean_pipeline_failures_total: Failed pipelines
 * - cean_latency_ms: Pipeline latency histogram (P50, P95, P99)
 * - cean_d1_queries_total: D1 database queries count
 * - cean_cache_hits_total: Agent cache hits
 * - cean_cache_hit_rate: Cache effectiveness percentage
 * - cean_cost_usd: Estimated daily cost
 */
import type { D1Database } from '@cloudflare/workers-types';
export interface MetricsData {
    pipelines_total: number;
    pipelines_completed: number;
    pipelines_failed: number;
    success_rate_pct: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    cache_hits: number;
    cache_total_lookups: number;
    cache_hit_rate_pct: number;
    d1_queries_total: number;
    estimated_cost_usd: number;
    timestamp: string;
}
/**
 * Gather metrics from D1 database
 */
export declare function gatherMetrics(db: D1Database): Promise<MetricsData>;
/**
 * Format metrics in Prometheus text format
 * https://prometheus.io/docs/instrumenting/exposition_formats/
 */
export declare function formatPrometheusMetrics(metrics: MetricsData): string;
/**
 * Format metrics as JSON (alternative to Prometheus)
 */
export declare function formatJsonMetrics(metrics: MetricsData): Record<string, unknown>;
//# sourceMappingURL=metrics.d.ts.map