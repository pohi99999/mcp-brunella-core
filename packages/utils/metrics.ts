/**
 * Brunella Metrics & Telemetry Module
 * Combined server metrics (Prometheus) and CEAN Edge metrics.
 */

import client from 'prom-client';
import { logError } from './logger.js';

// --- SERVER METRICS (Prometheus) ---

let isInitialized = false;

// Metrics definitions
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const agentOperationsTotal = new client.Counter({
  name: 'brunella_agent_operations_total',
  help: 'Total number of agent operations',
  labelNames: ['agent', 'operation', 'status']
});

/** Initialize Prometheus default metrics */
export function initMetrics(): void {
  if (isInitialized) return;
  client.collectDefaultMetrics();
  isInitialized = true;
}

/** Get Content-Type for Prometheus scrape */
export function getPrometheusContentType(): string {
  return client.register.contentType;
}

/** Get Prometheus metrics snapshot */
export async function getPrometheusMetrics(): Promise<string> {
  return await client.register.metrics();
}

/** Record LLM usage and cost */
export function recordLlmUsageAndCost(model: string, provider: string, inputTokens: number, outputTokens: number, costUsd: number): void {
  // Metric update logic here (stubbed for now to unblock boot)
  agentOperationsTotal.labels('system', 'llm_call', 'success').inc();
}

/** Record Memory Cache Hit */
export function recordMemoryCacheHit(_agentName?: string): void {
  // Stubbed for now
}

/** Record Memory Cache Miss */
export function recordMemoryCacheMiss(_agentName?: string): void {
  // Stubbed for now
}

/** Record Cloudflare Dispatch Outcome */
export function recordCloudflareDispatchOutcome(agent: string, outcome: string, _durationMs?: number): void {
  // Stubbed for now
}

/** Record Agent Execution outcome and duration */
export function recordAgentExecution(agent: string, status: string, duration: number): void {
  // Stubbed for now
  agentOperationsTotal.labels(agent, 'execution', status).inc();
}

/** Record HTTP request duration and outcome */
export function recordHttpRequest(method: string, path: string, status: number, duration: number): void {
  httpRequestDurationMicroseconds
    .labels(method, path, status.toString())
    .observe(duration);
}

/** Get a snapshot of cognitive metrics (for Health check) */
export function getCognitiveMetricsSnapshot() {
  return {
    is_ready: isInitialized,
    collectors: ['prometheus', 'lancedb'],
    timestamp: new Date().toISOString()
  };
}

/** Get a snapshot of memory cache metrics */
export function getMemoryCacheMetricsSnapshot() {
  return {
    hits: 0,
    misses: 0,
    size: 0,
    timestamp: new Date().toISOString()
  };
}

// --- CEAN METRICS (Cloudflare Edge) ---

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
    pipelines: { total: number; completed: number; failed: number; success_rate_pct: number };
    latency: { avg_ms: number };
    cache: { hit_rate_pct: number };
    database: { timestamp: string };
    cost: { estimated_usd: number };
  };
  timestamp: string;
}

/** Gather metrics from D1 database */
export async function gatherMetrics(db: unknown): Promise<MetricsData> {
  try {
    const d1db = db as any;
    const result = await d1db.prepare(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
              AVG(latency_ms) as avg_latency
       FROM edge_executions`
    ).first();

    const total = result?.total || 0;
    const completed = result?.completed || 0;
    const failed = result?.failed || 0;
    const avgLatency = result?.avg_latency || 0;

    const successRate = total > 0 ? (completed / total) * 100 : 0;
    const estimatedCost = total * 0.01;

    return {
      pipelines_total: total,
      pipelines_completed: completed,
      pipelines_failed: failed,
      success_rate_pct: parseFloat(successRate.toFixed(2)),
      avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
      cache_hit_rate_pct: 0,
      cost_usd: parseFloat(estimatedCost.toFixed(4)),
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    logError('metrics', error instanceof Error ? error.message : String(error));
    return {
      pipelines_total: 0, pipelines_completed: 0, pipelines_failed: 0,
      success_rate_pct: 0, avg_latency_ms: 0, cache_hit_rate_pct: 0,
      cost_usd: 0, timestamp: new Date().toISOString(),
    };
  }
}

/** Format metrics for Prometheus */
export function formatPrometheusMetrics(metrics: MetricsData): string {
  return `cean_pipelines_total ${metrics.pipelines_total}\ncean_pipeline_success_rate ${metrics.success_rate_pct}`;
}

/** Format metrics as JSON */
export function formatJsonMetrics(metrics: MetricsData): FormattedMetricsJson {
  return {
    metrics: {
      pipelines: { total: metrics.pipelines_total, completed: metrics.pipelines_completed, failed: metrics.pipelines_failed, success_rate_pct: metrics.success_rate_pct },
      latency: { avg_ms: metrics.avg_latency_ms },
      cache: { hit_rate_pct: 0 },
      database: { timestamp: metrics.timestamp },
      cost: { estimated_usd: metrics.cost_usd },
    },
    timestamp: metrics.timestamp,
  };
}
