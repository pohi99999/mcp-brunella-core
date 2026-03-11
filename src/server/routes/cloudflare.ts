import { Router } from "express";
import { agentManager } from "../../agents/AgentManager.js";
import { cloudflareClient } from "../../utils/cloudflareClient.js";

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

type WorkerDefinition = {
  id: string;
  name: string;
  url?: string;
  kind: "public" | "internal";
};

type WorkerAuditResult = {
  id: string;
  name: string;
  url?: string;
  kind: "public" | "internal";
  status: "online" | "offline" | "unknown";
  latencyMs?: number;
  statusCode?: number;
  error?: string;
};

type WorkerTaskProxyResponse = {
  success: boolean;
  workerId: string;
  workerName: string;
  endpoint?: string;
  result?: unknown;
  error?: string;
};

function getCloudflareChatBaseUrl(): string {
  return (
    process.env.CLOUDFLARE_CHAT_URL ||
    process.env.CLOUDFLARE_WORKER_URL ||
    "https://llm-chat-app-template.iam-dd1.workers.dev"
  );
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getCloudflareWorkersInventory(): WorkerDefinition[] {
  const orchestratorUrl = process.env.CLOUDFLARE_D1_WORKER_URL || process.env.CLOUDFLARE_WORKER_URL;
  const chatUrl = process.env.CLOUDFLARE_CHAT_URL;
  const chatSyncUrl = process.env.CLOUDFLARE_CHAT_SYNC_URL;

  return [
    {
      id: "cean-orchestrator",
      name: "cean-orchestrator",
      url: orchestratorUrl || "https://cean-orchestrator.iam-dd1.workers.dev",
      kind: "public",
    },
    {
      id: "chat-sync",
      name: "chat-sync",
      url: chatSyncUrl || "https://bas-orchestrator.peterpohankapersonal.workers.dev",
      kind: "public",
    },
    {
      id: "brunella-cf",
      name: "brunella-cf",
      url: process.env.CF_WORKER_BRUNELLA_CF_URL || "https://brunella-cf.iam-dd1.workers.dev",
      kind: "public",
    },
    {
      id: "agents-api",
      name: "agents-api",
      url: process.env.CF_WORKER_AGENTS_API_URL,
      kind: "internal",
    },
    {
      id: "saas-admin",
      name: "saas-admin",
      url: process.env.CF_WORKER_SAAS_ADMIN_URL,
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
      url: process.env.CF_WORKER_THROBBING_FIRE_URL,
      kind: "internal",
    },
  ];
}

async function checkWorkerHealth(url: string): Promise<{
  status: "online" | "offline";
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}> {
  const base = normalizeBaseUrl(url);
  const candidates = [`${base}/health`, base];

  let lastError = "Unknown error";

  for (const candidate of candidates) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(candidate, {
        method: "GET",
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;
      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          status: "online",
          latencyMs,
          statusCode: response.status,
        };
      }

      lastError = `HTTP ${response.status}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    status: "offline",
    error: lastError,
  };
}

async function postTaskToWorker(
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
  const payload = {
    instruction,
    task: instruction,
    context,
  };

  let lastError = "Worker task proxy failed";

  for (const endpoint of endpoints) {
    const url = `${base}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : "";
      } catch {
        // Keep text response fallback
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
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
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
  const endpoints = ["/api/chat", "/chat", "/api/v1/chat", "/"];

  const payload = {
    message: instruction,
    prompt: instruction,
    input: instruction,
    history,
    messages: history
      .map((h) => ({ role: h.role, content: h.content }))
      .concat([{ role: "user", content: instruction }]),
  };

  let lastError = "Cloudflare chat request failed";
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        lastError = `HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 160)}` : ""}`;
        continue;
      }

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : "";
      } catch {
        // Keep plain text fallback
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
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastError);
}

export function createCloudflareRoutes(): Router {
  const router = Router();

  /**
   * GET /api/cloudflare/agents
   * Audit configured Cloudflare workers (inventory + live health)
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

          const health = await checkWorkerHealth(worker.url);
          return {
            ...worker,
            ...health,
          };
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/status", (_req, res) => {
    try {
      const status = agentManager.getEdgeStatus();
      res.json({ status });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
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
      const msg = e instanceof Error ? e.message : String(e);
      res.status(502).json({ success: false, error: msg });
    }
  });

  return router;
}
