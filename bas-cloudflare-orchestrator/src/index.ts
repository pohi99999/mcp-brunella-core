/**
 * BAS Cloudflare Orchestrator - Brunella Agent System
 * Hybrid Architecture: Edge orchestration + Local Browser-Use execution
 *
 * Endpoints:
 * - POST /task - Submit new automation task
 * - GET /status/:taskId - Check task status
 * - POST /webhook/n8n - Receive n8n callbacks
 * - POST /webhook/browser-use - Receive Browser-Use results
 */

import { Ai } from "@cloudflare/ai";

interface Env {
  AI: Ai;
  BAS_TASKS: KVNamespace;
  D1_METADATA: D1Database;
  R2_KNOWLEDGE: R2Bucket;
  TASK_QUEUE: Queue;
  N8N_WEBHOOK_URL: string;
  BROWSER_USE_ENDPOINT: string;
  DEFAULT_CODE_MODEL: string;
  R2_PREFIX: string;
  VECTORIZE?: VectorizeIndex;
}

interface BASTask {
  id: string;
  type: "browser" | "research" | "code" | "orchestrate";
  status: "pending" | "dispatched" | "running" | "completed" | "failed";
  payload: Record<string, unknown>;
  result?: unknown;
  createdAt: string;
  updatedAt: string;
  callbackUrls?: {
    api?: string;
    n8n?: string;
    browser?: string;
    dashboard?: string;
  };
}

