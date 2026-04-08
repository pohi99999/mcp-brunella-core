/**
 * API Service for Dashboard - Backend Communication
 * Centralized API calls to the MCP Brunella Core backend
 */

import { AgentStatusType, TaskItem } from '../types/dashboard.js';
import type { HealthResponse } from '../../utils/health.js';

export const API_BASE = ""; // Same origin
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default timeout
const LONG_TIMEOUT_MS = 120000; // 2 minutes for LLM calls

/** Fetch with timeout support */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Időtúllépés (${timeoutMs / 1000}s)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Biztonságos JSON parse – üres vagy hibás válasz kezelése */
export async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text || text.trim().length === 0) {
    throw new Error(
      response.ok
        ? "Üres válasz"
        : `HTTP ${response.status}: ${response.statusText}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Érvénytelen válasz: ${text.slice(0, 100)}...`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.error === "string" ? value.error : undefined;
}

type ApiErrorResponse = {
  error?: string;
};

type ApiResultResponse<T> = ApiErrorResponse & {
  result?: T;
};

export interface DashboardToolSummary {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  category?: string;
  parameters?: Array<{ name: string; type: string; required?: boolean }>;
}

export interface RobotkezChatResponse {
  success?: boolean;
  message?: string;
  data?: {
    taskId?: string;
    plan?: unknown;
    screenshot?: string;
    [key: string]: unknown;
  };
  error?: string;
}

function isCloudflareTaskResponse(
  value: unknown,
): value is CloudflareTaskResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.success === "boolean" &&
    typeof value.taskId === "string" &&
    typeof value.type === "string" &&
    typeof value.message === "string"
  );
}

function isCloudflareChatResponse(
  value: unknown,
): value is CloudflareChatResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.success === "boolean" &&
    typeof value.message === "string" &&
    (value.endpoint === undefined || typeof value.endpoint === "string")
  );
}

function isCloudflareStatus(value: unknown): value is CloudflareStatus {
  if (!isRecord(value)) return false;
  if (!isRecord(value.status)) return false;
  return (
    typeof value.status.enabled === "boolean" &&
    typeof value.status.healthy === "boolean"
  );
}

export type HealthStatus = HealthResponse;

export interface Agent {
  name: string;
  role: string;
  description: string;
}

export interface AgentStatus {
  name: string;
  description: string;
  status: AgentStatusType;
  lastTaskAt?: string;
  successCount?: number;
  errorCount?: number;
  lastTask?: string;
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface CloudflareTaskResponse {
  success: boolean;
  taskId: string;
  type: string;
  result?: unknown;
  message: string;
}

export interface CloudflareChatResponse {
  success: boolean;
  message: string;
  raw?: unknown;
  endpoint?: string;
}

export interface CloudflareWorkerTaskResponse {
  success: boolean;
  workerId: string;
  workerName: string;
  endpoint?: string;
  result?: unknown;
  error?: string;
}

export async function submitCloudflareTask(
  instruction: string,
  context: Record<string, unknown> = {},
): Promise<CloudflareTaskResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/task`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, context }),
    },
    LONG_TIMEOUT_MS,
  );

  const data = await safeJson<CloudflareTaskResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Cloudflare task failed");
  if (!isCloudflareTaskResponse(data))
    throw new Error("Érvénytelen Cloudflare task válasz");
  return data;
}

export async function getCloudflareTaskStatus(
  taskId: string,
): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/status/${encodeURIComponent(taskId)}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<unknown>(response).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Cloudflare status failed");
  return data;
}

export async function chatWithCloudflare(
  instruction: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<CloudflareChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, history }),
    },
    LONG_TIMEOUT_MS,
  );

  const data = await safeJson<CloudflareChatResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Cloudflare chat failed");
  if (!isCloudflareChatResponse(data))
    throw new Error("Érvénytelen Cloudflare chat válasz");
  return data;
}

export async function submitCloudflareWorkerTask(
  workerId: string,
  instruction: string,
  context: Record<string, unknown> = {},
): Promise<CloudflareWorkerTaskResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/agents/${encodeURIComponent(workerId)}/task`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, context }),
    },
    LONG_TIMEOUT_MS,
  );

  const data = await safeJson<CloudflareWorkerTaskResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));

  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Cloudflare worker task failed");

  return data as CloudflareWorkerTaskResponse;
}

export interface CloudflareStatus {
  status: {
    enabled: boolean;
    healthy: boolean;
  };
}

export interface CloudflareRuntimeConfig {
  edge: {
    enabled: boolean;
    workerUrl: string;
  };
  chat: {
    url: string;
  };
  tunnel: {
    enabled: boolean;
    apiUrl: string | null;
    n8nUrl: string | null;
    browserUrl: string | null;
    browserEndpoint: string;
    dashboardUrl: string | null;
  };
  auth: {
    hasCloudflareApiToken: boolean;
    hasCeanApiKey: boolean;
  };
}

export async function getCloudflareStatus(): Promise<CloudflareStatus> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/status`,
    {},
    5000,
  );
  if (!response.ok)
    throw new Error(`Cloudflare status: HTTP ${response.status}`);
  const data = await safeJson<unknown>(response);
  if (!isCloudflareStatus(data))
    throw new Error("Érvénytelen Cloudflare státusz válasz");
  return data;
}

export async function getCloudflareConfig(): Promise<CloudflareRuntimeConfig> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/cloudflare/config`,
    {},
    5000,
  );
  if (!response.ok)
    throw new Error(`Cloudflare config: HTTP ${response.status}`);
  return safeJson<CloudflareRuntimeConfig>(response);
}

export interface BookkeepingStatusSummary {
  total: number;
  pending: number;
  completed: number;
  manualReview: number;
  unmatched: number;
  partiallyMatched: number;
  error: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

export interface BookkeepingReadinessCheck {
  id: string;
  label: string;
  status: "ready" | "missing";
  required: boolean;
  details: string;
}

export interface BookkeepingReadinessReport {
  status: "ready" | "blocked";
  timestamp: string;
  summary: {
    total: number;
    ready: number;
    blocked: number;
  };
  missing: string[];
  checks: BookkeepingReadinessCheck[];
}

export interface BookkeepingStatusSnapshot {
  summary: Record<string, unknown>;
  exceptions: Array<Record<string, unknown>>;
  timestamp: string;
  updatedAt: string;
  source: "api" | "n8n" | "dashboard";
}

export interface BookkeepingStatusResponse {
  success: boolean;
  summary: BookkeepingStatusSummary;
  pendingTransactions: number;
  snapshot: BookkeepingStatusSnapshot | null;
  readiness?: BookkeepingReadinessReport;
  timestamp: string;
}

export async function getBookkeepingStatus(): Promise<BookkeepingStatusResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/bookkeeping/status`,
    {},
    5000,
  );
  if (!response.ok)
    throw new Error(`Bookkeeping status: HTTP ${response.status}`);
  return safeJson<BookkeepingStatusResponse>(response);
}

export type CashEntryType = "KP_IN" | "KP_OUT";

export type CashEntrySource = "manual" | "email" | "import";

export interface CashEntry {
  id: number;
  date: string;
  type: CashEntryType;
  amount: number;
  description: string;
  invoiceNumber?: string;
  source: CashEntrySource;
  syncedSheets: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CashEntrySummary {
  total: number;
  income: number;
  expense: number;
  balance: number;
  syncedSheets: number;
  pendingSheets: number;
  byType: Record<CashEntryType, number>;
}

export interface CashEntryListResponse {
  success: boolean;
  entries: CashEntry[];
  total: number;
  offset: number;
  limit: number;
}

export interface CashEntryResponse {
  success: boolean;
  entry: CashEntry;
}

export interface CashEntrySummaryResponse {
  success: boolean;
  summary: CashEntrySummary;
  timestamp: string;
}

export interface CashEntryFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: CashEntryType;
  syncedSheets?: boolean;
  limit?: number;
  offset?: number;
}

export interface CashEntryInput {
  date: string;
  type: CashEntryType;
  amount: number;
  description: string;
  invoiceNumber?: string;
  source?: CashEntrySource;
  syncedSheets?: boolean;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : "";
}

export async function getCashEntries(filters: CashEntryFilters = {}): Promise<CashEntryListResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/bookkeeping/cash-entries${buildQuery({
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      type: filters.type,
      synced_sheets: filters.syncedSheets,
      limit: filters.limit,
      offset: filters.offset,
    })}`,
    {},
    5000,
  );

  if (!response.ok) {
    throw new Error(`Cash entry list: HTTP ${response.status}`);
  }

  return safeJson<CashEntryListResponse>(response);
}

