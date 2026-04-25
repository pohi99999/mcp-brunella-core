/**
 * Brunella Metrics & Telemetry Module
 * Combined server metrics (Prometheus) and CEAN Edge metrics.
 */

import client from 'prom-client';
import { logError } from './logger.js';

// --- SERVER METRICS (Prometheus) ---

let isInitialized = false;

function getOrCreateCounter(name: string, help: string, labelNames: string[]) {
  const existing = client.register.getSingleMetric(name);
  return existing instanceof client.Counter
    ? existing
    : new client.Counter({ name, help, labelNames });
}

function getOrCreateHistogram(name: string, help: string, labelNames: string[], buckets: number[]) {
  const existing = client.register.getSingleMetric(name);
  return existing instanceof client.Histogram
    ? existing
    : new client.Histogram({ name, help, labelNames, buckets });
}

// Metrics definitions
const httpRequestsTotal = getOrCreateCounter(
  'http_requests_total',
  'Total number of HTTP requests',
  ['method', 'path', 'status_code'],
);
const httpRequestDurationMicroseconds = getOrCreateHistogram(
  'http_request_duration_seconds',
  'Duration of HTTP requests in seconds',
  ['method', 'path', 'status_code'],
  [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
);
const agentExecutionsTotal = getOrCreateCounter(
  'agent_executions_total',
  'Total number of agent executions',
  ['agent_name', 'status'],
);
const agentExecutionSeconds = getOrCreateHistogram(
  'agent_execution_seconds',
  'Duration of agent executions in seconds',
  ['agent_name', 'status'],
  [0.1, 0.5, 1, 2.5, 5, 10, 30],
);
const llmTokensTotal = getOrCreateCounter(
  'llm_tokens_total',
  'Total LLM tokens estimated by provider and model',
  ['provider', 'model', 'type'],
);
const llmCostUsdTotal = getOrCreateCounter(
  'llm_cost_usd_total',
  'Estimated LLM cost in USD',
  ['provider', 'model'],
);
const cloudflareDispatchDecisionsTotal = getOrCreateCounter(
  'bas_cloudflare_dispatch_decisions_total',
  'Cloudflare dispatch decisions by target and outcome',
  ['target', 'outcome'],
);
const cloudflareDispatchLatencySeconds = getOrCreateHistogram(
  'bas_cloudflare_dispatch_latency_seconds',
  'Cloudflare dispatch latency in seconds',
  ['target', 'outcome'],
  [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
);

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

export async function resetPrometheusMetricsForTests(): Promise<void> {
  client.register.resetMetrics();
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/** Record LLM usage and cost */
export function recordLlmUsageAndCost(
  usage: { provider: string; model: string; prompt: string; completion: string } | string,
  providerArg?: string,
  inputTokensArg?: number,
  outputTokensArg?: number,
  costUsdArg?: number,
): void {
  const provider = typeof usage === 'string' ? (providerArg ?? 'unknown') : usage.provider;
  const model = typeof usage === 'string' ? usage : usage.model;
  const inputTokens = typeof usage === 'string' ? (inputTokensArg ?? 0) : estimateTokenCount(usage.prompt);
  const outputTokens = typeof usage === 'string' ? (outputTokensArg ?? 0) : estimateTokenCount(usage.completion);
  const costUsd = typeof usage === 'string' ? (costUsdArg ?? 0) : (inputTokens + outputTokens) * 0.000001;

  llmTokensTotal.labels(provider, model, 'input').inc(inputTokens);
  llmTokensTotal.labels(provider, model, 'output').inc(outputTokens);
  llmCostUsdTotal.labels(provider, model).inc(costUsd);
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
export function recordCloudflareDispatchOutcome(target: string, outcome: string, durationMs = 0): void {
  cloudflareDispatchDecisionsTotal.labels(target, outcome).inc();
  cloudflareDispatchLatencySeconds.labels(target, outcome).observe(durationMs / 1000);
}

/** Record Agent Execution outcome and duration */
export function recordAgentExecution(agent: string, status: string, durationMs: number): void {
  agentExecutionsTotal.labels(agent, status).inc();
  agentExecutionSeconds.labels(agent, status).observe(durationMs / 1000);
}

function normalizeHttpPath(pathValue: string): string {
  return pathValue.replace(/\/\d+(?=\/|$)/g, '/:id');
}

/** Record HTTP request duration and outcome */
export function recordHttpRequest(method: string, path: string, status: number, durationMs: number): void {
  const normalizedPath = normalizeHttpPath(path);
  const statusCode = status.toString();
  httpRequestsTotal.labels(method, normalizedPath, statusCode).inc();
  httpRequestDurationMicroseconds
    .labels(method, normalizedPath, statusCode)
    .observe(durationMs / 1000);
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
export function getMemoryCacheMetricsSnapshot(): Record<string, { hits: number; misses: number; hitRate: number }> {
  return {};
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
  return [
    '# HELP cean_pipelines_total Total number of CEAN pipeline executions',
    '# TYPE cean_pipelines_total counter',
    `cean_pipelines_total ${metrics.pipelines_total}`,
    '# HELP cean_pipeline_success_rate CEAN pipeline success rate percentage',
    '# TYPE cean_pipeline_success_rate gauge',
    `cean_pipeline_success_rate ${metrics.success_rate_pct}`,
    '# HELP cean_latency_ms Average CEAN pipeline latency in milliseconds',
    '# TYPE cean_latency_ms gauge',
    `cean_latency_ms ${metrics.avg_latency_ms}`,
    '# HELP cean_cache_hit_rate CEAN cache hit rate percentage',
    '# TYPE cean_cache_hit_rate gauge',
    `cean_cache_hit_rate ${metrics.cache_hit_rate_pct}`,
    '# HELP cean_cost_usd Estimated CEAN cost in USD',
    '# TYPE cean_cost_usd gauge',
    `cean_cost_usd ${metrics.cost_usd}`,
  ].join('\n');
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