// Task ID generator
function generateTaskId(): string {
  return `bas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Log routing decision to D1
async function logRoutingDecision(
  db: D1Database,
  taskId: string,
  method: "keyword" | "llm" | "explicit" | "trigger" | "fallback",
  matchedAgent: string,
  extras: {
    confidence?: number;
    keywordHits?: number;
    llmModel?: string;
    llmLatencyMs?: number;
  } = {},
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO routing_decisions (task_id, method, matched_agent, confidence, keyword_hits, llm_model, llm_latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        taskId,
        method,
        matchedAgent,
        extras.confidence ?? null,
        extras.keywordHits ?? null,
        extras.llmModel ?? null,
        extras.llmLatencyMs ?? null,
      )
      .run();
  } catch {
    // Non-critical — don't fail the task if logging fails
    console.error(`Failed to log routing decision for ${taskId}`);
  }
}

// Save task to D1 history
async function saveTaskHistory(
  db: D1Database,
  task: BASTask,
  routingMethod: string,
  durationMs?: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT OR REPLACE INTO task_history (id, type, agent_name, instruction, status, routing_method, result_summary, duration_ms, completed_at, context)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        task.id,
        task.type,
        null,
        (task.payload as Record<string, unknown>).instruction as string,
        task.status,
        routingMethod,
        task.result ? JSON.stringify(task.result).slice(0, 500) : null,
        durationMs ?? null,
        task.status === "completed" || task.status === "failed"
          ? new Date().toISOString()
          : null,
        task.payload.context ? JSON.stringify(task.payload.context) : null,
      )
      .run();
  } catch {
    console.error(`Failed to save task history for ${task.id}`);
  }
}

// AI-powered task classifier
async function classifyTask(
  ai: Ai,
  instruction: string,
): Promise<BASTask["type"]> {
  const normalized = instruction.toLowerCase();

  // Keyword-based heuristics (Fast track)
  const codeKeywords = [
    "script",
    "kód",
    "code",
    "python",
    "js",
    "javascript",
    "függvény",
    "function",
    "írj",
    "write",
    "program",
  ];
  if (
    codeKeywords.some((kw) => normalized.includes(kw)) &&
    (normalized.includes("írj") ||
      normalized.includes("write") ||
      normalized.includes("generál") ||
      normalized.includes("generate"))
  ) {
    return "code";
  }

  const browserKeywords = [
    "nyisd meg",
    "open",
    "kattints",
    "click",
    "keress a neten",
    "search web",
    "böngésző",
    "browser",
  ];
  if (browserKeywords.some((kw) => normalized.includes(kw))) {
    return "browser";
  }

  const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      {
        role: "system",
        content: `Te a BAS (Brunella Agent System) task router vagy. 
Osztályozd a feladatot EGY kategóriába:
- "browser": Weboldalon kell műveletet végezni (kattintás, kitöltés, scraping, webes keresés)
- "research": Adatgyűjtés, elemzés meglévő adatokból
- "code": Kód írása, generálás, javítás, programozási kérdések (Példa: "Írj egy scriptet", "Hogyan működik ez a függvény?")
- "orchestrate": Minden más, összetett vagy általános feladat

Válaszolj CSAK a kategória nevével, semmi mással.`,
      },
      { role: "user", content: instruction },
    ],
    max_tokens: 10,
  });

  const result =
    (response as { response?: string }).response?.toLowerCase().trim() ||
    "orchestrate";

  if (["browser", "research", "code", "orchestrate"].includes(result)) {
    return result as BASTask["type"];
  }
  return "orchestrate";
}

// Coding Agent - Direct code generation using Workers AI
async function handleCodingTask(
  ai: Ai,
  instruction: string,
  model: string = "@cf/meta/llama-3.1-8b-instruct",
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
) {
  const messages = [
    {
      role: "system",
      content:
        "Te egy profi kódoló ügynök vagy a BAS (Brunella Agent System) keretében. Feladatod kiváló minőségű, tiszta és dokumentált kód generálása a felhasználó kérése alapján. Válaszolj magyarul a magyarázatokban, de a kód legyen angol nyelvű standardok szerinti.",
    },
  ];

  // Append history if valid
  if (Array.isArray(history) && history.length > 0) {
    messages.push(
      ...history.map((h) => ({
        role: h.role as "user" | "assistant" | "system",
        content: h.content,
      })),
    );
  }

  // Append current instruction
  messages.push({ role: "user", content: instruction });

  const response = await ai.run(model as any, {
    messages,
  });
  return response;
}

// Dispatch task to appropriate handler
async function dispatchTask(
  task: BASTask,
  env: Env,
  defaultWorkerOrigin: string,
): Promise<void> {
  // Use tunnel URLs if provided, otherwise fall back to env or worker origin
  const workerOrigin = task.callbackUrls?.api || defaultWorkerOrigin;
  const target =
    task.type === "browser"
      ? task.callbackUrls?.browser || env.BROWSER_USE_ENDPOINT
      : task.callbackUrls?.n8n || env.N8N_WEBHOOK_URL;

  const callbackPath = task.type === "browser" ? "browser-use" : "n8n";

  try {
    await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        type: task.type,
        payload: task.payload,
        callbackUrl: `${workerOrigin}/webhook/${callbackPath}`,
      }),
    });
  } catch (error) {
    console.error(`Dispatch failed for task ${task.id}:`, error);
  }
}

export default {
  // Queue consumer: process tasks asynchronously
  async queue(
    batch: MessageBatch<{
      taskId: string;
      instruction: string;
      type: BASTask["type"];
    }>,
    env: Env,
  ): Promise<void> {
    for (const message of batch.messages) {
      const { taskId, instruction, type } = message.body;
      const startMs = Date.now();

      try {
        const taskData = await env.BAS_TASKS.get(taskId);
        if (!taskData) {
          message.ack();
          continue;
        }

        const task: BASTask = JSON.parse(taskData);
        task.status = "running";
        task.updatedAt = new Date().toISOString();
        await env.BAS_TASKS.put(taskId, JSON.stringify(task));

        // Route based on type
        if (type === "code") {
          const ai = new Ai(env.AI);
          const result = await handleCodingTask(
            ai,
            instruction,
            env.DEFAULT_CODE_MODEL,
          );
          task.status = "completed";
          task.result = result;
        } else {
          // Non-code tasks: dispatch to external services
          const workerOrigin = "https://bas-orchestrator.pohi99999.workers.dev";
          await dispatchTask(task, env, workerOrigin);
          task.status = "dispatched";
        }

        task.updatedAt = new Date().toISOString();
        await env.BAS_TASKS.put(taskId, JSON.stringify(task));

        const durationMs = Date.now() - startMs;
        await saveTaskHistory(env.D1_METADATA, task, "keyword", durationMs);

        message.ack();
      } catch (e) {
        console.error(`Queue processing failed for task ${taskId}:`, e);
        message.retry();
      }
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /task - Submit new task
    if (path === "/task" && request.method === "POST") {
      const body = (await request.json()) as {
        instruction: string;
        context?: Record<string, unknown>;
        callbackUrls?: {
          api?: string;
          n8n?: string;
          browser?: string;
          dashboard?: string;
        };
      };
      const { instruction, context, callbackUrls } = body;

      if (!instruction) {
        return Response.json(
          { error: "instruction required" },
          { status: 400, headers: corsHeaders },
        );
      }

      const ai = new Ai(env.AI);
      const startMs = Date.now();
      const taskType = await classifyTask(ai, instruction);
      const classifyMs = Date.now() - startMs;

      const task: BASTask = {
        id: generateTaskId(),
        type: taskType,
        status: "pending",
        payload: { instruction, context },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        callbackUrls,
      };

      // Store task
      await env.BAS_TASKS.put(task.id, JSON.stringify(task), {
        expirationTtl: 86400,
      });

      // Log routing decision + task history to D1
      const routingMethod = classifyMs < 50 ? "keyword" : "llm";
      await logRoutingDecision(
        env.D1_METADATA,
        task.id,
        routingMethod,
        taskType,
        {
          llmLatencyMs: classifyMs,
          llmModel: classifyMs >= 50 ? env.DEFAULT_CODE_MODEL : undefined,
        },
      );
      await saveTaskHistory(env.D1_METADATA, task, routingMethod);

      // Dispatch to handler
      task.status = "dispatched";
      await env.BAS_TASKS.put(task.id, JSON.stringify(task));
      const workerOrigin = new URL(request.url).origin;

      if (taskType === "code") {
        // Direct execution for code tasks if preferred, or still send to n8n as fallback
        task.status = "running";
        await env.BAS_TASKS.put(task.id, JSON.stringify(task));

        try {
          const history = Array.isArray(context?.history)
            ? context.history
            : [];
          const codeResult = await handleCodingTask(
            ai,
            instruction,
            env.DEFAULT_CODE_MODEL,
            history,
          );
          task.status = "completed";
          task.result = codeResult;
          task.updatedAt = new Date().toISOString();
          await env.BAS_TASKS.put(task.id, JSON.stringify(task));

          return Response.json(
            {
              success: true,
              taskId: task.id,
              type: taskType,
              result: codeResult,
              message:
                "Code generated successfully via Workers AI Coding Agent",
            },
            { headers: corsHeaders },
          );
        } catch (e: any) {
          task.status = "failed";
          task.result = { error: e.message };
          await env.BAS_TASKS.put(task.id, JSON.stringify(task));
          return Response.json(
            { error: "Coding agent failed", details: e.message },
            { status: 500, headers: corsHeaders },
          );
        }
      }

      await dispatchTask(task, env, workerOrigin);

      return Response.json(
        {
          success: true,
          taskId: task.id,
          type: taskType,
          message: `Task dispatched to ${taskType === "browser" ? "Browser-Use (robotkéz)" : "n8n"}`,
        },
        { headers: corsHeaders },
      );
    }

    // GET /status/:taskId - Check status
    if (path.startsWith("/status/") && request.method === "GET") {
      const taskId = path.replace("/status/", "");
      const taskData = await env.BAS_TASKS.get(taskId);

      if (!taskData) {
        return Response.json(
          { error: "Task not found" },
          { status: 404, headers: corsHeaders },
        );
      }

      return Response.json(JSON.parse(taskData), { headers: corsHeaders });
    }

    // POST /webhook/browser-use - Browser-Use callback
    if (path === "/webhook/browser-use" && request.method === "POST") {
      const body = (await request.json()) as {
        taskId: string;
        status: string;
        result?: unknown;
      };
      const { taskId, status, result } = body;

      const taskData = await env.BAS_TASKS.get(taskId);
      if (taskData) {
        const task: BASTask = JSON.parse(taskData);
        task.status = status === "success" ? "completed" : "failed";
        task.result = result;
        task.updatedAt = new Date().toISOString();
        await env.BAS_TASKS.put(taskId, JSON.stringify(task));
      }

      return Response.json({ received: true }, { headers: corsHeaders });
    }

    // POST /webhook/n8n - n8n callback
    if (path === "/webhook/n8n" && request.method === "POST") {
      const body = (await request.json()) as {
        taskId: string;
        status: string;
        result?: unknown;
      };
      const { taskId, status, result } = body;

      const taskData = await env.BAS_TASKS.get(taskId);
      if (taskData) {
        const task: BASTask = JSON.parse(taskData);
        task.status = status === "success" ? "completed" : "failed";
        task.result = result;
        task.updatedAt = new Date().toISOString();
        await env.BAS_TASKS.put(taskId, JSON.stringify(task));
      }

      return Response.json({ received: true }, { headers: corsHeaders });
    }

    // POST /vectorize/search - Vector similarity search (POC)
    if (path === "/vectorize/search" && request.method === "POST") {
      if (!env.VECTORIZE) {
        return Response.json(
          { error: "Vectorize not configured" },
          { status: 501, headers: corsHeaders },
        );
      }

      const body = (await request.json()) as { query: string; topK?: number };
      const { query, topK = 5 } = body;

      if (!query) {
        return Response.json(
          { error: "query required" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        // Generate embedding for query using Workers AI
        const ai = new Ai(env.AI);
        const embedResponse = (await ai.run("@cf/baai/bge-base-en-v1.5", {
          text: query,
        })) as { data: number[][] };

        const embedding = embedResponse.data[0];

        // Query Vectorize index
        const results = await env.VECTORIZE.query(embedding, { topK });

        return Response.json(
          {
            success: true,
            query,
            results: results.matches.map((m) => ({
              id: m.id,
              score: m.score,
              metadata: m.metadata,
            })),
          },
          { headers: corsHeaders },
        );
      } catch (error: any) {
        return Response.json(
          { error: error.message },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // GET / - Health check & info
    if (path === "/" || path === "") {
      return Response.json(
        {
          service: "BAS Cloudflare Orchestrator",
          version: "1.1.0",
          architecture: "hybrid",
          endpoints: {
            submitTask: "POST /task",
            checkStatus: "GET /status/:taskId",
            analytics: "GET /analytics",
            browserUseWebhook: "POST /webhook/browser-use",
            n8nWebhook: "POST /webhook/n8n",
            vectorizeSearch: "POST /vectorize/search (POC)",
          },
          status: "operational",
        },
        { headers: corsHeaders },
      );
    }

    // GET /analytics - Routing decision stats from D1
    if (path === "/analytics" && request.method === "GET") {
      try {
        const [routingStats, recentTasks] = await Promise.all([
          env.D1_METADATA.prepare(
            `SELECT method, COUNT(*) as count, AVG(llm_latency_ms) as avg_latency
             FROM routing_decisions GROUP BY method ORDER BY count DESC`,
          ).all(),
          env.D1_METADATA.prepare(
            `SELECT id, type, status, routing_method, duration_ms, created_at
             FROM task_history ORDER BY created_at DESC LIMIT 20`,
          ).all(),
        ]);
        return Response.json(
          {
            routing: routingStats.results,
            recentTasks: recentTasks.results,
          },
          { headers: corsHeaders },
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return Response.json(
          { error: msg },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    return Response.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders },
    );
  },
};