export async function getCashSummary(filters: Omit<CashEntryFilters, "limit" | "offset"> = {}): Promise<CashEntrySummaryResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/bookkeeping/cash-summary${buildQuery({
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      type: filters.type,
      synced_sheets: filters.syncedSheets,
    })}`,
    {},
    5000,
  );

  if (!response.ok) {
    throw new Error(`Cash summary: HTTP ${response.status}`);
  }

  return safeJson<CashEntrySummaryResponse>(response);
}

export async function createCashEntry(input: CashEntryInput): Promise<CashEntryResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/bookkeeping/cash-entries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: input.date,
        type: input.type,
        amount: input.amount,
        description: input.description,
        invoice_number: input.invoiceNumber,
        source: input.source,
        synced_sheets: input.syncedSheets,
      }),
    },
    10000,
  );

  if (!response.ok) {
    throw new Error(`Cash entry create: HTTP ${response.status}`);
  }

  return safeJson<CashEntryResponse>(response);
}

export async function updateCashEntry(
  id: number,
  updates: Partial<CashEntryInput> & { syncedSheets?: boolean },
): Promise<CashEntryResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/bookkeeping/cash-entries/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: updates.date,
        type: updates.type,
        amount: updates.amount,
        description: updates.description,
        invoice_number: updates.invoiceNumber,
        source: updates.source,
        synced_sheets: updates.syncedSheets,
      }),
    },
    10000,
  );

  if (!response.ok) {
    throw new Error(`Cash entry update: HTTP ${response.status}`);
  }

  return safeJson<CashEntryResponse>(response);
}

export interface WorkersAIResponse {
  text: string;
  provider: string;
  model: string;
}

export async function generateWithWorkersAI(
  prompt: string,
  model?: string,
): Promise<WorkersAIResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/llm/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, provider: "cloudflare", model }),
    },
    LONG_TIMEOUT_MS,
  );
  const data = await safeJson<WorkersAIResponse | { error?: string }>(
    response,
  ).catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Workers AI generálás sikertelen");
  return data as WorkersAIResponse;
}

export interface LLMProviderStatus {
  providers: Array<{
    id: string;
    name: string;
    status: "online" | "offline";
    latency?: number;
    error?: string;
  }>;
}

export interface LLMCatalogModel {
  id: string;
  name: string;
  provider: string;
  source: "runtime" | "env" | "default";
}

export interface LLMCatalogProvider {
  id: string;
  label: string;
  enabled: boolean;
  defaultModel: string;
  models: LLMCatalogModel[];
}

export interface LLMModelCatalog {
  providers: LLMCatalogProvider[];
}

export async function getLLMProviderStatus(): Promise<LLMProviderStatus> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/llm/status`,
    {},
    30000,
  );
  if (!response.ok)
    throw new Error(`LLM provider status: HTTP ${response.status}`);
  return safeJson<LLMProviderStatus>(response);
}

export async function getLLMModelCatalog(): Promise<LLMModelCatalog> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/llm/catalog`,
    {},
    15000,
  );
  if (!response.ok) {
    throw new Error(`LLM model catalog: HTTP ${response.status}`);
  }
  return safeJson<LLMModelCatalog>(response);
}

export type AssistantReadinessStatus = "ready" | "partial" | "planned";

export interface AssistantCapability {
  id: string;
  title: string;
  status: AssistantReadinessStatus;
  score: number;
  summary: string;
  details: string[];
  evidence?: Record<string, unknown>;
}

export interface AssistantArchitectureLayer {
  id: string;
  title: string;
  summary: string;
  modules: string[];
  purpose: string;
  nextUpgrade?: string;
}

export interface AssistantRoadmapPhase {
  id: string;
  title: string;
  goal: string;
  deliverables: string[];
}

export interface ContextFusionCard {
  generatedAt: string;
  graphRag: {
    nodes: number;
    edges: number;
    lessons: number;
    nodeTypes: Record<string, number>;
  } | null;
  reflection: {
    totalReflections: number;
    avgQualityScore: number;
    selfModelHealth: string;
    recentContext: string;
  } | null;
  memory: { indexedDocuments: number } | null;
  fusionPrompt: string;
  browserDiagnostics?: {
    url: string;
    capturedAt: string;
    jsErrors: number;
    networkErrors: number;
    performanceSummary: string;
    rawSummary: string;
  };
}

export interface AssistantBlueprint {
  assistantName: string;
  targetPlatform: string;
  generatedAt: string;
  recommendedMode: {
    primaryCloudProvider: string;
    localFallbackProvider: string;
    desktopShell: string;
    recommendation: string;
  };
  overallReadiness: {
    score: number;
    label: string;
    summary: string;
  };
  providerHealth: Array<{
    provider: string;
    available: boolean;
    last_check: string;
    response_time_ms?: number;
    error?: string;
  }>;
  capabilities: AssistantCapability[];
  architecture: AssistantArchitectureLayer[];
  roadmap: AssistantRoadmapPhase[];
  nextActions: string[];
  fusionCard?: ContextFusionCard;
}

export async function getAssistantBlueprint(): Promise<AssistantBlueprint> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/assistant/blueprint`,
    {},
    30000,
  );
  if (!response.ok) {
    throw new Error(`Assistant blueprint: HTTP ${response.status}`);
  }
  return safeJson<AssistantBlueprint>(response);
}

/**
 * Context Fusion
 *
 * Fetches a compact context card aggregating GraphRAG, Reflection and Memory
 * statistics from the running server.
 *
 * @returns ContextFusionCard — subsystem snapshot ready for display or LLM injection
 */
export async function getContextFusion(): Promise<ContextFusionCard> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/assistant/context-fusion`,
    {},
    30000,
  );
  if (!response.ok) {
    throw new Error(`Context fusion: HTTP ${response.status}`);
  }
  return safeJson<ContextFusionCard>(response);
}

/**
 * Health Check
 */
export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetchWithTimeout(`${API_BASE}/api/health`, {}, 10000); // 10s for health
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return safeJson<HealthStatus>(response);
}

/**
 * Agents API
 */
export async function getAgents(): Promise<Agent[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/agents`);
  if (!response.ok) throw new Error(`Agents: HTTP ${response.status}`);
  const data = await safeJson<{ agents?: Agent[] }>(response);
  return data.agents || [];
}

export interface RegistryAgent {
  name: string;
  class: string;
  module: string;
  description: string;
  capabilities: string[];
  priority: number;
  autoStart: boolean;
  role?: string;
  systemPrompt?: string;
  triggers?: string[];
  config?: Record<string, unknown>;
  category?: string;
  status?: "active" | "disabled" | "experimental";
  tags?: string[];
  tools?: string[];
  metadataStandard?: {
    category: string;
    status: "active" | "disabled" | "experimental";
    tags: string[];
    tools: string[];
    triggers: string[];
    capabilities: string[];
    priority: number;
    autoStart: boolean;
    executionMode: "local" | "cloud" | "hybrid";
    costTier: "low" | "medium" | "high";
    runtimeCompatibility: "node" | "python" | "hybrid";
  };
}

export interface Registry {
  version: string;
  agents: RegistryAgent[];
  defaultAgent: string;
  routingRules: Array<{ pattern: string; agent: string }>;
}

export async function getRegistry(): Promise<Registry> {
  const response = await fetchWithTimeout(`${API_BASE}/api/registry`);
  if (!response.ok) throw new Error(`Registry: HTTP ${response.status}`);
  return safeJson<Registry>(response);
}

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/agents/status`);
  if (!response.ok) throw new Error(`Agent Status: HTTP ${response.status}`);
  const data = await safeJson<{ agents?: AgentStatus[] }>(response);
  return data.agents || [];
}

export interface AgentDiagnosticsResponse {
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
    summary: {
      totalAgents: number;
      activeAgents: number;
      invalidAgents: number;
      defaultAgent: string;
    };
  };
  agents: Array<{
    name: string;
    module: string;
    configuredClass: string;
    loadStatus: "pending" | "loaded" | "error" | "skipped";
    resolvedExportName?: string;
    resolutionStrategy?: string;
    availableExports: string[];
    error?: string;
    metadata: {
      category: string;
      status: "active" | "disabled" | "experimental";
      tags: string[];
      tools: string[];
      triggers: string[];
      capabilities: string[];
      priority: number;
      autoStart: boolean;
      executionMode: "local" | "cloud" | "hybrid";
      costTier: "low" | "medium" | "high";
      runtimeCompatibility: "node" | "python" | "hybrid";
    };
    runtime: {
      status: "idle" | "working" | "error" | "unloaded";
      lastTaskAt?: string;
      lastTask?: string;
      successCount: number;
      errorCount: number;
    };
  }>;
}

export async function getAgentDiagnostics(): Promise<AgentDiagnosticsResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/agents/diagnostics`);
  if (!response.ok) throw new Error(`Agent Diagnostics: HTTP ${response.status}`);
  return safeJson<AgentDiagnosticsResponse>(response);
}

export interface TasksResponse {
  tasks: TaskItem[];
  total: number;
  limit: number;
  offset: number;
  status?: string;
}

// QueuedTask: TaskItem alias used by ProcessControlWidget / TaskDetailsModal / systemSignalStore
export type QueuedTask = TaskItem;

export async function getTasks(
  limit: number = 20,
  offset: number = 0,
  status?: string,
): Promise<TasksResponse> {
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) qs.set("status", status);
  const response = await fetchWithTimeout(
    `${API_BASE}/api/tasks?${qs.toString()}`,
  );
  if (!response.ok) throw new Error(`Tasks: HTTP ${response.status}`);
  return safeJson<TasksResponse>(response);
}

export async function getActiveTasks(): Promise<TaskItem[]> {
  try {
    const data = await getTasks(50, 0, "running");
    return data.tasks || [];
  } catch {
    return [];
  }
}

