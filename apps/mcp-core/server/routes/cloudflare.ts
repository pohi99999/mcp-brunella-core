import { Router } from "express";
import { agentManager } from "@packages/agents/AgentManager.js";
import { cloudflareClient } from "@packages/utils/cloudflareClient.js";
import { resolveBrowserCopilotEndpoint } from "@packages/utils/browserEndpoint.js";
import { getCloudflareAuthHeaders } from "@packages/utils/cloudflareConfig.js";
import {
  getCloudflareWorkersInventory as sharedGetCloudflareWorkersInventory,
  postTaskToWorker as sharedPostTaskToWorker,
  type WorkerDefinition,
  type WorkerTaskProxyResponse,
} from "@packages/core-logic/cloudflare/cloudflareHelpers.js";
import { ensureError } from "@packages/utils/ensureError.js";
import { logDebug } from "@packages/utils/logger.js";

type ChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type CloudflareChatProxyResponse = {
  success: boolean;
  message: string;
  raw?: unknown;
  endpoint?: string;
};

type WorkerAuditResult = {
  id: string;
  name: string;
  url?: string;
  customDomain?: string;
  kind: "public" | "internal";
  status: "online" | "offline" | "unknown";
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

function getCloudflareChatBaseUrl(): string {
  return (
    process.env.CLOUDFLARE_CHAT_URL ||
    process.env.CLOUDFLARE_D1_WORKER_URL ||
    process.env.CLOUDFLARE_WORKER_URL ||
    process.env.CLOUDFLARE_CHAT_SYNC_URL ||
    "https://llm-chat-app-template.iam-dd1.workers.dev"
  );
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getCloudflareWorkersInventory(): WorkerDefinition[] {
  return sharedGetCloudflareWorkersInventory();
}

async function postTaskToWorker(
  worker: WorkerDefinition,
  instruction: string,
  context: Record<string, unknown>,
): Promise<WorkerTaskProxyResponse> {
  return sharedPostTaskToWorker(worker, instruction, context);
}

async function checkExternalWorkerHealth(domain: string): Promise<{
  status: "online" | "offline";
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}> {
  const url = `https://${domain}/ping`;
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    if (response.ok || response.status === 401 || response.status === 404 || response.status === 403) {
      // 404/401 is still 'online' for a worker that might not have a /ping but is reachable
      return { status: "online", latencyMs, statusCode: response.status };
    }
    return { status: "offline", statusCode: response.status, error: `External check: HTTP ${response.status}` };
  } catch (e: unknown) {
    return { status: "offline", error: ensureError(e).message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkWorkerHealth(
  worker: WorkerDefinition,
): Promise<WorkerAuditResult> {
  const customDomain = worker.customDomain;
  if (customDomain) {
    const extHealth = await checkExternalWorkerHealth(customDomain);
    return {
      ...worker,
      status: extHealth.status,
      latencyMs: extHealth.latencyMs,
      statusCode: extHealth.statusCode,
      error: extHealth.error,
    };
  }

  const baseUrl = normalizeBaseUrl(worker.url || "");
  const endpoints = ["/ping", "/health", "/api/ping", "/api/v1/ping", "/"];
  const authHeaders = getCloudflareAuthHeaders();

  let lastError = "Worker unreachable";

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: authHeaders,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;

      if (response.ok || response.status === 401 || response.status === 403) {
        return {
          ...worker,
          status: "online",
          latencyMs,
          statusCode: response.status,
          error: response.ok
            ? undefined
            : "Auth required (worker reachable, but protected)",
        };
      }

      lastError = `HTTP ${response.status}`;
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug(
        "CloudflareRoutes",
        `Worker status probe failed: ${normalized.message}`,
      );
      lastError = normalized.message;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ...worker,
    status: "offline",
    error: lastError,
  };
}

function extractMessageFromPayload(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const candidateKeys = [
    "message",
    "response",
    "reply",
    "text",
    "content",
    "output",
  ];

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  const nested = record.result;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    for (const key of candidateKeys) {
      const value = nestedRecord[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

async function postCloudflareChat(
  instruction: string,
  history: ChatHistoryItem[],
): Promise<CloudflareChatProxyResponse> {
  const baseUrl = normalizeBaseUrl(getCloudflareChatBaseUrl());
  const chatPayload = {
    message: instruction,
    prompt: instruction,
    input: instruction,
    history,
    messages: history
      .map((h) => ({ role: h.role, content: h.content }))
      .concat([{ role: "user", content: instruction }]),
  };

  const requestCandidates: Array<{ endpoint: string; body: Record<string, unknown> }> = [
    {
      endpoint: "/ai/generate",
      body: {
        prompt: instruction,
        messages: chatPayload.messages,
        model: process.env.CF_AI_SMART_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      },
    },
    { endpoint: "/api/chat", body: chatPayload },
    { endpoint: "/chat", body: chatPayload },
    { endpoint: "/api/v1/chat", body: chatPayload },
    { endpoint: "/", body: chatPayload },
  ];
  const headers = getCloudflareAuthHeaders();

  let lastError = "Cloudflare chat request failed";
  for (const candidate of requestCandidates) {
    const { endpoint, body } = candidate;
    const url = `${baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const body = await response.text().catch((error: unknown) => {
          logDebug("CloudflareRoutes", `Response body read skipped: ${ensureError(error).message}`);
          return "";
        });
        lastError = `HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 160)}` : ""}`;
        continue;
      }

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : "";
      } catch (error: unknown) {
        logDebug("CloudflareRoutes", `Worker response JSON parse skipped: ${ensureError(error).message}`);
      }

      const extracted = extractMessageFromPayload(parsed);
      const message =
        extracted ||
        (typeof parsed === "string" ? parsed : JSON.stringify(parsed));

      if (!message || !message.trim()) {
        lastError = `Empty response at ${endpoint}`;
        continue;
      }

      return {
        success: true,
        message,
        raw: parsed,
        endpoint,
      };
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Cloudflare chat request failed at ${endpoint}: ${normalized.message}`);
      lastError = normalized.message;
    }
  }

  throw new Error(lastError);
}

export function createCloudflareRoutes(): Router {
  const router = Router();

  router.get("/config", (_req, res) => {
    const tunnelEnabled = process.env.CLOUDFLARE_TUNNEL_ENABLED === "true";
    const browserEndpoint = resolveBrowserCopilotEndpoint();
    const config = {
      edge: {
        enabled: process.env.EDGE_ENABLED === "true",
        workerUrl: cloudflareClient.getResolvedBaseUrl(),
      },
      chat: {
        url: normalizeBaseUrl(getCloudflareChatBaseUrl()),
      },
      tunnel: {
        enabled: tunnelEnabled,
        apiUrl: process.env.CLOUDFLARE_TUNNEL_URL || null,
        n8nUrl: process.env.CLOUDFLARE_TUNNEL_N8N_URL || null,
        browserUrl: process.env.CLOUDFLARE_TUNNEL_BROWSER_URL || null,
        browserEndpoint,
        dashboardUrl: process.env.CLOUDFLARE_TUNNEL_DASHBOARD_URL || null,
      },
      auth: {
        hasCloudflareApiToken: Boolean(process.env.CF_BAS_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN),
        hasCeanApiKey: Boolean(process.env.CEAN_API_KEY),
      },
    };

    res.json(config);
  });

  /**
   * GET /api/cloudflare/agents
   * Audit configured Cloudflare workers (inventory + live health + external DNS)
   */
  router.get("/agents", async (_req, res) => {
    try {
      const workers = getCloudflareWorkersInventory();

      const audited = await Promise.all(
        workers.map(async (worker): Promise<WorkerAuditResult> => {
          if (!worker.url) {
            return {
              ...worker,
              status: "unknown",
              error: "URL not configured",
            };
          }

          return await checkWorkerHealth(worker);
        }),
      );

      const onlineCount = audited.filter((w) => w.status === "online").length;
      const unknownCount = audited.filter((w) => w.status === "unknown").length;

      const overallStatus: "connected" | "degraded" | "error" =
        onlineCount === audited.length
          ? "connected"
          : onlineCount > 0 || unknownCount > 0
            ? "degraded"
            : "error";

      res.json({
        status: overallStatus,
        summary: {
          total: audited.length,
          online: onlineCount,
          offline: audited.filter((w) => w.status === "offline").length,
          unknown: unknownCount,
        },
        workers: audited,
      });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Worker audit failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  /**
   * POST /api/cloudflare/agents/:workerId/task
   * Dispatch a task directly to a selected Cloudflare worker.
   */
  router.post("/agents/:workerId/task", async (req, res) => {
    try {
      const workerId = String(req.params.workerId || "").trim();
      const instruction =
        typeof req.body?.instruction === "string"
          ? req.body.instruction.trim()
          : "";
      const context = (req.body?.context ?? {}) as Record<string, unknown>;

      if (!workerId) {
        res.status(400).json({ error: "workerId is required" });
        return;
      }

      if (!instruction) {
        res.status(400).json({ error: "instruction is required" });
        return;
      }

      const worker = getCloudflareWorkersInventory().find((w) => w.id === workerId);
      if (!worker) {
        res.status(404).json({ error: `Worker not found: ${workerId}` });
        return;
      }

      const result = await postTaskToWorker(worker, instruction, context);
      if (!result.success) {
        res.status(502).json(result);
        return;
      }

      res.json(result);
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Worker task dispatch failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  router.get("/status", (_req, res) => {
    try {
      const status = agentManager.getEdgeStatus();
      res.json({ status });
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Worker status lookup failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  router.post("/task", async (req, res) => {
    try {
      const edgeStatus = agentManager.getEdgeStatus();
      if (!edgeStatus.enabled) {
        res
          .status(503)
          .json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const instruction =
        typeof req.body?.instruction === "string"
          ? req.body.instruction.trim()
          : "";
      const context = (req.body?.context ?? {}) as Record<string, unknown>;

      if (!instruction) {
        res.status(400).json({ error: "instruction is required" });
        return;
      }

      const result = await cloudflareClient.submitTask(instruction, context);
      res.json(result);
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Worker task submit failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  router.get("/status/:taskId", async (req, res) => {
    try {
      const edgeStatus = agentManager.getEdgeStatus();
      if (!edgeStatus.enabled) {
        res
          .status(503)
          .json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const taskId = String(req.params.taskId || "").trim();
      if (!taskId) {
        res.status(400).json({ error: "taskId is required" });
        return;
      }

      const data = await cloudflareClient.checkStatus(taskId);
      res.json(data);
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Worker status history failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  router.get("/history", async (req, res) => {
    try {
      const edgeStatus = agentManager.getEdgeStatus();
      if (!edgeStatus.enabled) {
        /* If edge disabled, return empty or cached? 
           For now we assume if they ask for history, they want remote history. 
           But if disabled, we can't fetch it. */
        res
          .status(503)
          .json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const limit = parseInt(String(req.query.limit || "20"), 10);
      const data = await cloudflareClient.fetchHistory(limit);
      res.json(data);
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Cloudflare chat failed: ${normalized.message}`);
      res.status(500).json({ error: normalized.message });
    }
  });

  /**
   * POST /api/cloudflare/chat
   * Proxy chat request to Cloudflare chat worker/template.
   */
  router.post("/chat", async (req, res) => {
    try {
      const instruction =
        typeof req.body?.instruction === "string"
          ? req.body.instruction.trim()
          : "";

      const history = Array.isArray(req.body?.history)
        ? (req.body.history as unknown[])
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const r = item as Record<string, unknown>;
              const role =
                r.role === "user" || r.role === "assistant" ? r.role : null;
              const content =
                typeof r.content === "string" ? r.content.trim() : "";
              if (!role || !content) return null;
              return { role, content } as ChatHistoryItem;
            })
            .filter((v): v is ChatHistoryItem => v !== null)
        : [];

      if (!instruction) {
        res.status(400).json({ error: "instruction is required" });
        return;
      }

      const result = await postCloudflareChat(instruction, history);
      res.json(result);
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logDebug("CloudflareRoutes", `Cloudflare chat proxy failed: ${normalized.message}`);
      res.status(502).json({ success: false, error: normalized.message });
    }
  });

  return router;
}
