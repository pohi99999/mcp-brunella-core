import axios from "axios";
import {
  createZeroPromptEdgeMirrorEnvelope,
  type ZeroPromptEdgeSummary,
} from "../core/zeroPromptEdgeMirrorSummary.js";
import { getBasCloudflareApiToken } from "./cloudflareConfig.js";

type JsonRecord = Record<string, unknown>;

export interface CloudflareTaskResponse extends JsonRecord {
  success: boolean;
  taskId: string;
  type: string;
  result?: unknown;
  message: string;
  error?: string;
}

export interface CloudflareTaskStatusResponse extends JsonRecord {
  taskId?: string;
  id?: string;
  status: string;
  progress?: number;
  currentStep?: string;
  result?: unknown;
  error?: string;
}

export interface CloudflareHistoryTask extends JsonRecord {
  id: string;
  instruction: string;
  status: string;
  created_at?: string;
  createdAt?: string;
  taskId?: string;
  type?: string;
  result?: unknown;
}

export interface CloudflareHistoryResponse extends JsonRecord {
  tasks?: CloudflareHistoryTask[];
}

export interface CloudflareWorkerRecord extends JsonRecord {
  id?: string;
  agent_name?: string;
  is_healthy?: boolean;
  avg_latency_ms?: number;
  worker_url?: string;
}

export interface CloudflareRoutingRecord extends JsonRecord {
  agent_name: string;
  worker_url: string;
}

export interface CloudflareDispatchResponse extends JsonRecord {
  requestId?: string;
  status?: string;
  workerUrl?: string;
  result?: unknown;
  error?: string;
  success?: boolean;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeTaskResponse(data: unknown): CloudflareTaskResponse {
  if (!isRecord(data)) {
    return {
      success: false,
      taskId: "",
      type: "",
      message: String(data),
    };
  }

  const taskId = pickString(data.taskId, data.id) ?? "";
  const type = pickString(data.type) ?? "";
  const message = pickString(data.message) ?? "";

  return {
    ...data,
    success: typeof data.success === "boolean" ? data.success : Boolean(data.success),
    taskId,
    type,
    message,
  };
}

function normalizeTaskStatusResponse(data: unknown): CloudflareTaskStatusResponse {
  if (!isRecord(data)) {
    return {
      status: pickString(data) ?? "unknown",
    };
  }

  const taskId = pickString(data.taskId, data.id);
  const status = pickString(data.status) ?? "unknown";
  const progress = pickNumber(data.progress);
  const currentStep = pickString(data.currentStep);
  const error = pickString(data.error);

  const normalized: CloudflareTaskStatusResponse = {
    ...data,
    status,
  };

  if (taskId) {
    normalized.taskId = taskId;
  }

  if (pickString(data.id)) {
    normalized.id = pickString(data.id);
  }

  if (typeof progress === "number") {
    normalized.progress = progress;
  }

  if (currentStep) {
    normalized.currentStep = currentStep;
  }

  if (error) {
    normalized.error = error;
  }

  return normalized;
}

function normalizeHistoryTask(data: unknown): CloudflareHistoryTask | null {
  if (!isRecord(data)) {
    return null;
  }

  const id = pickString(data.id, data.taskId);
  const instruction = pickString(data.instruction, data.prompt, data.message);
  const status = pickString(data.status) ?? "unknown";
  const createdAt = pickString(data.created_at, data.createdAt);

  if (!id || !instruction) {
    return null;
  }

  const task: CloudflareHistoryTask = {
    ...data,
    id,
    instruction,
    status,
  };

  if (pickString(data.taskId)) {
    task.taskId = pickString(data.taskId);
  }

  if (pickString(data.type)) {
    task.type = pickString(data.type);
  }

  if (createdAt) {
    task.created_at = createdAt;
    task.createdAt = createdAt;
  }

  return task;
}

function normalizeHistoryResponse(data: unknown): CloudflareHistoryResponse {
  if (!isRecord(data)) {
    return { tasks: [] };
  }

  const rawTasks = Array.isArray(data.tasks)
    ? data.tasks
    : Array.isArray(data.results)
      ? data.results
      : [];

  return {
    ...data,
    tasks: rawTasks
      .map((task) => normalizeHistoryTask(task))
      .filter((task): task is CloudflareHistoryTask => task !== null),
  };
}

function normalizeWorkerRecord(data: unknown): CloudflareWorkerRecord | null {
  if (!isRecord(data)) {
    return null;
  }

  const record: CloudflareWorkerRecord = {
    ...data,
  };

  const id = pickString(data.id);
  const agentName = pickString(data.agent_name);
  const workerUrl = pickString(data.worker_url);

  if (id) {
    record.id = id;
  }

  if (agentName) {
    record.agent_name = agentName;
  }

  if (typeof data.is_healthy === "boolean") {
    record.is_healthy = data.is_healthy;
  }

  const avgLatencyMs = pickNumber(data.avg_latency_ms);
  if (typeof avgLatencyMs === "number") {
    record.avg_latency_ms = avgLatencyMs;
  }

  if (workerUrl) {
    record.worker_url = workerUrl;
  }

  return record;
}

function normalizeWorkerListResponse(data: unknown): CloudflareWorkerRecord[] {
  const rawItems =
    Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.results) ? data.results : [];

