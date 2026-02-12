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
      const message = extracted || (typeof parsed === "string" ? parsed : JSON.stringify(parsed));

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
        res.status(503).json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
        return;
      }

      const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim() : "";
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
        res.status(503).json({ error: "Edge disabled (set EDGE_ENABLED=true)" });
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
                r.role === "user" || r.role === "assistant"
                  ? r.role
                  : null;
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
