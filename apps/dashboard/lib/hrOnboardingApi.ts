import { fetchWithTimeout, safeJson } from './apiService.js';
import type {
  HROnboardingSamplePayload,
} from '@packages/utils/hrOnboarding.js';
import type {
  HROnboardingDryRunReport,
  HROnboardingDryRunResult,
} from '@packages/utils/hrOnboardingDryRun.js';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 30000;

export interface HROnboardingJobRecord {
  id: string;
  type: string;
  status: string;
  query: string;
  results_json?: string | null;
  metadata?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HROnboardingJobListResponse {
  success: boolean;
  jobs: HROnboardingJobRecord[];
}

export interface HROnboardingDryRunResponse {
  success: boolean;
  jobId: string;
  report: HROnboardingDryRunReport;
  normalized: HROnboardingDryRunResult['normalized'];
}

export interface HROnboardingSamplesResponse {
  success: boolean;
  samples: HROnboardingSamplePayload[];
}

export async function getHROnboardingSamples(): Promise<HROnboardingSamplePayload[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/hr-onboarding/samples`, {}, DEFAULT_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HR onboarding samples: HTTP ${response.status}`);
  }

  const data = await safeJson<HROnboardingSamplesResponse>(response);
  return data.samples;
}

export async function runHROnboardingDryRun(payload: Record<string, unknown>): Promise<HROnboardingDryRunResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/hr-onboarding/dry-run`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    const data = await safeJson<{ error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
    throw new Error(data.error || `HR onboarding dry-run failed: HTTP ${response.status}`);
  }

  return safeJson<HROnboardingDryRunResponse>(response);
}

export async function getHROnboardingJobs(limit = 10): Promise<HROnboardingJobRecord[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/hr-onboarding/jobs?limit=${encodeURIComponent(String(limit))}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`HR onboarding jobs: HTTP ${response.status}`);
  }

  const data = await safeJson<HROnboardingJobListResponse>(response);
  return data.jobs;
}
