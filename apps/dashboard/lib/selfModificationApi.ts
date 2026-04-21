import { fetchWithTimeout, safeJson } from './apiService.js';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 30_000;

export type SelfModificationProposalStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'failed'
  | 'applying';

export interface SelfModificationImprovement {
  agentName: string;
  sampleCount: number;
  testsPassed: number;
  baselineSuccessRate: number;
  candidateSuccessRate: number;
  successRateDelta: number;
  baselineAvgDurationMs: number;
  avgDurationMs: number;
  durationImprovementPercent: number;
  improvementPercent: number;
  thresholdPassed: boolean;
}

export interface SelfModificationProposal {
  id: string;
  agentName: string;
  tomlPath: string;
  status: SelfModificationProposalStatus;
  weaknessSummary: string;
  weaknessReasons: string[];
  rationale: string;
  proposedToml: string;
  diff: string;
  testInputs: string[];
  improvement: SelfModificationImprovement;
  reviewer?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  appliedAt?: string;
  trackId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelfModificationWeakAgent {
  agentName: string;
  totalRuns: number;
  successRate: number;
  avgDurationMs: number;
  failureCount: number;
  weaknessReasons: string[];
}

export interface SelfModificationOverview {
  summary: {
    totalRuns: number;
    agentCount: number;
    overallSuccessRate: number;
    avgDurationMs: number;
  };
  weakAgents: SelfModificationWeakAgent[];
  proposals: SelfModificationProposal[];
  activeProposal?: SelfModificationProposal;
  protectedAgents: string[];
}

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

export async function getSelfModificationOverview(): Promise<SelfModificationOverview> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/overview`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<SelfModificationOverview>(response);
}

export async function getSelfModificationProposals(
  status?: SelfModificationProposalStatus,
  limit = 20,
): Promise<SelfModificationProposal[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  const query = params.toString();
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/proposals${query ? `?${query}` : ''}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<SelfModificationProposal[]>(response);
}

export async function runSelfModification(
  agentName: string,
  force = false,
): Promise<SelfModificationProposal> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/improve/${encodeURIComponent(agentName)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<SelfModificationProposal>(response);
}

export async function approveSelfModificationProposal(
  proposalId: string,
  reviewer = 'dashboard',
  notes?: string,
): Promise<SelfModificationProposal> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/proposals/${encodeURIComponent(proposalId)}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, notes }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<SelfModificationProposal>(response);
}

export async function rejectSelfModificationProposal(
  proposalId: string,
  reviewer = 'dashboard',
  notes?: string,
): Promise<SelfModificationProposal> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/proposals/${encodeURIComponent(proposalId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, notes }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<SelfModificationProposal>(response);
}

export async function runWeeklySelfModificationCycle(): Promise<{
  triggeredAt: string;
  weakAgents: SelfModificationWeakAgent[];
  skippedReason?: string;
  createdProposalId?: string;
  targetAgent?: string;
}> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/self-modification/cycle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap(response);
}