export async function getTaskById(taskId: number): Promise<TaskItem> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/${taskId}`);
  if (!response.ok) throw new Error(`Task: HTTP ${response.status}`);
  const data = await safeJson<{ task: TaskItem }>(response);
  return data.task;
}

export interface TaskStats {
  total: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
  failedByAgent: Array<{ agent: string; count: number }>;
}

export interface StructuredMemoryAgentStats {
  agentName: string;
  totalEntries: number;
  avgConfidence: number;
  totalReuses: number;
  lastUpdatedAt: string | null;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export interface StructuredMemoryStatsResponse {
  summary: {
    totalEntries: number;
    avgConfidence: number;
    totalReuses: number;
  };
  agents: StructuredMemoryAgentStats[];
  recentReuses: Array<{
    id: number;
    agentName: string;
    rawTask: string;
    confidence: number;
    reuseCount: number;
    lastReusedAt: string | null;
  }>;
}

export interface WorkflowStatusItem {
  id: string;
  name: string;
  status: string;
  nodeCount: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  warnings: number;
}

export interface WorkflowNodeResult {
  nodeId: string;
  status: string;
  output?: unknown;
  error?: string;
  durationMs: number;
  condition?: boolean;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: string;
  nodeResults: Record<string, WorkflowNodeResult>;
  totalTokens: number;
  totalCostUSD: number;
  durationMs: number;
  warnings: string[];
  completedNodeIds: string[];
}

export interface WorkflowPreviewResponse {
  success: boolean;
  workflow: {
    id: string;
    name: string;
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      agentName?: string;
      instruction?: string;
      dependsOn?: string[];
      timeoutMs?: number;
      metadata?: Record<string, unknown>;
    }>;
    edges?: Array<{ from: string; to: string }>;
  };
}

export async function getTaskStats(): Promise<TaskStats> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/stats`);
  if (!response.ok) throw new Error(`Task Stats: HTTP ${response.status}`);
  const data = await safeJson<{ stats: TaskStats }>(response);
  return data.stats;
}

export async function getStructuredMemoryStats(): Promise<StructuredMemoryStatsResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/memory/structured/stats`);
  if (!response.ok) throw new Error(`Structured Memory Stats: HTTP ${response.status}`);
  return safeJson<StructuredMemoryStatsResponse>(response);
}

export async function purgeStructuredMemory(minConfidence?: number): Promise<{ success: boolean; removed: number }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/memory/structured/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(minConfidence !== undefined ? { minConfidence } : {}),
  });
  if (!response.ok) throw new Error(`Structured Memory Purge: HTTP ${response.status}`);
  return safeJson<{ success: boolean; removed: number }>(response);
}

export async function exportStructuredMemory(format: 'jsonl' | 'json' = 'jsonl'): Promise<string> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/memory/structured/export?format=${format}`);
  if (!response.ok) throw new Error(`Structured Memory Export: HTTP ${response.status}`);
  return response.text();
}

export async function syncGoldenMirror(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  errors?: string[];
  mode?: 'cloud' | 'local-only';
}> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/memory/structured/golden/sync`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Golden Mirror Sync: HTTP ${response.status}`);
  return safeJson<{
    success: boolean;
    synced: number;
    failed: number;
    skipped: number;
    errors?: string[];
    mode?: 'cloud' | 'local-only';
  }>(response);
}

export async function previewWorkflow(task: string, defaultAgent?: string): Promise<WorkflowPreviewResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tasks/workflow/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, defaultAgent }),
  }, LONG_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Workflow Preview: HTTP ${response.status}`);
  return safeJson<WorkflowPreviewResponse>(response);
}

export async function runWorkflow(params: {
  task?: string;
  workflow?: WorkflowPreviewResponse['workflow'];
  defaultAgent?: string;
  initialContext?: Record<string, unknown>;
}): Promise<{ success: boolean; workflow: WorkflowPreviewResponse['workflow']; result: WorkflowExecutionResult }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tasks/workflow/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }, LONG_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Workflow Run: HTTP ${response.status}`);
  return safeJson<{ success: boolean; workflow: WorkflowPreviewResponse['workflow']; result: WorkflowExecutionResult }>(response);
}

export async function getWorkflowStatuses(): Promise<WorkflowStatusItem[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tasks/workflow/status`);
  if (!response.ok) throw new Error(`Workflow Status: HTTP ${response.status}`);
  const data = await safeJson<{ workflows?: WorkflowStatusItem[] }>(response);
  return data.workflows || [];
}

export async function executePendingTask(): Promise<unknown> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/execute`, {
    method: "POST",
  });
  const data = await safeJson<ApiResultResponse<unknown>>(response).catch(() => ({
    error: `HTTP ${response.status}`,
    result: undefined,
  } as ApiResultResponse<unknown>));
  if (!response.ok) throw new Error(data.error || "Task execute failed");
  return data.result;
}

export async function cancelTask(taskId: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Task cancel failed");
}


export async function retryTask(taskId: number, debugMode = false): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, debugMode }),
  });
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Task retry failed");
}

export async function pauseTask(taskId: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Task pause failed");
}

export async function resumeTask(taskId: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Task resume failed");
}

export async function updateTaskOrder(taskIds: number[]): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  });
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Task reorder failed");
}

export interface ProviderStatus {
  id: string;
  name: string;
  status: "online" | "offline";
  latency?: number;
  error?: string;
}

export interface FederationPeer {
  peerId: string;
  displayName: string;
  endpoint: string;
  trustState: "trusted" | "revoked" | "pending" | "unknown";
  trustedAt?: string;
  revokedAt?: string;
  metadata?: Record<string, unknown>;
}

export type FederationEvidenceOutcome = 'allowed' | 'denied' | 'observed';

export type FederationEvidenceKind =
  | 'peer_registered'
  | 'peer_revoked'
  | 'runtime_key_staged'
  | 'runtime_key_promoted'
  | 'route_denied';

export interface FederationEvidenceJournalEntry {
  id: string;
  timestamp: string;
  peerId: string | null;
  displayName: string | null;
  endpoint: string | null;
  trustState: FederationPeer['trustState'] | null;
  kind: FederationEvidenceKind;
  title: string;
  detail: string;
  outcome: FederationEvidenceOutcome;
  keyId: string | null;
  previousCurrentKeyId: string | null;
  reason: string | null;
  evidenceSources: Array<'audit' | 'phoenix'>;
}

export interface FederationPeerEvidenceSummary {
  peerId: string;
  displayName: string;
  endpoint: string;
  trustState: FederationPeer['trustState'];
  trustedAt: string | null;
  revokedAt: string | null;
  currentKeyId: string | null;
  nextKeyId: string | null;
  rotationState: 'stable' | 'staged' | 'missing' | 'revoked';
  lastEvidenceAt: string | null;
  latestAction: string | null;
  latestOutcome: FederationEvidenceOutcome | null;
  journalCount: number;
  registerCount: number;
  revokeCount: number;
  stageCount: number;
  promoteCount: number;
  routeDeniedCount: number;
}

export interface FederationEvidenceSnapshot {
  timestamp: string;
  peerFilter: string | null;
  limit: number;
  truncated: boolean;
  peers: FederationPeerEvidenceSummary[];
  journal: FederationEvidenceJournalEntry[];
  totals: {
    peerCount: number;
    trustedCount: number;
    pendingCount: number;
    revokedCount: number;
    peersWithNextKey: number;
    journalCount: number;
    deniedCount: number;
    registerCount: number;
    revokeCount: number;
    stageCount: number;
    promoteCount: number;
    routeDeniedCount: number;
  };
}

export interface FederationRuntimeKeyMutationInput {
  publicKey: string;
  keyId?: string;
}

export interface FederationCapability {
  name: string;
  description: string;
  version?: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
}

export interface FederationManifest {
  manifestId: string;
  peerId: string;
  capabilities: FederationCapability[];
  version: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface FederationNegotiationOffer {
  offerId: string;
  fromPeerId: string;
  toPeerId: string;
  capabilities: string[];
  terms: Record<string, unknown>;
  proposedAt: string;
}

export interface FederationNegotiationCounterOffer {
  counterOfferId: string;
  originalOfferId: string;
  fromPeerId: string;
  modifiedCapabilities: string[];
  modifiedTerms: Record<string, unknown>;
  proposedAt: string;
}

export interface FederationNegotiationTranscriptEntry {
  timestamp: string;
  action: string;
  actor: string;
  detail?: string;
}

export interface FederationNegotiationSession {
  sessionId: string;
  state: string;
  initialOffer: FederationNegotiationOffer;
  counterOffer?: FederationNegotiationCounterOffer;
  agreedCapabilities?: string[];
  agreedTerms?: Record<string, unknown>;
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
  requiresApproval: boolean;
  transcript: FederationNegotiationTranscriptEntry[];
}

export async function getProvidersStatus(): Promise<ProviderStatus[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/providers/status`);
  if (!response.ok)
    throw new Error(`Providers Status: HTTP ${response.status}`);
  const data = await safeJson<{ providers?: ProviderStatus[] }>(response);
  return data.providers || [];
}

export async function getFederationPeers(): Promise<FederationPeer[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/peers`);
  if (!response.ok) throw new Error(`Federation Peers: HTTP ${response.status}`);
  const data = await safeJson<{ peers?: FederationPeer[] }>(response);
  return data.peers || [];
}

