/**
 * Health check helpers: structured responses, retry, timeout config.
 */

import { Logger } from "./logger.js";

const healthLogger = new Logger("health.log");

export const HEALTH_CONFIG = {
  ollama: {
    timeoutMs: Number(process.env.HEALTH_OLLAMA_TIMEOUT_MS) || 5_000,
    retries: Number(process.env.HEALTH_OLLAMA_RETRIES) || 2,
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  },
  anythingllm: {
    timeoutMs: Number(process.env.HEALTH_ANYTHINGLLM_TIMEOUT_MS) || 10_000,
    retries: Number(process.env.HEALTH_ANYTHINGLLM_RETRIES) || 1,
    baseUrl: process.env.ANYTHINGLLM_BASE_URL || "http://localhost:3001",
  },
  python: {
    timeoutMs: 8_000,
    retries: 1,
    baseUrl: process.env.PYTHON_API_URL || "http://127.0.0.1:8010",
  },
  cloudflare: {
    timeoutMs: 8_000,
    retries: 1,
  },
} as const;

export type ServiceStatus =
  | "healthy"
  | "unhealthy"
  | "no_agents"
  | "no_servers"
  | "error";

export interface HealthServiceResult {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  requestId?: string;
  services: {
    ollama: HealthServiceResult;
    anythingllm: HealthServiceResult;
    agents: HealthServiceResult;
    mcp: HealthServiceResult;
    python: HealthServiceResult;
    cloudflare: HealthServiceResult;
  };
}

async function fetchWithRetry(
  url: string,
  options: {
    timeout: number;
    method?: string;
    headers?: Record<string, string>;
  },
  retries: number,
): Promise<{ ok: boolean; latencyMs: number; status: number; error?: string }> {
  const start = Date.now();
  let lastErr: string | undefined;
  let lastStatus = 0;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: options.method || "GET",
        signal: AbortSignal.timeout(options.timeout),
        headers: options.headers,
      });
      const latencyMs = Date.now() - start;
      lastStatus = res.status;
      if (res.ok) return { ok: true, latencyMs, status: res.status };
      lastErr = `HTTP ${res.status}`;
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
    }
  }
  return {
    ok: false,
    latencyMs: Date.now() - start,
    status: lastStatus,
    error: lastErr,
  };
}

export async function checkOllamaHealth(): Promise<HealthServiceResult> {
  const { baseUrl, timeoutMs, retries } = HEALTH_CONFIG.ollama;
  const url = `${baseUrl}/api/tags`;
  const { ok, latencyMs, error } = await fetchWithRetry(
    url,
    { timeout: timeoutMs },
    retries,
  );
  await healthLogger.log("Ollama health", { ok, latencyMs, error });
  return {
    status: ok ? "healthy" : "unhealthy",
    latencyMs,
    error: ok ? undefined : error,
  };
}

export async function checkAnythingLLMHealth(): Promise<HealthServiceResult> {
  const { baseUrl, timeoutMs, retries } = HEALTH_CONFIG.anythingllm;
  const url = `${baseUrl}/api/ping`;
  const { ok, latencyMs, error } = await fetchWithRetry(
    url,
    { timeout: timeoutMs },
    retries,
  );
  await healthLogger.log("AnythingLLM health", {
    ok,
    latencyMs,
    error: error ? "present" : undefined,
  });
  return {
    status: ok ? "healthy" : "unhealthy",
    latencyMs,
    error: ok ? undefined : error,
  };
}

export async function checkPythonHealth(): Promise<HealthServiceResult> {
  const { baseUrl, timeoutMs, retries } = HEALTH_CONFIG.python;
  const url = `${baseUrl}/health`;
  const { ok, latencyMs, error } = await fetchWithRetry(
    url,
    { timeout: timeoutMs },
    retries,
  );
  await healthLogger.log("Python health", { ok, latencyMs, error });
  return {
    status: ok ? "healthy" : "unhealthy",
    latencyMs,
    error: ok ? undefined : error,
  };
}

export async function checkCloudflareHealth(): Promise<HealthServiceResult> {
  // Check Cloudflare Workers deployment (not AI Gateway directly)
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

  if (!workerUrl) {
    return { status: "unhealthy", error: "Missing CLOUDFLARE_WORKER_URL" };
  }

  const { timeoutMs, retries } = HEALTH_CONFIG.cloudflare;

  // Ping the worker's health endpoint (if exists) or root
  const { ok, latencyMs, status, error } = await fetchWithRetry(
    workerUrl,
    { timeout: timeoutMs },
    retries,
  );

  // 200 OK or 404 (worker exists but no route) are both healthy
  const isHealthy = ok || status === 404;
  await healthLogger.log("Cloudflare health", {
    ok: isHealthy,
    latencyMs,
    status,
    error,
  });

  return {
    status: isHealthy ? "healthy" : "unhealthy",
    latencyMs,
    error: isHealthy ? undefined : error || `HTTP ${status}`,
  };
}

export function buildHealthResponse(
  ollama: HealthServiceResult,
  anythingllm: HealthServiceResult,
  python: HealthServiceResult,
  cloudflare: HealthServiceResult,
  agentsCount: number,
  mcpServersCount: number,
  requestId?: string,
): HealthResponse {
  const agents: HealthServiceResult = {
    status: agentsCount > 0 ? "healthy" : "no_agents",
  };
  const mcp: HealthServiceResult = {
    status: mcpServersCount > 0 ? "healthy" : "no_servers",
  };
  const allOk =
    ollama.status === "healthy" &&
    anythingllm.status === "healthy" &&
    python.status === "healthy";
  const anyOk =
    ollama.status === "healthy" ||
    anythingllm.status === "healthy" ||
    agentsCount > 0 ||
    mcpServersCount > 0 ||
    python.status === "healthy";
  const status = allOk ? "ok" : anyOk ? "degraded" : "error";

  return {
    status,
    timestamp: new Date().toISOString(),
    requestId,
    services: { ollama, anythingllm, agents, mcp, python, cloudflare },
  };
}
