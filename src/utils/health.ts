/**
 * Health check helpers: structured responses, retry, timeout config.
 */

import fetch from 'node-fetch';
import { Logger } from './logger.js';

const healthLogger = new Logger('health.log');

export const HEALTH_CONFIG = {
  ollama: {
    timeoutMs: Number(process.env.HEALTH_OLLAMA_TIMEOUT_MS) || 5_000,
    retries: Number(process.env.HEALTH_OLLAMA_RETRIES) || 2,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  },
  anythingllm: {
    timeoutMs: Number(process.env.HEALTH_ANYTHINGLLM_TIMEOUT_MS) || 10_000,
    retries: Number(process.env.HEALTH_ANYTHINGLLM_RETRIES) || 1,
    baseUrl: process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001',
  },
} as const;

export type ServiceStatus = 'healthy' | 'unhealthy' | 'no_agents' | 'no_servers' | 'error';

export interface HealthServiceResult {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  requestId?: string;
  services: {
    ollama: HealthServiceResult;
    anythingllm: HealthServiceResult;
    agents: HealthServiceResult;
    mcp: HealthServiceResult;
  };
}

async function fetchWithRetry(
  url: string,
  options: { timeout: number; headers?: Record<string, string> },
  retries: number
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  let lastErr: string | undefined;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(options.timeout),
        headers: options.headers,
      } as any);
      const latencyMs = Date.now() - start;
      if (res.ok) return { ok: true, latencyMs };
      lastErr = `HTTP ${res.status}`;
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
    }
  }
  return { ok: false, latencyMs: Date.now() - start, error: lastErr };
}

export async function checkOllamaHealth(): Promise<HealthServiceResult> {
  const { baseUrl, timeoutMs, retries } = HEALTH_CONFIG.ollama;
  const url = `${baseUrl}/api/tags`;
  const { ok, latencyMs, error } = await fetchWithRetry(url, { timeout: timeoutMs }, retries);
  await healthLogger.log('Ollama health', { ok, latencyMs, error });
  return {
    status: ok ? 'healthy' : 'unhealthy',
    latencyMs,
    error: ok ? undefined : error,
  };
}

export async function checkAnythingLLMHealth(): Promise<HealthServiceResult> {
  const apiKey = process.env.ANYTHINGLLM_API_KEY;
  if (!apiKey) {
    await healthLogger.log('AnythingLLM health skipped', { reason: 'no API key' });
    return { status: 'unhealthy', error: 'API key not configured' };
  }
  const { baseUrl, timeoutMs, retries } = HEALTH_CONFIG.anythingllm;
  const url = `${baseUrl}/api/v1/workspaces`;
  const { ok, latencyMs, error } = await fetchWithRetry(
    url,
    { timeout: timeoutMs, headers: { Authorization: `Bearer ${apiKey}` } },
    retries
  );
  await healthLogger.log('AnythingLLM health', { ok, latencyMs, error: error ? 'present' : undefined });
  return {
    status: ok ? 'healthy' : 'unhealthy',
    latencyMs,
    error: ok ? undefined : error,
  };
}

export function buildHealthResponse(
  ollama: HealthServiceResult,
  anythingllm: HealthServiceResult,
  agentsCount: number,
  mcpServersCount: number,
  requestId?: string
): HealthResponse {
  const agents: HealthServiceResult = {
    status: agentsCount > 0 ? 'healthy' : 'no_agents',
  };
  const mcp: HealthServiceResult = {
    status: mcpServersCount > 0 ? 'healthy' : 'no_servers',
  };
  const allOk = ollama.status === 'healthy' && anythingllm.status === 'healthy';
  const anyOk = ollama.status === 'healthy' || anythingllm.status === 'healthy' || agentsCount > 0 || mcpServersCount > 0;
  const status = allOk ? 'ok' : anyOk ? 'degraded' : 'error';

  return {
    status,
    timestamp: new Date().toISOString(),
    requestId,
    services: { ollama, anythingllm, agents, mcp },
  };
}