export async function registerFederationPeer(input: {
  peerId: string;
  displayName: string;
  endpoint: string;
}): Promise<FederationPeer> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/peers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await safeJson<FederationPeer | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation peer registration failed');
  return data as FederationPeer;
}

export async function revokeFederationPeer(peerId: string, reason: string): Promise<FederationPeer> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/peers/${encodeURIComponent(peerId)}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await safeJson<FederationPeer | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation peer revocation failed');
  return data as FederationPeer;
}

export async function stageFederationPeerRuntimeKey(
  peerId: string,
  input: FederationRuntimeKeyMutationInput,
): Promise<FederationPeer> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/peers/${encodeURIComponent(peerId)}/runtime-keys/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await safeJson<FederationPeer | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation runtime key staging failed');
  return data as FederationPeer;
}

export async function promoteFederationPeerRuntimeKey(peerId: string, reason?: string): Promise<FederationPeer> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/peers/${encodeURIComponent(peerId)}/runtime-keys/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  const data = await safeJson<FederationPeer | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation runtime key promotion failed');
  return data as FederationPeer;
}

export async function getFederationEvidence(
  options: {
    peerId?: string;
    limit?: number;
  } = {},
): Promise<FederationEvidenceSnapshot> {
  const params = new URLSearchParams();
  if (options.peerId?.trim()) {
    params.set('peerId', options.peerId.trim());
  }
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/federation/evidence${query ? `?${query}` : ''}`,
  );
  if (!response.ok) throw new Error(`Federation Evidence: HTTP ${response.status}`);
  return safeJson<FederationEvidenceSnapshot>(response);
}

export async function getFederationNegotiations(): Promise<FederationNegotiationSession[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/negotiations`);
  if (!response.ok) throw new Error(`Federation Negotiations: HTTP ${response.status}`);
  const data = await safeJson<{ sessions?: FederationNegotiationSession[] }>(response);
  return data.sessions || [];
}

export async function getLocalFederationManifest(): Promise<FederationManifest> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/manifests/local`);
  const data = await safeJson<FederationManifest | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation manifest load failed');
  return data as FederationManifest;
}

export async function verifyFederationManifest(manifest: FederationManifest): Promise<'valid' | 'invalid_signature' | 'expired'> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/federation/manifests/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  const data = await safeJson<{ result: 'valid' | 'invalid_signature' | 'expired'; error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Federation manifest verify failed');
  if (!('result' in data)) throw new Error(getErrorMessage(data) || 'Federation manifest verify failed');
  return data.result;
}

export async function executeAgent(
  agentName: string,
  task: string,
  context?: unknown,
): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/agents/${encodeURIComponent(agentName)}/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, context }),
    },
    LONG_TIMEOUT_MS, // 2 minutes for agent execution
  );
  const data = await safeJson<ApiResultResponse<unknown>>(response).catch(() => ({
    error: `HTTP ${response.status}`,
    result: undefined,
  } as ApiResultResponse<unknown>));
  if (!response.ok) throw new Error(data.error || "Agent execution failed");
  return data.result;
}

// Szinkron orkesztrátori hívás — megvárja a valódi magyar választ
export async function orchestrateTask(
  task: string,
  context?: Record<string, unknown>,
): Promise<{ message: string; taskId?: number; steps?: number[]; success: boolean }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/agents/orchestrate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, context }),
    },
    LONG_TIMEOUT_MS,
  );
  const data = await safeJson<{ message?: string; taskId?: number; steps?: number[]; success?: boolean; error?: string }>(response)
    .catch(() => ({ error: `HTTP ${response.status}` } as { message?: string; taskId?: number; steps?: number[]; success?: boolean; error?: string }));
  if (!response.ok) throw new Error(data.error || "Orkesztráció sikertelen");
  return {
    success: data.success ?? true,
    message: data.message || "Kész.",
    taskId: data.taskId,
    steps: data.steps,
  };
}


export async function createAgent(config: {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  triggers?: string[];
}): Promise<{ success?: boolean; message?: string }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/agents/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = await safeJson<{ success?: boolean; message?: string; error?: string }>(
    response,
  ).catch(() => ({ error: `HTTP ${response.status}` } as { success?: boolean; message?: string; error?: string }));
  if (!response.ok) throw new Error(data.error || "Agent creation failed");
  return data;
}

/**
 * Jules API (Google Jules Integration)
 */
export interface JulesSession {
  id: string;
  status: string;
  task: string;
}

export async function getJulesSessions(): Promise<JulesSession[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/jules/sessions`);
  if (!response.ok) throw new Error(`Jules Sessions: HTTP ${response.status}`);
  const data = await safeJson<{ sessions: JulesSession[] }>(response);
  return data.sessions || [];
}

export async function createJulesTask(
  task: string,
): Promise<{ success: boolean; sessionId?: string; output?: string }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/jules/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  const data = await safeJson<{
    success: boolean;
    sessionId?: string;
    output?: string;
    error?: string;
  }>(response);
  if (!response.ok) throw new Error(data.error || "Jules task failed");
  return data;
}

export async function syncJulesSession(
  sessionId: string,
): Promise<{ success: boolean; output?: string }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/jules/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = await safeJson<{
    success: boolean;
    output?: string;
    error?: string;
  }>(response);
  if (!response.ok) throw new Error(data.error || "Jules sync failed");
  return data;
}

export interface JulesWorkflowRun {
  id: number;
  name?: string;
  html_url?: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string;
  updated_at?: string;
  run_number?: number;
  event?: string;
}

export async function getJulesWorkflowRuns(params?: {
  workflow?: string;
  limit?: number;
}): Promise<JulesWorkflowRun[]> {
  const qs = new URLSearchParams();
  if (params?.workflow) qs.set("workflow", params.workflow);
  if (typeof params?.limit === "number") qs.set("limit", String(params.limit));

  const response = await fetchWithTimeout(
    `${API_BASE}/api/jules/workflow-runs${qs.toString() ? `?${qs.toString()}` : ""}`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<{ runs?: JulesWorkflowRun[]; error?: string }>(
    response,
  ).catch((): { runs?: JulesWorkflowRun[]; error?: string } => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Jules workflow runs failed");
  return data.runs || [];
}

export async function dispatchJulesWorkflow(params?: {
  workflow?: string;
  ref?: string;
  inputs?: Record<string, unknown>;
}): Promise<{ success: boolean; workflow: string; ref: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/jules/dispatch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: params?.workflow,
        ref: params?.ref,
        inputs: params?.inputs,
      }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<
    { success: boolean; workflow: string; ref: string } | { error?: string }
  >(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Jules dispatch failed");
  if (!isRecord(data)) throw new Error("Érvénytelen Jules dispatch válasz");
  return data as { success: boolean; workflow: string; ref: string };
}

/**
 * Tracks TODO / Progress API (Dashboard TODO Widget)
 */
export interface TrackTodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TrackTodoSummary {
  trackId: string;
  title: string;
  status?: string;
  progress: number;
  completedCount: number;
  totalCount: number;
}

export interface TrackTodosResponse {
  success: boolean;
  trackId: string;
  title: string;
  todos: TrackTodoItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
}

/**
 * Track teljes adatai (lista endpoint válasz)
 */
export interface Track {
  id: string;
  title: string;
  priority?: string; // P0, P1, P2 (SpecWriter lista)
  progress: number; // 0-100
  path?: string;
}

export interface TracksListResponse {
  success: boolean;
  count: number;
  tracks: Track[];
}

/**
 * Track-ek listázása a conductor/tracks/ mappából
 */
export async function getTracks(): Promise<TracksListResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tracks`);
  const data = await safeJson<TracksListResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));

  if (!response.ok || !data) {
    throw new Error(getErrorMessage(data) || "Tracks list failed");
  }

  return data as TracksListResponse;
}

export async function getActiveTrackTodoSummaries(): Promise<
  TrackTodoSummary[]
> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/tracks/todos/active`,
  );
  const data = await safeJson<{ tracks?: TrackTodoSummary[]; error?: string }>(
    response,
  ).catch((): { tracks?: TrackTodoSummary[]; error?: string } => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Tracks todos failed");
  return data.tracks || [];
}

export async function getTrackTodos(
  trackId: string,
): Promise<TrackTodosResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/tracks/${encodeURIComponent(trackId)}/todos`,
  );
  const data = await safeJson<TrackTodosResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Track todos failed");
  return data as TrackTodosResponse;
}

export async function toggleTrackTodo(params: {
  trackId: string;
  todoId: string;
  completed?: boolean;
}): Promise<TrackTodosResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/tracks/${encodeURIComponent(params.trackId)}/todos/${encodeURIComponent(params.todoId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        typeof params.completed === "boolean"
          ? { completed: params.completed }
          : {},
      ),
    },
  );
  const data = await safeJson<TrackTodosResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Toggle todo failed");
  return data as TrackTodosResponse;
}

export type TrackGroupId = 'business' | 'nova' | 'brunella' | 'other';

export interface TrackMonitorEntry {
  id: string;
  title: string;
  status: string;
  priority?: string;
  progress: number;
  assignee?: string;
  description?: string;
  updated?: string;
  group?: TrackGroupId;
}

export interface TrackMonitorStats {
  total: number;
  proposed: number;
  active: number;
  completed: number;
  archived: number;
}

export interface TrackMonitorResponse {
  success: boolean;
  stats: TrackMonitorStats;
  proposed: TrackMonitorEntry[];
  active: TrackMonitorEntry[];
  completed: TrackMonitorEntry[];
  archived: TrackMonitorEntry[];
}

export interface TrackDetailResponse {
  success: boolean;
  id: string;
  title: string;
  status: string;
  priority?: string;
  progress: number;
  assignee?: string;
  description?: string;
  updated?: string;
  group?: TrackGroupId;
  planMd: string | null;
  specMd: string | null;
  trackMd: string | null;
}

export async function getTracksMonitor(): Promise<TrackMonitorResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tracks/monitor`);
  const data = await safeJson<TrackMonitorResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Failed to load tracks monitor");
  return data as TrackMonitorResponse;
}