  return rawItems
    .map((item) => normalizeWorkerRecord(item))
    .filter((item): item is CloudflareWorkerRecord => item !== null);
}

function normalizeRoutingRecord(data: unknown): CloudflareRoutingRecord | null {
  if (!isRecord(data)) {
    return null;
  }

  const agent_name = pickString(data.agent_name);
  const worker_url = pickString(data.worker_url);

  if (!agent_name || !worker_url) {
    return null;
  }

  return {
    ...data,
    agent_name,
    worker_url,
  };
}

function normalizeRoutingListResponse(data: unknown): CloudflareRoutingRecord[] {
  const rawItems =
    Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.results) ? data.results : [];

  return rawItems
    .map((item) => normalizeRoutingRecord(item))
    .filter((item): item is CloudflareRoutingRecord => item !== null);
}

function normalizeDispatchResponse(data: unknown): CloudflareDispatchResponse {
  if (!isRecord(data)) {
    return {
      success: false,
    };
  }

  const requestId = pickString(data.requestId);
  const status = pickString(data.status);
  const workerUrl = pickString(data.workerUrl);

  return {
    ...data,
    success: typeof data.success === "boolean" ? data.success : Boolean(data.success),
    ...(requestId ? { requestId } : {}),
    ...(status ? { status } : {}),
    ...(workerUrl ? { workerUrl } : {}),
  };
}

export class CloudflareClient {
  private baseUrl: string;
  private apiToken?: string;
  private ceanApiKey?: string;

  constructor(url?: string) {
    this.baseUrl =
      url ||
      process.env.CLOUDFLARE_D1_WORKER_URL ||
      process.env.CLOUDFLARE_WORKER_URL ||
      "https://cean-orchestrator.iam-dd1.workers.dev";
    this.apiToken = getBasCloudflareApiToken() || process.env.CF_API_TOKEN;
    this.ceanApiKey = process.env.CEAN_API_KEY;
  }

  getResolvedBaseUrl(): string {
    return this.baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiToken) {
      headers.Authorization = `Bearer ${this.apiToken}`;
      headers["X-BAS-API-Key"] = this.apiToken;
    }

    if (this.ceanApiKey) {
      headers["X-CEAN-API-Key"] = this.ceanApiKey;
    }

    return headers;
  }

  private getAxiosErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null) {
      const maybeResponse = (error as { response?: { data?: { error?: unknown } } }).response;
      const responseError = maybeResponse?.data?.error;
      if (typeof responseError === "string" && responseError.trim().length > 0) {
        return responseError;
      }

      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
        return maybeMessage;
      }
    }

    return String(error);
  }

  async submitTask(
    instruction: string,
    context: Record<string, unknown> = {},
  ): Promise<CloudflareTaskResponse> {
    try {
      const response = await axios.post<unknown>(
        `${this.baseUrl}/task`,
        {
          instruction,
          context,
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 60000,
        },
      );

      return normalizeTaskResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Cloudflare submission failed: ${message}`);
    }
  }

  async dispatch(
    agent: string,
    task: string,
    context: Record<string, unknown> = {},
    requestId?: string,
  ): Promise<CloudflareDispatchResponse> {
    try {
      const response = await axios.post<unknown>(
        `${this.baseUrl}/dispatch`,
        { agent, task, context, requestId },
        {
          headers: this.getAuthHeaders(),
          timeout: 90000,
        },
      );

      return normalizeDispatchResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Cloudflare dispatch failed: ${message}`);
    }
  }

  async fetchWorkers(): Promise<CloudflareWorkerRecord[]> {
    try {
      const response = await axios.get<unknown>(`${this.baseUrl}/workers`, {
        headers: this.getAuthHeaders(),
      });

      return normalizeWorkerListResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Workers fetch failed: ${message}`);
    }
  }

  async fetchRouting(): Promise<CloudflareRoutingRecord[]> {
    try {
      const response = await axios.get<unknown>(`${this.baseUrl}/routing`, {
        headers: this.getAuthHeaders(),
      });

      return normalizeRoutingListResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Routing fetch failed: ${message}`);
    }
  }

  async checkStatus(taskId: string): Promise<CloudflareTaskStatusResponse> {
    try {
      const response = await axios.get<unknown>(`${this.baseUrl}/status/${taskId}`);
      return normalizeTaskStatusResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Status check failed: ${message}`);
    }
  }

  async fetchHistory(limit: number = 20): Promise<CloudflareHistoryResponse> {
    try {
      const response = await axios.get<unknown>(
        `${this.baseUrl}/history?limit=${limit}`,
      );
      return normalizeHistoryResponse(response.data);
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`History fetch failed: ${message}`);
    }
  }

  async pushZeroPromptSummary(summary: ZeroPromptEdgeSummary): Promise<void> {
    try {
      const envelope = createZeroPromptEdgeMirrorEnvelope(summary);
      await axios.post(
        `${this.baseUrl}/zero-prompt/summary`,
        envelope,
        {
          headers: this.getAuthHeaders(),
          timeout: 60000,
        },
      );
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Zero-Prompt summary push failed: ${message}`);
    }
  }
}

export const cloudflareClient = new CloudflareClient();
