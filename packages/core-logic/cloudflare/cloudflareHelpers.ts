import { ensureError } from "@packages/utils/ensureError.js";
import { getCloudflareAuthHeaders } from "@packages/utils/cloudflareConfig.js";
import { logDebug } from "@packages/utils/logger.js";

type JsonRecord = Record<string, unknown>;

export interface WorkerDefinition extends JsonRecord {
  id: string;
  name: string;
  url?: string;
  customDomain?: string;
  kind: "public" | "internal";
}

export interface WorkerTaskProxyResponse extends JsonRecord {
  success: boolean;
  workerId: string;
  workerName: string;
  endpoint?: string;
  result?: unknown;
  error?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function pickFirstEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
}

export function getCloudflareWorkersInventory(): WorkerDefinition[] {
  const orchestratorUrl = pickFirstEnv(
    process.env.CLOUDFLARE_D1_WORKER_URL,
    process.env.CLOUDFLARE_WORKER_URL,
  );
  const chatUrl = pickFirstEnv(process.env.CLOUDFLARE_CHAT_URL);
  const chatSyncUrl = pickFirstEnv(process.env.CLOUDFLARE_CHAT_SYNC_URL);

  return [
    {
      id: "cean-orchestrator",
      name: "cean-orchestrator",
      url: orchestratorUrl || "https://cean-orchestrator.iam-dd1.workers.dev",
      customDomain: "api.bas.peterpohanka.com",
      kind: "public",
    },
    {
      id: "chat-sync",
      name: "chat-sync",
      url: chatSyncUrl || "https://bas-orchestrator.peterpohankapersonal.workers.dev",
      customDomain: "brunella.peterpohanka.com",
      kind: "public",
    },
    {
      id: "brunella-cf",
      name: "brunella-cf",
      url: pickFirstEnv(process.env.CF_WORKER_BRUNELLA_CF_URL) || "https://brunella-cf.iam-dd1.workers.dev",
      kind: "public",
    },
    {
      id: "agents-api",
      name: "agents-api",
      url: pickFirstEnv(process.env.CF_WORKER_AGENTS_API_URL),
      kind: "internal",
    },
    {
      id: "saas-admin",
      name: "saas-admin",
      url: pickFirstEnv(process.env.CF_WORKER_SAAS_ADMIN_URL),
      kind: "internal",
    },
    {
      id: "llm-chat-app-template",
      name: "llm-chat-app-template",
      url: chatUrl || "https://llm-chat-app-template.iam-dd1.workers.dev",
      kind: "public",
    },
    {
      id: "throbbing-fire",
      name: "throbbing-fire",
      url: pickFirstEnv(process.env.CF_WORKER_THROBBING_FIRE_URL),
      kind: "internal",
    },
  ];
}

export async function postTaskToWorker(
  worker: WorkerDefinition,
  instruction: string,
  context: Record<string, unknown>,
): Promise<WorkerTaskProxyResponse> {
  if (!worker.url) {
    return {
      success: false,
      workerId: worker.id,
      workerName: worker.name,
      error: "Worker URL is not configured",
    };
  }

  const base = normalizeBaseUrl(worker.url);
  const endpoints = ["/task", "/api/task", "/api/v1/task", "/"];
  const headers = getCloudflareAuthHeaders();

  let lastError = "Worker task proxy failed";

  for (const endpoint of endpoints) {
    const url = `${base}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          instruction,
          task: instruction,
          context,
        }),
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) as unknown : "";
      } catch (error: unknown) {
        logDebug("CloudflareHelpers", `Worker response JSON parse skipped: ${ensureError(error).message}`);
      }

      if (response.ok) {
        return {
          success: true,
          workerId: worker.id,
          workerName: worker.name,
          endpoint,
          result: parsed,
        };
      }

      lastError = `HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`;
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logDebug("CloudflareHelpers", `Worker task proxy failed at ${endpoint}: ${normalized.message}`);
      lastError = normalized.message;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    success: false,
    workerId: worker.id,
    workerName: worker.name,
    error: lastError,
  };
}