export async function getTrackDetail(trackId: string): Promise<TrackDetailResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/tracks/${encodeURIComponent(trackId)}/detail`);
  const data = await safeJson<TrackDetailResponse | { error?: string }>(
    response,
  ).catch(() => ({
    error: `HTTP ${response.status}: ${response.statusText}`,
  }));
  if (!response.ok)
    throw new Error(getErrorMessage(data) || "Failed to load track detail");
  return data as TrackDetailResponse;
}

export interface AutonomousReplicationNode {
  nodeId: string;
  region: string;
  status: 'active' | 'bootstrapping' | 'failed' | 'retired';
  load: number;
  parentNodeId?: string;
  capabilities: string[];
}

export interface AutonomousReplicationPlan {
  planId: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetRegion: string;
  risk: 'low' | 'medium' | 'high';
  status: 'planned' | 'approved' | 'bootstrapping' | 'active' | 'failed' | 'cancelled';
  reason: string;
}

export interface AutonomousRecommendation {
  recommendationId: string;
  type: 'scale_up' | 'scale_down' | 'heal' | 'rebalance' | 'replicate' | 'protect';
  targetResourceId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AutonomousGoalItem {
  goalId: string;
  title: string;
  category: 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth';
  status: 'proposed' | 'active' | 'blocked' | 'completed' | 'abandoned';
  priority: number;
}

export interface AutonomousInfraState {
  hyperKernel: {
    latestCycle: {
      cycleId: string;
      snapshotHealth: string;
    } | null;
    stats: {
      kernel: { directives: number };
      optimizer: { pending: number };
      goals: { active: number };
    };
  };
  replication: {
    analysis: {
      activeNodes: number;
      bootstrappingNodes: number;
      plansPendingApproval: number;
      replicasByRegion: Record<string, number>;
    };
    nodes: AutonomousReplicationNode[];
    plans: AutonomousReplicationPlan[];
  };
  infra: {
    incidents: Array<{ incidentId: string; status: string }>;
    recommendations: AutonomousRecommendation[];
  };
  optimizer: {
    forecast: {
      latencyMs: number;
      resilienceScore: number;
      trend: 'improving' | 'stable' | 'degrading';
    };
  };
  selfModel: {
    state: {
      health: string;
      coherence: number;
      blindSpots: Array<{ area: string; severity: string; description: string }>;
    };
  };
  goals: {
    items: AutonomousGoalItem[];
  };
}

export async function getAutonomousInfraState(): Promise<AutonomousInfraState> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/autonomous-infra/state`,
    {},
    DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`Autonomous Infra state: HTTP ${response.status}`);
  return safeJson<AutonomousInfraState>(response);
}

export async function runAutonomousInfraCycle(reason: string): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/autonomous-infra/hyperkernel/cycle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<unknown | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Autonomous cycle failed');
  return data;
}

export async function planAutonomousReplica(
  sourceNodeId: string,
  targetRegion: string,
  reason: string,
): Promise<AutonomousReplicationPlan> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/autonomous-infra/self-replication/plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceNodeId, targetRegion, reason }),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<AutonomousReplicationPlan | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Replication plan failed');
  return data as AutonomousReplicationPlan;
}

export async function createAutonomousGoal(goal: {
  title: string;
  category: 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth';
  metric: string;
  direction: 'increase' | 'decrease';
  targetValue: number;
  currentValue: number;
  priority: number;
  rationale: string;
}): Promise<AutonomousGoalItem> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/autonomous-infra/goals`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    },
    DEFAULT_TIMEOUT_MS,
  );
  const data = await safeJson<AutonomousGoalItem | { error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(getErrorMessage(data) || 'Goal creation failed');
  return data as AutonomousGoalItem;
}

/**
 * Ollama API
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch(`${API_BASE}/api/ollama/models`);
    if (!response.ok) return [];
    const data = await safeJson<{ models?: OllamaModel[] }>(response);
    return data.models || [];
  } catch {
    return [];
  }
}

export async function generateWithOllama(
  prompt: string,
  model?: string,
  system?: string,
): Promise<string> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/ollama/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, system }),
    },
    LONG_TIMEOUT_MS, // 2 minutes for LLM generation
  );
  const data = await safeJson<{ response?: string; error?: string }>(
    response,
  ).catch((): { response?: string; error?: string } => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || "Ollama generálás sikertelen");
  return typeof data.response === "string"
    ? data.response
    : String(data.response ?? "");
}

/**
 * GitHub Models API
 */
export interface GithubModel {
  name: string;
  provider: string;
}

export async function getGithubModels(): Promise<GithubModel[]> {
  try {
    const response = await fetch(`${API_BASE}/api/github-models/models`);
    if (!response.ok) return [];
    const data = await safeJson<{ models?: GithubModel[] }>(response);
    return data.models || [];
  } catch {
    return [];
  }
}

export async function generateWithGithubModels(
  prompt: string,
  model?: string,
  system?: string,
): Promise<string> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/github-models/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, system }),
    },
    LONG_TIMEOUT_MS,
  );
  const data = await safeJson<{ response?: string; error?: string }>(
    response,
  ).catch((): { response?: string; error?: string } => ({ error: `HTTP ${response.status}` }));
  if (!response.ok)
    throw new Error(data.error || "GitHub Models generálás sikertelen");
  return typeof data.response === "string"
    ? data.response
    : String(data.response ?? "");
}

/**
 * Gemini API
 */
export interface GeminiModel {
  name: string;
  provider: string;
  tier: string;
}

export async function getGeminiModels(): Promise<GeminiModel[]> {
  try {
    const response = await fetch(`${API_BASE}/api/gemini/models`);
    if (!response.ok) return [];
    const data = await safeJson<{ models?: GeminiModel[] }>(response);
    return data.models || [];
  } catch {
    return [];
  }
}

export async function generateWithGemini(
  prompt: string,
  model?: string,
  system?: string,
): Promise<string> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/gemini/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, system }),
    },
    LONG_TIMEOUT_MS,
  );
  const data = await safeJson<{ response?: string; error?: string }>(
    response,
  ).catch((): { response?: string; error?: string } => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || "Gemini generálás sikertelen");
  return typeof data.response === "string"
    ? data.response
    : String(data.response ?? "");
}

/**
 * AnythingLLM API
 */
export async function getAnythingLLMWorkspaces(): Promise<Workspace[]> {
  try {
    const response = await fetch(`${API_BASE}/api/anythingllm/workspaces`);
    if (!response.ok) return [];
    const data = await safeJson<{ workspaces?: Workspace[] }>(response);
    return data.workspaces || [];
  } catch {
    return [];
  }
}

export async function chatWithAnythingLLM(
  workspace: string,
  message: string,
  mode?: string,
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/anythingllm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace, message, mode }),
  });
  const data = await safeJson<{ response?: string; error?: string }>(
    response,
  ).catch((): { response?: string; error?: string } => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || "AnythingLLM chat failed");
  return typeof data.response === "string"
    ? data.response
    : String(data.response ?? "");
}

/**
 * Chat Messages API
 */
export async function getChatMessages(chatId?: string): Promise<unknown[]> {
  const url = chatId
    ? `${API_BASE}/api/chat/messages?chatId=${chatId}`
    : `${API_BASE}/api/chat/messages`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Chat: HTTP ${response.status}`);
  const data = await safeJson<{ messages?: unknown[] }>(response);
  return data.messages || [];
}

/**
 * Tools API
 */
export async function getTools(): Promise<DashboardToolSummary[]> {
  const response = await fetch(`${API_BASE}/api/tools`);
  if (!response.ok) throw new Error(`Tools: HTTP ${response.status}`);
  const data = await safeJson<{ tools?: DashboardToolSummary[] }>(response);
  return data.tools || [];
}

/**
 * System Control API (Mission Control 2.0)
 */
export interface ServiceState {
  id: string;
  status: "online" | "offline" | "starting" | "stopping" | "unknown";
  pid?: number;
  lastCheck?: string;
  error?: string;
}

export async function getServiceStatus(): Promise<ServiceState[]> {
  const response = await fetch(`${API_BASE}/api/system/status`);
  if (!response.ok) throw new Error(`Státusz: HTTP ${response.status}`);
  const data = await safeJson<{ services?: ServiceState[] }>(response);
  return data.services || [];
}

