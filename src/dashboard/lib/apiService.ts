/**
 * API Service for Dashboard - Backend Communication
 * Centralized API calls to the MCP Brunella Core backend
 */

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
  } catch (error: any) {
    if (error.name === "AbortError") {
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

export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    ollama: any;
    anythingllm: any;
    agents: any;
    mcp: any;
    python: any;
    cloudflare: any;
  };
}

export interface Agent {
  name: string;
  role: string;
  description: string;
}

export interface AgentStatus {
  name: string;
  description: string;
  status: "idle" | "working" | "error" | "loaded";
  lastTaskAt?: string;
  successCount?: number;
  errorCount?: number;
  lastTask?: string;
}

export interface Task {
  id: number;
  description: string;
  agent_name: string;
  status: string;
  context?: string;
  result?: string;
  created_at: string;
  updated_at: string;
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

export interface QueuedTask {
  id: number;
  agent: string;
  task: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  context?: string;
  result?: string;
}

export interface TasksResponse {
  tasks: QueuedTask[];
  total: number;
  limit: number;
  offset: number;
  status?: string;
}

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

export async function getActiveTasks(): Promise<QueuedTask[]> {
  try {
    const data = await getTasks(50, 0, "running");
    return data.tasks || [];
  } catch {
    return [];
  }
}

export async function getTaskById(taskId: number): Promise<QueuedTask> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/${taskId}`);
  if (!response.ok) throw new Error(`Task: HTTP ${response.status}`);
  const data = await safeJson<{ task: QueuedTask }>(response);
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

export async function getTaskStats(): Promise<TaskStats> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/stats`);
  if (!response.ok) throw new Error(`Task Stats: HTTP ${response.status}`);
  const data = await safeJson<{ stats: TaskStats }>(response);
  return data.stats;
}

export async function executePendingTask(): Promise<any> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/execute`, {
    method: "POST",
  });
  const data: any = await safeJson<{ result?: any; error?: string }>(
    response,
  ).catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || "Task execute failed");
  return data.result;
}

export async function cancelTask(taskId: number): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE}/api/tasks/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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

export async function getProvidersStatus(): Promise<ProviderStatus[]> {
  const response = await fetchWithTimeout(`${API_BASE}/api/providers/status`);
  if (!response.ok)
    throw new Error(`Providers Status: HTTP ${response.status}`);
  const data = await safeJson<{ providers?: ProviderStatus[] }>(response);
  return data.providers || [];
}

export async function executeAgent(
  agentName: string,
  task: string,
  context?: any,
): Promise<any> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/agents/${encodeURIComponent(agentName)}/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, context }),
    },
    LONG_TIMEOUT_MS, // 2 minutes for agent execution
  );
  const data: any = await safeJson<{ result?: any; error?: string }>(
    response,
  ).catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || "Agent execution failed");
  return data.result;
}

export async function createAgent(config: {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  triggers?: string[];
}): Promise<any> {
  const response = await fetchWithTimeout(`${API_BASE}/api/agents/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const data: any = await safeJson<{ status?: string; error?: string }>(
    response,
  ).catch(() => ({ error: `HTTP ${response.status}` }));
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
  if (!response.ok) throw new Error(data.error || "Ollama generation failed");
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
    throw new Error(data.error || "GitHub Models generation failed");
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
  if (!response.ok) throw new Error(data.error || "Gemini generation failed");
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
export async function getChatMessages(chatId?: string): Promise<any[]> {
  const url = chatId
    ? `${API_BASE}/api/chat/messages?chatId=${chatId}`
    : `${API_BASE}/api/chat/messages`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Chat: HTTP ${response.status}`);
  const data = await safeJson<{ messages?: any[] }>(response);
  return data.messages || [];
}

/**
 * Tools API
 */
export async function getTools(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/tools`);
  if (!response.ok) throw new Error(`Tools: HTTP ${response.status}`);
  const data = await safeJson<{ tools?: any[] }>(response);
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
  service: "ollama" | "python" | "anythingllm",
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
  service: "ollama" | "python",
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

export async function executeTool(toolName: string, args: any): Promise<any> {
  const response = await fetch(
    `${API_BASE}/api/tools/${encodeURIComponent(toolName)}/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  const data = await safeJson<{ result?: any; error?: string }>(response).catch(
    (): { result?: any; error?: string } => ({ error: `HTTP ${response.status}` }),
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
): Promise<any> {
  const response = await fetchWithTimeout(`${PYTHON_API_BASE}/browser/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  return safeJson(response);
}

export async function stopBrowser(sessionId?: string): Promise<any> {
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
  [key: string]: any; // Other action params (url, selector, text, etc.)
}

export interface ExecutionStep {
  action: string;
  description: string;
  selector?: string;
  text?: string;
  url?: string;
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

export async function robotkezChat(instruction: string): Promise<any> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction }),
    },
    LONG_TIMEOUT_MS
  );
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
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

export async function robotkezExec(action: string, params: Record<string, any> = {}): Promise<any> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/robotkez/exec`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    },
    DEFAULT_TIMEOUT_MS
  );
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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

/**
 * Incubator (Training) API
 */
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
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
    error: `HTTP ${response.status}`,
  }));
  if (!response.ok) throw new Error(data.error || 'Training failed');
  return data;
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
    const data = await safeJson<{ error?: string }>(response).catch(() => ({
      error: `HTTP ${response.status}`,
    }));
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
  metadata?: any;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt: number;
  response?: any;
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
  responsePayload?: any,
): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/developer/approval/${id}/respond`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, response: responsePayload }),
    },
  );
  const data: any = await safeJson<{ error?: string }>(response).catch(() => ({
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
