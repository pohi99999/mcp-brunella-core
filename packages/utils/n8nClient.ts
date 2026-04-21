const DEFAULT_N8N_BASE_URL = "http://localhost:5678";
const DEFAULT_TIMEOUT_MS = 15_000;

const READ_ONLY_WORKFLOW_KEYS = new Set([
  "id",
  "versionId",
  "meta",
  "createdAt",
  "updatedAt",
  "tags",
  "ownedBy",
  "ownedById",
  "sharedWith",
]);

export interface N8nClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface N8nWorkflowRecord {
  [key: string]: unknown;
}

export interface N8nCollectionResponse<T> {
  data?: T[];
  workflows?: T[];
  count?: number;
  cursor?: string;
  nextCursor?: string;
  previousCursor?: string;
  [key: string]: unknown;
}

interface N8nRequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  timeoutMs?: number;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function mergeHeaders(base: Record<string, string>, extra?: HeadersInit): Record<string, string> {
  if (!extra) {
    return base;
  }

  const headers = { ...base };

  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  if (Array.isArray(extra)) {
    for (const [key, value] of extra) {
      headers[key] = value;
    }
    return headers;
  }

  return { ...headers, ...extra };
}

function encodeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function parseJsonResponse<T>(text: string): T {
  if (!text.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export function sanitizeWorkflowForWrite(workflow: N8nWorkflowRecord): N8nWorkflowRecord {
  const sanitized: N8nWorkflowRecord = {};

  for (const [key, value] of Object.entries(workflow)) {
    if (READ_ONLY_WORKFLOW_KEYS.has(key) || value === undefined) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export interface N8nExecutionRecord {
  id: string;
  status: 'waiting' | 'running' | 'success' | 'failed' | 'unknown';
  finished: boolean;
  startedAt: string;
  finishedAt?: string;
  workflowId: string;
  [key: string]: unknown;
}

export interface N8nAsyncExecutionResponse {
  executionId: string;
  [key: string]: unknown;
}

export class N8nClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: Partial<N8nClientConfig> = {}) {
    const resolvedBaseUrl =
      config.baseUrl?.trim() || process.env.N8N_BASE_URL || DEFAULT_N8N_BASE_URL;
    const resolvedApiKey = config.apiKey?.trim() || process.env.N8N_API_KEY;
    const resolvedTimeoutMs = config.timeoutMs ?? Number.parseInt(
      process.env.N8N_REQUEST_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
      10,
    );

    this.baseUrl = normalizeBaseUrl(resolvedBaseUrl);
    this.apiKey = resolvedApiKey;
    this.timeoutMs =
      Number.isFinite(resolvedTimeoutMs) && resolvedTimeoutMs > 0
        ? resolvedTimeoutMs
        : DEFAULT_TIMEOUT_MS;
  }

  getResolvedBaseUrl(): string {
    return this.baseUrl;
  }

  hasApiKey(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.trim().length > 0;
  }

  async listWorkflows(): Promise<N8nCollectionResponse<N8nWorkflowRecord>> {
    this.ensureApiKey();
    return this.request<N8nCollectionResponse<N8nWorkflowRecord>>("/api/v1/workflows");
  }

  async getWorkflow(workflowId: string): Promise<N8nWorkflowRecord> {
    this.ensureApiKey();
    return this.request<N8nWorkflowRecord>(`/api/v1/workflows/${encodeURIComponent(workflowId)}`);
  }

  async triggerWorkflow(
    workflowId: string,
    data: Record<string, unknown> = {},
  ): Promise<N8nWorkflowRecord> {
    this.ensureApiKey();
    return this.request<N8nWorkflowRecord>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/run`, {
      method: "POST",
      body: data,
    });
  }

  async getExecution(executionId: string): Promise<N8nExecutionRecord> {
    this.ensureApiKey();
    return this.request<N8nExecutionRecord>(`/api/v1/executions/${encodeURIComponent(executionId)}`);
  }

  async triggerWorkflowAsync(
    workflowId: string,
    data: Record<string, unknown> = {},
  ): Promise<N8nAsyncExecutionResponse> {
    this.ensureApiKey();
    // n8n can be triggered asynchronously by POSTing to the /webhook/ endpoint
    // It immediately returns an execution ID.
    return this.request<N8nAsyncExecutionResponse>(`/api/v1/workflows/${encodeURIComponent(workflowId)}/run`, {
      method: "POST",
      body: { ...data, mode: 'webhook' }, // Assuming 'mode: webhook' triggers async execution
    });
  }

  async createWorkflow(workflow: N8nWorkflowRecord): Promise<N8nWorkflowRecord> {
    this.ensureApiKey();
    return this.request<N8nWorkflowRecord>("/api/v1/workflows", {
      method: "POST",
      body: sanitizeWorkflowForWrite(workflow),
    });
  }

  async createBlankWorkflow(name: string): Promise<N8nWorkflowRecord> {
    return this.createWorkflow({
      name,
      nodes: [],
      connections: {},
      settings: {},
    });
  }

  async updateWorkflow(
    workflowId: string,
    workflow: N8nWorkflowRecord,
  ): Promise<N8nWorkflowRecord> {
    this.ensureApiKey();
    return this.request<N8nWorkflowRecord>(`/api/v1/workflows/${encodeURIComponent(workflowId)}`, {
      method: "PUT",
      body: sanitizeWorkflowForWrite(workflow),
    });
  }

  async renameWorkflow(workflowId: string, newName: string): Promise<N8nWorkflowRecord> {
    const existingWorkflow = await this.getWorkflow(workflowId);
    return this.updateWorkflow(workflowId, {
      ...existingWorkflow,
      name: newName,
    });
  }

  async deleteWorkflow(workflowId: string): Promise<N8nWorkflowRecord | undefined> {
    this.ensureApiKey();
    return this.request<N8nWorkflowRecord | undefined>(
      `/api/v1/workflows/${encodeURIComponent(workflowId)}`,
      {
        method: "DELETE",
      },
    );
  }

  private ensureApiKey(): void {
    if (!this.hasApiKey()) {
      throw new Error("N8N_API_KEY is required for n8n API operations.");
    }
  }

  private async request<T>(path: string, options: N8nRequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: mergeHeaders(
        {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-N8N-API-KEY": this.apiKey } : {}),
        },
        options.headers,
      ),
      body: encodeBody(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `n8n API request failed (${response.status} ${response.statusText}) for ${path}: ${errorText}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    return parseJsonResponse<T>(text);
  }
}