export async function startService(
  service: "ollama" | "python" | "anythingllm" | "n8n" | "langflow",
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/system/start-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service }),
  });
  const data = await safeJson<{ success?: boolean; message?: string }>(
    response,
  ).catch((): { success?: boolean; message?: string } => ({}));
  return {
    success: data.success ?? false,
    message: data.message ?? `HTTP ${response.status}`,
  };
}

export async function stopService(
  service: "ollama" | "python" | "n8n" | "langflow",
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/system/stop-service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service }),
  });
  const data = await safeJson<{ success?: boolean; message?: string }>(
    response,
  ).catch((): { success?: boolean; message?: string } => ({}));
  return {
    success: data.success ?? false,
    message: data.message ?? `HTTP ${response.status}`,
  };
}

export async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(
    `${API_BASE}/api/tools/${encodeURIComponent(toolName)}/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  const data = await safeJson<{ result?: unknown; error?: string }>(response).catch(
    (): { result?: unknown; error?: string } => ({ error: `HTTP ${response.status}` }),
  );
  if (!response.ok) throw new Error(data.error || "Tool execution failed");
  return data.result;
}

/**
 * Files API
 */
export interface FileInfo {
  name: string;
  isDirectory: boolean;
  path: string;
  size: number;
  modified: string;
}

export async function listFiles(path: string = "."): Promise<FileInfo[]> {
  const response = await fetch(
    `${API_BASE}/api/files/list?path=${encodeURIComponent(path)}`,
  );
  if (!response.ok) throw new Error(`Files: HTTP ${response.status}`);
  const data = await safeJson<{ files?: FileInfo[] }>(response);
  return data.files || [];
}

export async function getFileContent(path: string): Promise<string> {
  const response = await fetch(
    `${API_BASE}/api/files/content?path=${encodeURIComponent(path)}`,
  );
  if (!response.ok) throw new Error(`File Content: HTTP ${response.status}`);
  const data = await safeJson<{ content?: string }>(response);
  return data.content || "";
}

/**
 * Robotkéz (Browser-Use) API
 * Calls the Python Subsystem at http://localhost:8000
 */
const PYTHON_API_BASE = "http://localhost:8000";

export interface BrowserStatus {
  active: boolean;
  sessionId?: string | null;
  currentUrl?: string | null;
  startedAt?: string | null;
  lastScreenshotAt?: string | null;
}

export interface BrowserStartOptions {
  headless?: boolean;
  startUrl?: string;
  sessionName?: string;
}

export async function startBrowser(
  options?: BrowserStartOptions,
): Promise<unknown> {
  const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  return safeJson(response);
}

export async function stopBrowser(sessionId?: string): Promise<unknown> {
  const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionId ? { sessionId } : {}),
  });
  return safeJson(response);
}

export async function getBrowserStatus(): Promise<BrowserStatus> {
  const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/status`);
  return safeJson<BrowserStatus>(response);
}

export async function runRobotkezTest(
  level: 1 | 2 | 3,
): Promise<{ status: string; sessionId: string; level: number }> {
  const response = await fetchWithTimeout(
    `${PYTHON_API_BASE}/test/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    },
    180000,
  ); // 3 minute timeout for tests
  if (!response.ok) throw new Error(`Robotkéz: HTTP ${response.status}`);
  return safeJson<{ status: string; sessionId: string; level: number }>(
    response,
  );
}

export async function getRobotkezScreenshot(): Promise<string> {
  return `${PYTHON_API_BASE}/browser/screenshot/latest?t=${Date.now()}`;
}

export async function getN8nWorkflows(): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/n8n/workflows`,
    {},
    15000,
  );
  if (!response.ok) throw new Error(`n8n: HTTP ${response.status}`);
  return safeJson<unknown>(response);
}

/**
 * RobotkezV2 API (New Persistent Browser + LLM Planning)
 */
export interface RobotkezChatRequest {
  instruction: string;
}

export interface RobotkezPlanRequest {
  instruction: string;
}

export interface RobotkezExecRequest {
  action: string;
  [key: string]: unknown; // Other action params (url, selector, text, etc.)
}

export interface ExecutionStep {
  action: string;
  description: string;
  selector?: string;
  text?: string;
  url?: string;
  key?: string;
  target?: string;
  timeout?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  type?: 'text' | 'attribute' | 'html';
  attribute?: string;
}

export interface ExecutionPlan {
  plan: ExecutionStep[];
  estimatedDuration: number;
  backgroundEligible: boolean;
}

export interface RobotkezPlanResponse {
  success: boolean;
  plan: ExecutionPlan;
  message: string;
}

export interface RobotkezTasksResponse {
  success: boolean;
  tasks: BackgroundTask[];
  count: number;
}

export interface BackgroundTask {
  id: string;
  instruction: string;
  plan: ExecutionPlan;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  progress: number;
  startedAt: number;
  completedAt?: number;
  steps: TaskStep[];
  currentStepIndex: number;
  error?: string;
}

export interface TaskStep {
  action: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  description: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface RobotkezStatusResponse {
  success: boolean;
  agent: {
    name: string;
    role: string;
    capabilities: string[];
  };
  browser: {
    active: boolean;
    type: string;
    engine: string;
  };
  tasks: {
    total: number;
    running: number;
    completed: number;
    error: number;
  };
}

export async function robotkezChat(instruction: string): Promise<RobotkezChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
    },
    LONG_TIMEOUT_MS
  );
  const data = await safeJson<RobotkezChatResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  } as RobotkezChatResponse));
  if (!response.ok) throw new Error(data.error || 'Robotkez chat failed');
  return data;
}

export async function robotkezPlan(instruction: string): Promise<RobotkezPlanResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/plan`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
    },
    LONG_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Plan: HTTP ${response.status}`);
  return safeJson<RobotkezPlanResponse>(response);
}

export async function robotkezExec(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/exec`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    },
    DEFAULT_TIMEOUT_MS
  );
  const data = await safeJson<ApiErrorResponse>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || 'Robotkez exec failed');
  return data;
}

export async function robotkezStatus(): Promise<RobotkezStatusResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/status`);
  if (!response.ok) throw new Error(`Status: HTTP ${response.status}`);
  return safeJson<RobotkezStatusResponse>(response);
}

export async function robotkezGetTasks(status?: string, limit?: number): Promise<RobotkezTasksResponse> {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (limit) qs.set('limit', String(limit));

  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/tasks${qs.toString() ? `?${qs.toString()}` : ''}`
  );
  if (!response.ok) throw new Error(`Tasks: HTTP ${response.status}`);
  return safeJson<RobotkezTasksResponse>(response);
}

export async function robotkezGetTaskById(id: string): Promise<{ success: boolean; task: BackgroundTask }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/tasks/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Task ${id}: HTTP ${response.status}`);
  return safeJson<{ success: boolean; task: BackgroundTask }>(response);
}

export async function robotkezCancelTask(id: string): Promise<{ success: boolean; cancelled: boolean }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/tasks/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error(`Cancel ${id}: HTTP ${response.status}`);
  return safeJson<{ success: boolean; cancelled: boolean }>(response);
}

// -----------------------------------------------------------------------
// COMPUTER USE — OS szintű vezérlés (pyautogui proxy)
// -----------------------------------------------------------------------

export interface ComputerScreenshot {
  status: string;
  screenshot_b64: string;
}

export interface ComputerScreenSize {
  width: number;
  height: number;
}

export interface ComputerClickResult {
  status: string;
  action: string;
  x: number;
  y: number;
}

/** Képernyőfotó készítése pyautogui-val — base64 PNG */
export async function computerScreenshot(): Promise<ComputerScreenshot> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/screenshot`);
  if (!r.ok) throw new Error(`computer/screenshot: HTTP ${r.status}`);
  return safeJson<ComputerScreenshot>(r);
}

/** Képernyő felbontás lekérdezése */
export async function computerScreenSize(): Promise<ComputerScreenSize> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/screen-size`);
  if (!r.ok) throw new Error(`computer/screen-size: HTTP ${r.status}`);
  return safeJson<ComputerScreenSize>(r);
}

/** Kattintás abszolút koordinátára */
export async function computerClick(x: number, y: number, clicks = 1): Promise<ComputerClickResult> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, clicks })
  });
  if (!r.ok) throw new Error(`computer/click: HTTP ${r.status}`);
  return safeJson<ComputerClickResult>(r);
}

/** Kattintás százalékos koordinátára (0.0–1.0, felbontás-független) */
export async function computerClickPct(x_pct: number, y_pct: number, clicks = 1): Promise<ComputerClickResult> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/click-pct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x_pct, y_pct, clicks })
  });
  if (!r.ok) throw new Error(`computer/click-pct: HTTP ${r.status}`);
  return safeJson<ComputerClickResult>(r);
}

/** Szöveg begépelése az aktív ablakba */
export async function computerType(text: string, interval?: number): Promise<{ status: string }> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...(interval !== undefined ? { interval } : {}) })
  });
  if (!r.ok) throw new Error(`computer/type: HTTP ${r.status}`);
  return safeJson<{ status: string }>(r);
}

