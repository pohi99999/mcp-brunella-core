import { fetchWithTimeout, safeJson } from './apiService.js';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 30_000;

export type WorldPerceptionSignalStatus = 'detected' | 'promoted' | 'ignored';
export type WorldPerceptionDomain = 'business' | 'social' | 'political' | 'financial' | 'technology';
export type WorldPerceptionBiasLabel = 'low' | 'medium' | 'high' | 'unknown';
export type WorldPerceptionStance = 'supports' | 'contradicts' | 'neutral';

export interface WorldPerceptionSignalRecord {
  id: string;
  signalHash: string;
  sourceType: 'manual' | 'knowledge_card';
  sourceRef?: string;
  source: string;
  title: string;
  summary: string;
  domain: WorldPerceptionDomain;
  provenance: string;
  biasLabel: WorldPerceptionBiasLabel;
  tags: string[];
  entity?: string;
  relation?: string;
  stance?: WorldPerceptionStance;
  confidence: number;
  freshnessScore: number;
  impactScore: number;
  score: number;
  observedAt: string;
  status: WorldPerceptionSignalStatus;
  intelligenceSignalId: string | null;
  reviewer: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorldPerceptionOverview {
  generatedAt: string;
  summary: {
    totalSignals: number;
    detected: number;
    promoted: number;
    ignored: number;
    avgScore: number;
  };
  domainCoverage: Array<{
    domain: WorldPerceptionDomain;
    count: number;
  }>;
  pendingSignals: WorldPerceptionSignalRecord[];
  freshestSignals: WorldPerceptionSignalRecord[];
  recentPromotions: WorldPerceptionSignalRecord[];
}

export interface WorldPerceptionCycleResult {
  triggeredAt: string;
  scannedCards: number;
  ingestedSignals: number;
  createdSignals: number;
  refreshedSignals: number;
  topSignals: WorldPerceptionSignalRecord[];
}

export interface WorldPerceptionPromotionResult {
  worldSignal: WorldPerceptionSignalRecord;
  intelligenceSignal: {
    id: string;
    title: string;
    status: string;
    sourceClass: string;
    score: number;
  };
}

export interface CreateWorldPerceptionSignalInput {
  source: string;
  title: string;
  summary: string;
  domain: WorldPerceptionDomain;
  provenance: string;
  biasLabel?: WorldPerceptionBiasLabel;
  confidence?: number;
  entity?: string;
  relation?: string;
  stance?: WorldPerceptionStance;
  tags?: string[];
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

export async function getWorldPerceptionOverview(): Promise<WorldPerceptionOverview> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/overview`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionOverview>(response);
}

export async function getWorldPerceptionSignals(
  status?: WorldPerceptionSignalStatus,
  limit = 20,
): Promise<WorldPerceptionSignalRecord[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/signals?${params.toString()}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionSignalRecord[]>(response);
}

export async function createWorldPerceptionSignal(
  input: CreateWorldPerceptionSignalInput,
): Promise<WorldPerceptionSignalRecord> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/observe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'manual',
        ...input,
      }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionSignalRecord>(response);
}

export async function runWorldPerceptionCycle(limit = 12): Promise<WorldPerceptionCycleResult> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/cycle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionCycleResult>(response);
}

export async function promoteWorldPerceptionSignal(
  signalId: string,
  reviewer = 'dashboard',
  note?: string,
): Promise<WorldPerceptionPromotionResult> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/signals/${encodeURIComponent(signalId)}/promote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, note }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionPromotionResult>(response);
}

export async function ignoreWorldPerceptionSignal(
  signalId: string,
  reviewer = 'dashboard',
  note?: string,
): Promise<WorldPerceptionSignalRecord> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/world-perception/signals/${encodeURIComponent(signalId)}/ignore`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, note }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  return unwrap<WorldPerceptionSignalRecord>(response);
}
