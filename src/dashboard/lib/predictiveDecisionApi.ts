import type { DecisionResult, DecisionStats, MonteCarloConfig } from '../../core/decisionTypes.js';
import { fetchWithTimeout, safeJson } from './apiService.js';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 30_000;

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = await safeJson<ApiEnvelope<T>>(response);
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.data;
}

export async function getDecisionHistory(limit = 10): Promise<DecisionResult[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/predictive-decision/history?limit=${limit}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<DecisionResult[]>(response);
}

export async function getDecisionStats(daysBack = 30): Promise<DecisionStats> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/predictive-decision/stats?daysBack=${daysBack}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<DecisionStats>(response);
}

export async function triggerDecision(
  triggeredBy = 'dashboard',
  config: Partial<MonteCarloConfig> = {},
): Promise<DecisionResult> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/predictive-decision/trigger`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy, config }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<DecisionResult>(response);
}

export async function getDecisionDetails(decisionId: string): Promise<DecisionResult> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/predictive-decision/${encodeURIComponent(decisionId)}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<DecisionResult>(response);
}

export async function rollbackDecision(decisionId: string): Promise<DecisionResult> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/predictive-decision/${encodeURIComponent(decisionId)}/rollback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<DecisionResult>(response);
}
