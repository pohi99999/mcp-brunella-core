import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

const registry = new Registry();

let initialized = false;

const llmCostRatesPer1K: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
  "llama3.1:8b": { input: 0, output: 0 },
  "qwen2.5-coder:7b": { input: 0, output: 0 },
};

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status_code"] as const,
  registers: [registry],
});

export const agentExecutionTime = new Histogram({
  name: "agent_execution_seconds",
  help: "Agent execution time in seconds",
  labelNames: ["agent_name", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

export const agentExecutionsTotal = new Counter({
  name: "agent_executions_total",
  help: "Total agent executions by outcome",
  labelNames: ["agent_name", "status"] as const,
  registers: [registry],
});

export const llmTokensTotal = new Counter({
  name: "llm_tokens_total",
  help: "Estimated LLM token usage",
  labelNames: ["provider", "model", "direction"] as const,
  registers: [registry],
});

export const llmCostUsdTotal = new Counter({
  name: "llm_cost_usd_total",
  help: "Estimated LLM cost in USD",
  labelNames: ["provider", "model"] as const,
  registers: [registry],
});

export const memoryCacheHitsTotal = new Counter({
  name: "bas_memory_cache_hits_total",
  help: "Structured memory cache hits by agent",
  labelNames: ["agent_name"] as const,
  registers: [registry],
});

export const memoryCacheMissesTotal = new Counter({
  name: "bas_memory_cache_misses_total",
  help: "Structured memory cache misses by agent",
  labelNames: ["agent_name"] as const,
  registers: [registry],
});

export const cloudflareDispatchDecisionsTotal = new Counter({
  name: "bas_cloudflare_dispatch_decisions_total",
  help: "Cloudflare dispatch decisions by target and outcome",
  labelNames: ["target", "outcome"] as const,
  registers: [registry],
});

export const cloudflareDispatchLatency = new Histogram({
  name: "bas_cloudflare_dispatch_latency_seconds",
  help: "Cloudflare dispatch latency by target",
  labelNames: ["target", "outcome"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 90],
  registers: [registry],
});

const memoryCacheHitSnapshot = new Map<string, number>();
const memoryCacheMissSnapshot = new Map<string, number>();

function normalizePath(path: string): string {
  if (!path) return "unknown";
  return path
    .replace(/\/[0-9]+(?=\/|$)/g, "/:id")
    .replace(/\/[a-f0-9]{8,}(?=\/|$)/gi, "/:id");
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function initMetrics(): void {
  if (initialized) return;
  collectDefaultMetrics({ register: registry, prefix: "bas_" });
  initialized = true;
}

export function recordHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void {
  const labels = {
    method: method.toUpperCase(),
    path: normalizePath(path),
    status_code: String(statusCode),
  };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, Math.max(durationMs, 0) / 1000);
}

export function recordAgentExecution(
  agentName: string,
  status: "success" | "error",
  durationMs: number,
): void {
  const labels = { agent_name: agentName, status };
  agentExecutionsTotal.inc(labels);
  agentExecutionTime.observe(labels, Math.max(durationMs, 0) / 1000);
}

const lastLlmInteraction = {
  latencyMs: 0,
  provider: "none",
  timestamp: 0,
};

export function recordLlmUsageAndCost(params: {
  provider: string;
  model: string;
  prompt: string;
  completion: string;
  latencyMs?: number;
}): void {
  const { provider, model, prompt, completion, latencyMs } = params;
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(completion);

  if (latencyMs) {
    lastLlmInteraction.latencyMs = latencyMs;
    lastLlmInteraction.provider = provider;
    lastLlmInteraction.timestamp = Date.now();
  }

  llmTokensTotal.inc({ provider, model, direction: "input" }, inputTokens);
  llmTokensTotal.inc({ provider, model, direction: "output" }, outputTokens);

  const rates = llmCostRatesPer1K[model] ?? { input: 0.001, output: 0.003 };
  const estimatedCost =
    (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;

  if (estimatedCost > 0) {
    llmCostUsdTotal.inc({ provider, model }, estimatedCost);
  }
}

export function getCognitiveMetricsSnapshot() {
  return {
    lastLlmInteraction,
    memoryCache: getMemoryCacheMetricsSnapshot(),
  };
}


export function recordMemoryCacheHit(agentName: string): void {
  memoryCacheHitsTotal.inc({ agent_name: agentName });
  memoryCacheHitSnapshot.set(agentName, (memoryCacheHitSnapshot.get(agentName) ?? 0) + 1);
}

export function recordMemoryCacheMiss(agentName: string): void {
  memoryCacheMissesTotal.inc({ agent_name: agentName });
  memoryCacheMissSnapshot.set(agentName, (memoryCacheMissSnapshot.get(agentName) ?? 0) + 1);
}

export function recordCloudflareDispatchOutcome(
  target: string,
  outcome: "cf" | "local" | "fallback",
  latencyMs?: number,
): void {
  cloudflareDispatchDecisionsTotal.inc({ target, outcome });
  if (typeof latencyMs === "number" && Number.isFinite(latencyMs)) {
    cloudflareDispatchLatency.observe({ target, outcome }, Math.max(latencyMs, 0) / 1000);
  }
}

export function getMemoryCacheMetricsSnapshot(): Record<string, { hits: number; misses: number; hitRate: number }> {
  const hitKeys = Array.from(memoryCacheHitSnapshot.keys());
  const missKeys = Array.from(memoryCacheMissSnapshot.keys());
  const agents = new Set<string>([
    ...hitKeys,
    ...missKeys,
  ]);

  const result: Record<string, { hits: number; misses: number; hitRate: number }> = {};
  const agentArray = Array.from(agents);
  
  for (const agentName of agentArray) {
    const hits = memoryCacheHitSnapshot.get(agentName) ?? 0;
    const misses = memoryCacheMissSnapshot.get(agentName) ?? 0;
    const total = hits + misses;
    result[agentName] = {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  return result;
}

export function getPrometheusMetrics(): Promise<string> {
  return registry.metrics();
}

export function getPrometheusContentType(): string {
  return registry.contentType;
}

export async function resetPrometheusMetricsForTests(): Promise<void> {
  registry.resetMetrics();
  memoryCacheHitSnapshot.clear();
  memoryCacheMissSnapshot.clear();
}