/** Vision alapú kattintás — leírás alapján megkeresi az elemet */
export async function computerVisionClick(description: string): Promise<{ status: string; action: string }> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/vision-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  });
  if (!r.ok) throw new Error(`computer/vision-click: HTTP ${r.status}`);
  return safeJson<{ status: string; action: string }>(r);
}

/** Comet Auto: autonóm multi-step feladat-végrehajtás (Planner → Actor → Critic) */
export interface CometAutoResult {
  status: string;
  comet_result: {
    success: boolean;
    attempts: number;
    steps_completed: number;
    error: string | null;
  };
  step_log: Array<Record<string, unknown>>;
}

export async function computerAutoTask(task: string, maxRetries = 3): Promise<CometAutoResult> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/computer/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, max_retries: maxRetries })
  });
  if (!r.ok) throw new Error(`computer/auto: HTTP ${r.status}`);
  return safeJson<CometAutoResult>(r);
}

// -----------------------------------------------------------------------
// ROBOTKÉZ TRAINING — háttér tréning vezérlés
// -----------------------------------------------------------------------

export interface TrainingStatusResponse {
  running: boolean;
  mode: string;
  started_at: string | null;
  pid: number | null;
  exit_code: number | null;
}

/** Tréning indítása háttérben */
export async function robotkezTrainingStart(
  mode: 'basic' | 'workflows' = 'basic',
  hours = 4,
  retries = 3
): Promise<{ status: string; mode: string; pid: number | null }> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/training/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, hours, retries })
  });
  if (!r.ok) {
    const data = await r.json() as { detail?: string };
    throw new Error(data.detail || `training/start: HTTP ${r.status}`);
  }
  return safeJson<{ status: string; mode: string; pid: number | null }>(r);
}

/** Tréning állapot lekérdezése */
export async function robotkezTrainingStatus(): Promise<TrainingStatusResponse> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/training/status`);
  return safeJson<TrainingStatusResponse>(r);
}

/** Tréning leállítása */
export async function robotkezTrainingStop(): Promise<{ status: string }> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/training/stop`, {
    method: 'POST'
  });
  return safeJson<{ status: string }>(r);
}

// -----------------------------------------------------------------------
// CHROME DEVTOOLS — debug, network, konzol, performance
// -----------------------------------------------------------------------

export interface DevToolsNetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  resourceType?: string;
}

export interface DevToolsConsoleMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  line?: number;
}

export interface DevToolsPerformanceMetrics {
  domLoadTime: number;
  firstContentfulPaint: number;
  totalBlockingTime: number;
  resourceCount: number;
  pageLoadTime: number;
}

export interface DevToolsDebugReport {
  url: string;
  timestamp: string;
  network: {
    totalRequests: number;
    failedRequests: number;
    requests: DevToolsNetworkRequest[];
    failedRequestsList: Array<{ url: string; error: string }>;
  };
  console: {
    errors: DevToolsConsoleMessage[];
    warnings: DevToolsConsoleMessage[];
  };
  performance: DevToolsPerformanceMetrics;
  summary: string;
}

/** Teljes debug riport (network + console + performance) */
export async function robotkezDevToolsReport(url: string): Promise<{
  success: boolean;
  report: DevToolsDebugReport;
  markdown: string;
}> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/devtools/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }, LONG_TIMEOUT_MS);
  return safeJson(r);
}

/** Hálózati kérések rögzítése */
export async function robotkezDevToolsNetwork(url: string, duration?: number): Promise<{
  success: boolean;
  requests: DevToolsNetworkRequest[];
  failedRequests: Array<{ url: string; error: string }>;
}> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/devtools/network`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, duration }),
  }, LONG_TIMEOUT_MS);
  return safeJson(r);
}

/** Konzol hibák és figyelmeztetések */
export async function robotkezDevToolsConsole(url: string, duration?: number): Promise<{
  success: boolean;
  errors: DevToolsConsoleMessage[];
  warnings: DevToolsConsoleMessage[];
}> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/devtools/console`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, duration }),
  }, LONG_TIMEOUT_MS);
  return safeJson(r);
}

/** Performance metrikák */
export async function robotkezDevToolsPerformance(url: string): Promise<{
  success: boolean;
  metrics: DevToolsPerformanceMetrics;
}> {
  const r = await fetchWithTimeout(`${API_BASE}/api/v1/robotkez/devtools/performance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }, LONG_TIMEOUT_MS);
  return safeJson(r);
}

export type BrowserCopilotMode = 'observe' | 'guide' | 'auto';
export type BrowserCopilotEnginePreference = 'auto' | 'chrome-acp' | 'robotkez';
export type BrowserCopilotStatus = 'idle' | 'planning' | 'waiting-confirmation' | 'executing' | 'paused' | 'completed' | 'error';

export interface BrowserCopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export interface BrowserCopilotExecutionStep {
  action: string;
  description: string;
  selector?: string;
  url?: string;
  text?: string;
  key?: string;
  target?: string;
  timeout?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  type?: 'text' | 'attribute' | 'html';
  attribute?: string;
}

export interface BrowserCopilotExecutionPlan {
  plan: BrowserCopilotExecutionStep[];
  estimatedDuration: number;
  requiresUserInput?: string[];
  backgroundEligible: boolean;
  contextNeeded?: string[];
}

export interface BrowserCopilotSessionState {
  sessionId: string;
  status: BrowserCopilotStatus;
  mode: BrowserCopilotMode;
  enginePreference: BrowserCopilotEnginePreference;
  browserEndpoint: string;
  viewportEngine: 'chrome-acp' | 'robotkez';
  actionEngine: 'robotkez';
  chromeAcpReachable: boolean;
  overlayEnabled: boolean;
  paused: boolean;
  currentInstruction?: string;
  pendingInstruction?: string;
  plan?: BrowserCopilotExecutionPlan;
  lastTaskId?: string;
  lastScreenshotUrl?: string;
  lastUpdatedAt: number;
  messages: BrowserCopilotMessage[];
}

export interface BrowserCopilotSessionResponse {
  success: boolean;
  session: BrowserCopilotSessionState;
}

export async function browserCopilotGetSession(): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/session`);
  if (!response.ok) throw new Error(`Browser Copilot session: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotConfigure(config: {
  mode?: BrowserCopilotMode;
  enginePreference?: BrowserCopilotEnginePreference;
  overlayEnabled?: boolean;
}): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/session/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error(`Browser Copilot configure: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotSendMessage(instruction: string): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction }),
  }, LONG_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Browser Copilot message: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotConfirm(): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/confirm`, {
    method: 'POST',
  }, LONG_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Browser Copilot confirm: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotPause(): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/pause`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Browser Copilot pause: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotResume(): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/resume`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Browser Copilot resume: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export async function browserCopilotReset(): Promise<BrowserCopilotSessionResponse> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/browser-copilot/reset`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Browser Copilot reset: HTTP ${response.status}`);
  return safeJson<BrowserCopilotSessionResponse>(response);
}

export interface DatasetStats {
  total_samples: number;
  sources: Record<string, number>;
  avg_quality: number;
  last_updated: string;
}

export async function addGoldSample(
  prompt: string,
  completion: string,
  source: string = "manual",
  quality: number = 1.0,
): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/incubator/gold-sample`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, completion, source, quality }),
    },
  );
  return safeJson<unknown>(response);
}

export async function getIncubatorStats(): Promise<DatasetStats> {
  const response = await fetchWithTimeout(`${API_BASE}/api/incubator/stats`);
  if (!response.ok) throw new Error(`Incubator Stats: HTTP ${response.status}`);
  const data = await safeJson<{ stats: DatasetStats }>(response);
  return data.stats;
}

export async function trainModel(config?: Record<string, unknown>): Promise<{ success: boolean; message: string; task_id?: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/incubator/train`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {}),
    },
    LONG_TIMEOUT_MS // Training lehet hosszú
  );
  const data = await safeJson<{ success?: boolean; message?: string; task_id?: string; error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  } as { success?: boolean; message?: string; task_id?: string; error?: string }));
  if (!response.ok) throw new Error(data.error || 'Training failed');
  return {
    success: data.success ?? true,
    message: data.message || 'Training started.',
    task_id: data.task_id,
  };
}

/**
 * Developer Agent API (Pipeline-based)
 */
export interface DeveloperPipelinePhase {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface DeveloperPipeline {
  taskId: string;
  task: string;
  status: string;
  phases: DeveloperPipelinePhase[];
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface DeveloperStatus {
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
}

export interface DeveloperHistoryEntry {
  taskId: string;
  task: string;
  status: string;
  createdAt: number;
  completedAt?: number;
}

export async function getDeveloperStatus(): Promise<DeveloperStatus> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/status`,
  );
  if (!response.ok)
    throw new Error(`Developer Status: HTTP ${response.status}`);
  return safeJson<DeveloperStatus>(response);
}

