import axios from "axios";
import {
  createZeroPromptEdgeMirrorEnvelope,
  type ZeroPromptEdgeSummary,
} from "../core/zeroPromptEdgeMirrorSummary.js";

export interface CloudflareTaskResponse {
  success: boolean;
  taskId: string;
  type: string;
  result?: unknown;
  message: string;
}

type CloudflareHistoryResponse = {
  tasks?: unknown[];
};

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
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
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
      const response = await axios.post<CloudflareTaskResponse>(
        `${this.baseUrl}/task`,
        {
          instruction,
          context,
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 60000, // A kódgenerálás eltarthat egy ideig
        },
      );

      return response.data;
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Cloudflare submission failed: ${message}`);
    }
  }

  async checkStatus(taskId: string): Promise<unknown> {
    try {
      const response = await axios.get(`${this.baseUrl}/status/${taskId}`);
      return response.data;
    } catch (error: unknown) {
      const message = this.getAxiosErrorMessage(error);
      throw new Error(`Status check failed: ${message}`);
    }
  }

  async fetchHistory(limit: number = 20): Promise<CloudflareHistoryResponse> {
    try {
      const response = await axios.get<CloudflareHistoryResponse>(`${this.baseUrl}/history?limit=${limit}`);
      return response.data;
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