export async function getDeveloperHistory(
  limit: number = 20,
): Promise<DeveloperHistoryEntry[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/history?limit=${limit}`,
  );
  if (!response.ok)
    throw new Error(`Developer History: HTTP ${response.status}`);
  const data = await safeJson<{ history: DeveloperHistoryEntry[] }>(response);
  return data.history;
}

export async function executeDeveloperTask(
  task: string,
  context?: Record<string, unknown>,
): Promise<{ taskId: string }> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, context }),
    },
    LONG_TIMEOUT_MS,
  );
  if (!response.ok) {
    const data = await safeJson<{ error?: string; taskId?: string }>(response).catch(() => ({
      error: `HTTP ${response.status}`,
    } as { error?: string; taskId?: string }));
    throw new Error(data.error || "Developer task failed");
  }
  return safeJson<{ taskId: string }>(response);
}

export async function getDeveloperPipeline(
  taskId: string,
): Promise<DeveloperPipeline> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/pipeline/${taskId}`,
  );
  if (!response.ok)
    throw new Error(`Developer Pipeline: HTTP ${response.status}`);
  const data = await safeJson<{ pipeline: DeveloperPipeline }>(response);
  return data.pipeline;
}

// Developer Metrics (P10)
export interface DeveloperMetricsData {
  builds: {
    total: number;
    success: number;
    fail: number;
    lastStatus: "success" | "fail" | "unknown";
    lastDurationMs: number;
    lastTimestamp?: number;
  };
  tests: {
    totalRuns: number;
    lastPassRate: number;
    lastDurationMs: number;
    lastTimestamp?: number;
  };
  tasks: {
    total: number;
    success: number;
    error: number;
    avgDurationMs: number;
  };
  ai: {
    totalTokenUsage: number;
    estimatedCost: number;
  };
  history: Array<{
    type: "task" | "build" | "test";
    status: "success" | "fail" | "error";
    details: string;
    durationMs: number;
    timestamp: number;
  }>;
}

export async function getDeveloperMetrics(): Promise<DeveloperMetricsData> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/metrics`,
  );
  if (!response.ok)
    throw new Error(`Developer Metrics: HTTP ${response.status}`);
  const data = await safeJson<{ metrics: DeveloperMetricsData }>(response);
  return data.metrics;
}

// Approval Flow (P11)
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  type: "file_edit" | "command_exec" | "critical_action";
  description: string;
  metadata?: unknown;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt: number;
  response?: unknown;
  respondedAt?: number;
}

export async function listApprovals(
  status?: ApprovalStatus,
): Promise<ApprovalRequest[]> {
  const qs = status ? `?status=${status}` : "";
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval${qs}`,
  );
  if (!response.ok) throw new Error(`Approval list: HTTP ${response.status}`);
  const data = await safeJson<{ requests: ApprovalRequest[] }>(response);
  return data.requests || [];
}

export async function respondApprovalRequest(
  id: string,
  action: "approve" | "reject",
  responsePayload?: unknown,
): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval/${id}/respond`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, response: responsePayload }),
    },
  );
  const data = await safeJson<{ error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || "Approval response failed");
}

// Activity Feed (P12)
export type ActivityType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "approval";
export type ActivitySource =
  | "system"
  | "agent"
  | "user"
  | "pipeline"
  | "git"
  | "queue";

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  source: ActivitySource;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export async function getActivityFeed(
  limit: number = 50,
): Promise<ActivityFeedItem[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/feed?limit=${limit}`,
  );
  if (!response.ok) throw new Error(`Activity feed: HTTP ${response.status}`);
  const data = await safeJson<{ activities: ActivityFeedItem[] }>(response);
  return data.activities || [];
}

export type NotificationDeliveryChannel =
  | 'email'
  | 'slack'
  | 'discord'
  | 'system';

export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface ApprovalNotificationDelivery {
  id: string;
  workflowId?: string;
  approvalRequestId?: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  eventType: 'approval_requested' | 'approval_resolved' | 'approval_expired';
  title: string;
  message: string;
  error?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalNotificationChannelAvailability {
  channel: 'email' | 'slack' | 'discord';
  enabled: boolean;
  target?: string;
}

export interface ApprovalNotificationChannelPolicy {
  channel: 'email' | 'slack' | 'discord';
  enabled: boolean;
  eventTypes: Array<'approval_requested' | 'approval_resolved' | 'approval_expired'>;
  fallbackChannel?: 'email' | 'slack' | 'discord';
}

export interface ApprovalNotificationSummary {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  byChannel: Partial<Record<NotificationDeliveryChannel, number>>;
  availableChannels: ApprovalNotificationChannelAvailability[];
  channelPolicies?: ApprovalNotificationChannelPolicy[];
  workflowCounts: {
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
  };
}

export async function getApprovalNotificationDeliveries(
  limit: number = 20,
): Promise<ApprovalNotificationDelivery[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval/notifications?limit=${limit}`,
  );
  if (!response.ok) {
    throw new Error(`Approval notifications: HTTP ${response.status}`);
  }

  const data = await safeJson<{ deliveries: ApprovalNotificationDelivery[] }>(response);
  return data.deliveries || [];
}

export async function getApprovalNotificationSummary(): Promise<ApprovalNotificationSummary> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval/notifications/summary`,
  );
  if (!response.ok) {
    throw new Error(`Approval notification summary: HTTP ${response.status}`);
  }

  const data = await safeJson<{ summary: ApprovalNotificationSummary }>(response);
  return data.summary;
}

export async function dispatchApprovalWorkflowNotification(
  workflowId: string,
): Promise<ApprovalNotificationDelivery[]> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval/workflows/${encodeURIComponent(workflowId)}/notify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Approval notification dispatch: HTTP ${response.status}`);
  }

  const data = await safeJson<{ success: boolean; deliveries: ApprovalNotificationDelivery[] }>(response);
  return data.deliveries || [];
}

/**
 * System Architecture Status API
 * Track: bas_orchestration_chain_20260221 / Phase 3
 */
export interface ArchitectureStatus {
  timestamp: string;
  ingestion: {
    lancedbRows: number;
    status: 'healthy' | 'empty';
  };
  knowledge: {
    sqliteTasksPending: number;
    sqliteTasksDone: number;
    sqliteTasksFailed: number;
    status: 'healthy' | 'degraded';
  };
  orchestration: {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    chainEnabled: boolean;
    status: 'healthy' | 'degraded';
  };
  security: {
    sandboxEnabled: boolean;
    guardrailsEnabled: boolean;
    goldenSamples: number;
    status: 'hardened' | 'basic';
  };
}

export async function getArchitectureStatus(): Promise<ArchitectureStatus> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/system/architecture-status`,
    {},
    10000,
  );
  if (!response.ok) throw new Error(`Architecture status: HTTP ${response.status}`);
  return safeJson<ArchitectureStatus>(response);
}

// -----------------------------------------------------------------------
// BOOKKEEPING & RECONCILIATION API
// -----------------------------------------------------------------------

export interface BookkeepingTransaction {
  id: string;
  source: string;
  data: unknown;
  status: 'PENDING_MATCH' | 'PARTIALLY_MATCHED' | 'COMPLETED' | 'MANUAL_REVIEW' | 'UNMATCHED' | 'ERROR';
  matchedInvoice?: string;
}

export interface BookkeepingTransactionListResponse {
  success: boolean;
  entries: BookkeepingTransaction[];
  total: number;
}

export async function getBookkeepingTransactions(params: {
  status?: string;
  source?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<BookkeepingTransactionListResponse> {
  const qs = buildQuery(params);
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/bookkeeping/transactions${qs}`);
  if (!response.ok) throw new Error(`Transactions: HTTP ${response.status}`);
  return safeJson<BookkeepingTransactionListResponse>(response);
}

export async function updateBookkeepingTransaction(
  id: string,
  updates: { status: string; matchedInvoice?: string },
): Promise<{ success: boolean; transaction: BookkeepingTransaction }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/bookkeeping/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error(`Update transaction: HTTP ${response.status}`);
  return safeJson(response);
}

export async function sendBookkeepingSummaryEmail(): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/bookkeeping/summary-email`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Email summary: HTTP ${response.status}`);
  return safeJson(response);
}

export async function getReconciliationEvents(runId?: string): Promise<{ success: boolean; events: unknown[] }> {
  const qs = runId ? `?run_id=${encodeURIComponent(runId)}` : '';
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/bookkeeping/reconciliation-events${qs}`);
  if (!response.ok) throw new Error(`Events: HTTP ${response.status}`);
  return safeJson(response);
}

// -----------------------------------------------------------------------
// INVENTORY & STOCK MANAGEMENT API
// -----------------------------------------------------------------------

export interface InventoryValuationRow {
  sku: string;
  name: string;
  unit: string;
  valuation_method: string;
  current_stock: number;
  fifo_stock_value: number;
  wac_stock_value: number;
}

export interface InventoryStocktakeSummary {
  id: string;
  sku: string;
  name: string;
  discrepancy: number;
  discrepancy_value: number;
  status: string;
  created_at: string;
}

export async function fetchInventoryValuation(): Promise<InventoryValuationRow[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/inventory/valuation`, {}, 15000);
  if (!response.ok) throw new Error(`Inventory valuation: HTTP ${response.status}`);
  const data = await safeJson<{ success: boolean; summary: InventoryValuationRow[] }>(response);
  return data.summary || [];
}

export async function fetchOpenStocktakes(): Promise<InventoryStocktakeSummary[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/inventory/stocktake/open`, {}, 10000);
  if (!response.ok) throw new Error(`Open stocktakes: HTTP ${response.status}`);
  const data = await safeJson<{ success: boolean; stocktakes: InventoryStocktakeSummary[] }>(response);
  return data.stocktakes || [];
}
