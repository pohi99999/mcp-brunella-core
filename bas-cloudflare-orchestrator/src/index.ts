/**
 * BAS Cloudflare Orchestrator - Core Entry Point
 * Swarm: swarmCreate, swarmHandoff, swarmArtifact, swarmStatus
 * Queues: Async task distribution via bas-task-queue
 * R2: Artifact storage via vodor1
 * Analytics: Agent telemetry via BAS_ANALYTICS
 */

import { safeJsonParse, applyPromptArmor } from './utils/aiHelpers.js';
export { SwarmCoordinator } from "./swarmCoordinator.js";
import { handleQueueBatch, enqueueTask, type TaskMessage } from "./queueHandler.js";
import { R2ArtifactManager } from "./r2Artifacts.js";
import { BASAnalytics } from "./analyticsEngine.js";
import {
  authenticateWorkerRequest,
  buildCorsHeaders,
  type WorkerSecurityEnv,
} from "./security.js";

interface Env extends WorkerSecurityEnv {
  AI: any;
  D1_METADATA: D1Database;
  BAS_TASKS: KVNamespace;
  R2_KNOWLEDGE: R2Bucket;
  SWARM_COORDINATOR: DurableObjectNamespace;
  ASSETS: any;

  // Queues
  TASK_QUEUE: Queue<TaskMessage>;
  RESULT_QUEUE: Queue<TaskMessage>;
  DLQ: Queue<TaskMessage>;

  // Vectorize
  VECTORIZE_MEMORY: VectorizeIndex;
  VECTORIZE_CEAN: VectorizeIndex;

  // Analytics Engine
  BAS_ANALYTICS: AnalyticsEngineDataset;

  // Rate Limiting
  AI_RATE_LIMITER: any;

  // Workers AI model config
  DEFAULT_CODE_MODEL: string;
  FALLBACK_CODE_MODEL: string;
  REASONING_MODEL: string;
  FAST_MODEL: string;
  R2_PREFIX: string;
}

type CFDispatchTarget =
  | "cf_worker"
  | "cf_queue"
  | "cf_kv"
  | "cf_d1"
  | "cf_ai_gateway"
  | "cf_vectorize"
  | "local";

interface CFDispatchDecision {
  delegate: boolean;
  target: CFDispatchTarget;
  workerId?: string;
  reason: string;
  estimatedLatencyMs?: number;
}

interface BrunellaTaskMeta {
  type: string;
  requiresLocalModel?: boolean;
  isAsync?: boolean;
  requiresExternalAPI?: boolean;
  involvesLLM?: boolean;
  isDataLookup?: boolean;
  isVectorSearch?: boolean;
  estimatedDurationMs?: number;
  agentName?: string;
  payload?: Record<string, unknown>;
}

interface DispatchLogEntry {
  agentName: string;
  taskType: string;
  target: string;
  reason: string;
  success: number;
  latencyMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function lower(value: string | undefined): string {
  return (value || "").toLowerCase();
}

function getPayloadText(task: BrunellaTaskMeta): string {
  const payload = task.payload ? JSON.stringify(task.payload) : "";
  return [task.agentName, task.type, payload].filter(Boolean).join(" ").toLowerCase();
}

function inferEstimatedDurationMs(task: BrunellaTaskMeta, payloadText: string): number {
  const explicit = pickNumber(task.estimatedDurationMs);
  if (explicit !== undefined) return explicit;
  if (pickBoolean(task.isAsync) === true) return 6000;
  if (pickBoolean(task.isVectorSearch) === true) return 120;
  if (pickBoolean(task.isDataLookup) === true) {
    return /complex|join|report|aggregate|history|range|timeline/.test(payloadText) ? 250 : 75;
  }
  if (pickBoolean(task.involvesLLM) === true) return 1200;
  if (pickBoolean(task.requiresExternalAPI) === true) return 500;
  if (/research|harvest|extract|api|fetch|lookup|search|vector|embedding|queue|batch/.test(payloadText)) {
    return 500;
  }
  return 250;
}

function parseTaskMeta(value: unknown): BrunellaTaskMeta {
  const record = isRecord(value) ? value : {};
  const payload = isRecord(record.payload) ? (record.payload as Record<string, unknown>) : record;
  return {
    type: pickString(record.type) || "general",
    requiresLocalModel: pickBoolean(record.requiresLocalModel),
    isAsync: pickBoolean(record.isAsync),
    requiresExternalAPI: pickBoolean(record.requiresExternalAPI),
    involvesLLM: pickBoolean(record.involvesLLM),
    isDataLookup: pickBoolean(record.isDataLookup),
    isVectorSearch: pickBoolean(record.isVectorSearch),
    estimatedDurationMs: pickNumber(record.estimatedDurationMs),
    agentName: pickString(record.agentName),
    payload,
  };
}

function selectRoutingWorker(target: CFDispatchTarget, task: BrunellaTaskMeta): string | undefined {
  const agent = lower(task.agentName);
  const text = `${agent} ${lower(task.type)} ${getPayloadText(task)}`;

  if (target === "cf_worker") {
    if (/research|harvest|extract|browser|api/.test(text)) return "ResearcherAgent";
    if (/orchestrate|dispatch|swarm|conductor|workflow/.test(text)) return "ProjectConductorAgent";
    if (/build|builder|code|implement|developer/.test(text)) return "DeveloperAgent";
    return "ResearcherAgent";
  }

  if (target === "cf_queue") return "ProjectConductorAgent";
  if (target === "cf_kv") return "KnowledgeBaseBuilderAgent";
  if (target === "cf_d1") return "DataScientistAgent";
  if (target === "cf_ai_gateway") return "ResearcherAgent";
  if (target === "cf_vectorize") return "KnowledgeBaseBuilderAgent";

  return undefined;
}

async function runWorkersAi(
  env: Env,
  model: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const binding = env.AI as { run?: (model: string, input: Record<string, unknown>) => Promise<unknown> };
  if (typeof binding.run !== "function") {
    throw new Error("Cloudflare AI binding does not expose run()");
  }

  return binding.run(model, input);
}

function shouldDelegate(task: BrunellaTaskMeta): CFDispatchDecision {
  const text = `${lower(task.agentName)} ${lower(task.type)} ${getPayloadText(task)}`;
  const estimatedDurationMs = inferEstimatedDurationMs(task, text);

  if (task.requiresLocalModel === true) {
    return { delegate: false, target: "local", reason: "requiresLocalModel=true", estimatedLatencyMs: estimatedDurationMs };
  }

  if (task.isVectorSearch === true || /vector|embedding|semantic|rag|similarity|nearest/.test(text)) {
    return {
      delegate: true,
      target: "cf_vectorize",
      workerId: selectRoutingWorker("cf_vectorize", task),
      reason: "vector search delegated to Cloudflare Vectorize",
      estimatedLatencyMs: 120,
    };
  }

  if (task.involvesLLM === true || /llm|prompt|chat|reason|summar|generate|model|embedding/.test(text)) {
    return {
      delegate: true,
      target: "cf_ai_gateway",
      workerId: selectRoutingWorker("cf_ai_gateway", task),
      reason: "LLM request proxied through Cloudflare AI",
      estimatedLatencyMs: 900,
    };
  }

  if (task.isDataLookup === true) {
    if (estimatedDurationMs < 100) {
      return {
        delegate: true,
        target: "cf_kv",
        workerId: selectRoutingWorker("cf_kv", task),
        reason: "fast data lookup routed to Cloudflare KV",
        estimatedLatencyMs: 40,
      };
    }

    return {
      delegate: true,
      target: "cf_d1",
      workerId: selectRoutingWorker("cf_d1", task),
      reason: "structured lookup routed to Cloudflare D1",
      estimatedLatencyMs: 120,
    };
  }

  if (task.isAsync === true || estimatedDurationMs > 5000) {
    return {
      delegate: true,
      target: "cf_queue",
      workerId: selectRoutingWorker("cf_queue", task),
      reason: "async or long-running task routed to Cloudflare Queues",
      estimatedLatencyMs: 300,
    };
  }

  if (task.requiresExternalAPI === true) {
    return {
      delegate: true,
      target: "cf_worker",
      workerId: selectRoutingWorker("cf_worker", task),
      reason: "external API work delegated to the best matching Cloudflare Worker",
      estimatedLatencyMs: 250,
    };
  }

  return { delegate: false, target: "local", reason: "no Cloudflare rule matched", estimatedLatencyMs: estimatedDurationMs };
}

async function ensureDispatchLogTable(env: Env): Promise<void> {
  await env.D1_METADATA.prepare(
    `CREATE TABLE IF NOT EXISTS dispatch_log (
      id TEXT PRIMARY KEY,
      agent_name TEXT,
      task_type TEXT,
      target TEXT,
      reason TEXT,
      success INTEGER,
      latency_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ).run();
}

async function logDispatchDecision(env: Env, entry: DispatchLogEntry): Promise<void> {
  await ensureDispatchLogTable(env);
  const id = crypto.randomUUID ? crypto.randomUUID() : `dispatch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await env.D1_METADATA.prepare(
    `INSERT INTO dispatch_log (id, agent_name, task_type, target, reason, success, latency_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(
    id,
    entry.agentName,
    entry.taskType,
    entry.target,
    entry.reason,
    entry.success,
    entry.latencyMs,
  ).run();
}

async function dispatchWorkerTask(
  env: Env,
  agent: string,
  task: string,
  context: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  const routing = await env.D1_METADATA.prepare(
    "SELECT worker_url FROM worker_routing WHERE agent_name = ? AND is_healthy = 1",
  ).bind(agent).first<{ worker_url: string }>();

  if (!routing) {
    return { requestId, status: "fallback", error: `No healthy worker found for agent: ${agent}` };
  }

  await env.D1_METADATA.prepare(
    "INSERT INTO worker_tasks (id, agent_name, worker_url, task, context, status) VALUES (?, ?, ?, ?, ?, 'running')",
  ).bind(requestId, agent, routing.worker_url, task, JSON.stringify(context || {})).run();

  try {
    const workerAuthToken = env.BAS_API_KEY || env.CEAN_API_KEY || env.CLOUDFLARE_API_TOKEN;
    const workerHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (workerAuthToken) {
      workerHeaders["X-BAS-API-Key"] = workerAuthToken;
    }

    const workerResponse = await fetch(`${routing.worker_url}/execute`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({ agent, task, context, requestId }),
    });

    const result = await workerResponse.json() as unknown;

    await env.D1_METADATA.prepare(
      "UPDATE worker_tasks SET status = 'completed', result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(JSON.stringify(result), requestId).run();

    return { requestId, status: "completed", workerUrl: routing.worker_url, result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await env.D1_METADATA.prepare(
      "UPDATE worker_tasks SET status = 'failed', error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(message, requestId).run();
    return { requestId, status: "failed", error: message };
  }
}

async function dispatchSmartDecision(
  env: Env,
  decision: CFDispatchDecision,
  taskMeta: BrunellaTaskMeta,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  if (decision.target === "local") {
    return { requestId, status: "local", result: { delegated: false, reason: decision.reason } };
  }

  if (decision.target === "cf_worker") {
    const agent = decision.workerId || taskMeta.agentName || taskMeta.type;
    const task = pickString(payload.instruction, payload.task, payload.message) || taskMeta.type;
    const context = isRecord(payload.context) ? payload.context : payload;
    return await dispatchWorkerTask(env, agent, task, context, requestId);
  }

  if (decision.target === "cf_queue") {
    const instruction = pickString(payload.instruction, payload.task, payload.message) || taskMeta.type;
    const queuedTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await enqueueTask(env.TASK_QUEUE, {
      taskId: queuedTaskId,
      instruction,
      type: taskMeta.type || "general",
      priority: "normal",
      metadata: { taskMeta, payload },
      createdAt: new Date().toISOString(),
    });
    return { requestId, queued: true, taskId: queuedTaskId, result: { taskId: queuedTaskId, status: "queued" } };
  }

  if (decision.target === "cf_kv") {
    const key = pickString(payload.key, payload.lookupKey, payload.id, taskMeta.agentName, taskMeta.type) || requestId;
    if (Object.prototype.hasOwnProperty.call(payload, "value")) {
      const value = payload.value;
      await env.BAS_TASKS.put(key, typeof value === "string" ? value : JSON.stringify(value));
      return { requestId, result: { key, stored: true } };
    }

    const value = await env.BAS_TASKS.get(key);
    return { requestId, result: { key, value } };
  }

  if (decision.target === "cf_d1") {
    const sql = pickString(payload.sql, payload.query, payload.statement);
    if (!sql) {
      return { requestId, error: "sql/query/statement required for cf_d1" };
    }

    const statement = env.D1_METADATA.prepare(sql);
    const params = Array.isArray(payload.params) ? payload.params : [];
    const lowerSql = sql.trim().toLowerCase();
    const result = lowerSql.startsWith("select") || lowerSql.startsWith("with") || lowerSql.startsWith("pragma")
      ? await statement.bind(...params).all()
      : await statement.bind(...params).run();
    return { requestId, result };
  }

  if (decision.target === "cf_ai_gateway") {
    const model = pickString(payload.model, env.FAST_MODEL, env.DEFAULT_CODE_MODEL) || env.FAST_MODEL;
    const prompt = pickString(payload.prompt, payload.instruction, payload.message, taskMeta.type) || taskMeta.type;
    const options = isRecord(payload.options) ? payload.options : {};
    const aiResult = await runWorkersAi(env, model, { prompt, ...options });
    return { requestId, result: aiResult };
  }

  if (decision.target === "cf_vectorize") {
    const vector = Array.isArray(payload.vector)
      ? payload.vector
      : Array.isArray(payload.embedding)
        ? payload.embedding
        : null;
    if (!vector) {
      return { requestId, error: "vector or embedding array required for cf_vectorize" };
    }

    const index = taskMeta.agentName && /cean|memory/i.test(taskMeta.agentName)
      ? env.VECTORIZE_CEAN
      : env.VECTORIZE_MEMORY;
    const result = await index.query(vector as number[], { topK: 5 });
    return { requestId, result };
  }

  return { requestId, error: `Unsupported dispatch target: ${decision.target}` };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const authResult = authenticateWorkerRequest(request, env);
    if (!authResult.ok) {
      return Response.json(
        { error: authResult.error },
        { status: authResult.status, headers: corsHeaders },
      );
    }

    // --- SMART DISPATCH: classify task, log decision, then execute ---
    if (path === "/dispatch-smart" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const taskMeta = parseTaskMeta(body.taskMeta);
      const payload = isRecord(body.payload) ? body.payload : {};
      const decision = shouldDelegate(taskMeta);
      const requestId = pickString(body.requestId) || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const startedAt = Date.now();

      try {
        const result = await dispatchSmartDecision(env, decision, taskMeta, payload, requestId);
        await logDispatchDecision(env, {
          agentName: taskMeta.agentName || "unknown",
          taskType: taskMeta.type,
          target: decision.target,
          reason: decision.reason,
          success: result.error ? 0 : 1,
          latencyMs: Date.now() - startedAt,
        });
        return Response.json({ decision, ...result }, { headers: corsHeaders });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await logDispatchDecision(env, {
          agentName: taskMeta.agentName || "unknown",
          taskType: taskMeta.type,
          target: decision.target,
          reason: `${decision.reason} | error: ${message}`,
          success: 0,
          latencyMs: Date.now() - startedAt,
        });
        return Response.json({ decision, error: message }, { status: 500, headers: corsHeaders });
      }
    }

    // --- DISPATCH: Route task to specific agent worker ---
    if (path === "/dispatch" && request.method === "POST") {
      const body = await request.json() as any;
      const agent = body.agent;
      let task = body.task;
      const context = body.context;
      const requestId = body.requestId;

      if (!agent || !task) {
        return Response.json({ error: "agent and task required" }, { status: 400, headers: corsHeaders });
      }

      // Apply Prompt Armor
      task = applyPromptArmor(task);

      const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 1. Lookup worker URL from D1
      const routing = await env.D1_METADATA.prepare(
        "SELECT worker_url FROM worker_routing WHERE agent_name = ? AND is_healthy = 1"
      ).bind(agent).first<{ worker_url: string }>();

      if (!routing) {
        return Response.json({ error: `No healthy worker found for agent: ${agent}`, status: "fallback" }, { status: 404, headers: corsHeaders });
      }

      // 2. Record task in D1
      await env.D1_METADATA.prepare(
        "INSERT INTO worker_tasks (id, agent_name, worker_url, task, context, status) VALUES (?, ?, ?, ?, ?, 'running')"
      ).bind(reqId, agent, routing.worker_url, task, JSON.stringify(context || {})).run();

      // 3. Proxy to Agent Worker (Async/Fire-and-forget or Sync depending on needs)
      // For now, we attempt a sync call to the worker
      try {
        const workerAuthToken = env.BAS_API_KEY || env.CEAN_API_KEY || env.CLOUDFLARE_API_TOKEN;
        const workerHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (workerAuthToken) {
          workerHeaders["X-BAS-API-Key"] = workerAuthToken;
        }

        const workerResponse = await fetch(`${routing.worker_url}/execute`, {
          method: "POST",
          headers: workerHeaders,
          body: JSON.stringify({ agent, task, context, requestId: reqId })
        });

        const result = await workerResponse.json() as any;

        // Update D1 with result
        await env.D1_METADATA.prepare(
          "UPDATE worker_tasks SET status = 'completed', result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(JSON.stringify(result), reqId).run();

        return Response.json({ requestId: reqId, status: "completed", workerUrl: routing.worker_url, result }, { headers: corsHeaders });
      } catch (err: any) {
        await env.D1_METADATA.prepare(
          "UPDATE worker_tasks SET status = 'failed', error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(err.message, reqId).run();

        return Response.json({ requestId: reqId, status: "failed", error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // --- WORKERS: List all managed workers ---
    if (path === "/workers" && request.method === "GET") {
      const workers = await env.D1_METADATA.prepare("SELECT * FROM worker_routing").all();
      return Response.json(workers.results, { headers: corsHeaders });
    }

    // --- ROUTING: Get current routing table ---
    if (path === "/routing" && request.method === "GET") {
      const routing = await env.D1_METADATA.prepare("SELECT agent_name, worker_url FROM worker_routing WHERE is_healthy = 1").all();
      return Response.json(routing.results, { headers: corsHeaders });
    }

    // --- TASK STATUS: Get or update task status ---
    if (path.startsWith("/task-status/") && (request.method === "GET" || request.method === "POST")) {
      const reqId = path.split("/")[2];
      if (request.method === "GET") {
        const task = await env.D1_METADATA.prepare("SELECT * FROM worker_tasks WHERE id = ?").bind(reqId).first();
        return task ? Response.json(task, { headers: corsHeaders }) : Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
      }
      if (request.method === "POST") {
        const body = await request.json() as any;
        await env.D1_METADATA.prepare(
          "UPDATE worker_tasks SET status = ?, result = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(body.status, JSON.stringify(body.result || null), body.error || null, reqId).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    }

    // --- SWARM ROUTES (swarmCreate, swarmHandoff, swarmArtifact) ---
    if (path.startsWith("/swarm")) {
      const id = env.SWARM_COORDINATOR.idFromName("global");
      const stub = env.SWARM_COORDINATOR.get(id);
      return stub.fetch(request);
    }

    // --- QUEUE: Submit task for async processing ---
    if (path === "/queue/submit" && request.method === "POST") {
      const body = await request.json() as any;
      let { instruction } = body;
      
      if (!instruction) {
        return Response.json({ error: "instruction required" }, { status: 400, headers: corsHeaders });
      }

      // Apply Prompt Armor
      instruction = applyPromptArmor(instruction);

      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const task: TaskMessage = {
        taskId,
        instruction,
        type: body.type || "general",
        priority: body.priority || "normal",
        metadata: body.metadata,
        createdAt: new Date().toISOString(),
      };

      await enqueueTask(env.TASK_QUEUE, task);

      // Track in analytics
      const analytics = new BASAnalytics(env.BAS_ANALYTICS);
      analytics.recordSystemMetric({ type: "queue_depth", value: 1, source: "api" });

      return Response.json({ taskId, status: "queued", queue: "bas-task-queue" }, { status: 202, headers: corsHeaders });
    }

    // --- R2: Artifact management ---
    if (path.startsWith("/artifacts")) {
      const r2 = new R2ArtifactManager(env.R2_KNOWLEDGE, env.R2_PREFIX || "Brunella-core");

      // List artifacts: GET /artifacts/:agentId[/:taskId]
      if (request.method === "GET") {
        const parts = path.split("/").filter(Boolean);
        const agentId = parts[1] || "";
        const taskId = parts[2];
        if (!agentId) {
          return Response.json({ error: "agentId required: /artifacts/:agentId" }, { status: 400, headers: corsHeaders });
        }
        const artifacts = await r2.listArtifacts(agentId, taskId);
        return Response.json({ artifacts, count: artifacts.length }, { headers: corsHeaders });
      }

      // Upload artifact: POST /artifacts
      if (request.method === "POST") {
        const body = await request.json() as any;
        const result = await r2.upload(
          { agentId: body.agentId, taskId: body.taskId, artifactType: body.artifactType || "data", filename: body.filename, contentType: body.contentType || "text/plain", tags: body.tags },
          body.content,
        );
        return Response.json(result, { status: 201, headers: corsHeaders });
      }
    }

    // --- ANALYTICS: Read metrics summary ---
    if (path === "/analytics/summary" && request.method === "GET") {
      return Response.json({
        status: "active",
        dataset: "bas_agent_telemetry",
        note: "Query via Cloudflare Analytics Engine SQL API for detailed metrics",
        models: {
          default: env.DEFAULT_CODE_MODEL,
          fallback: env.FALLBACK_CODE_MODEL,
          reasoning: env.REASONING_MODEL,
          fast: env.FAST_MODEL,
        },
      }, { headers: corsHeaders });
    }

    // --- ZERO-PROMPT EDGE MIRROR ---
    if (path === "/zero-prompt/summary" && request.method === "POST") {
      const body = await request.json() as { mirroredAt?: unknown; summary?: unknown };
      const mirroredAt = typeof body.mirroredAt === "string" && body.mirroredAt.trim().length > 0
        ? body.mirroredAt
        : new Date().toISOString();

      await env.D1_METADATA.prepare(`
        INSERT INTO edge_runtime_mirror (key, summary_json, mirrored_at)
        VALUES (?, ?, ?)
      `).bind("zero_prompt_summary", JSON.stringify(body.summary ?? null), mirroredAt).run();

      return Response.json({ success: true, mirroredAt }, { headers: corsHeaders });
    }

    if (path === "/zero-prompt/summary" && request.method === "GET") {
      const row = await env.D1_METADATA.prepare(
        "SELECT key, summary_json, mirrored_at FROM edge_runtime_mirror WHERE key = ?"
      ).bind("zero_prompt_summary").first<{ key: string; summary_json: string; mirrored_at: string }>();

      if (!row) {
        return Response.json({ success: false, error: "Zero-Prompt summary not found" }, { status: 404, headers: corsHeaders });
      }

      return Response.json({
        success: true,
        mirroredAt: row.mirrored_at,
        summary: safeJsonParse<any>(row.summary_json, null),
      }, { headers: corsHeaders });
    }

    // --- CHAT SYNC API ---
    if (path === "/chat/messages" && request.method === "GET") {
      const result = await env.D1_METADATA.prepare("SELECT * FROM chat_messages ORDER BY timestamp ASC").all();
      return Response.json(result.results, { headers: corsHeaders });
    }

    if (path === "/chat/messages" && request.method === "POST") {
      const msg = await request.json() as any;
      await env.D1_METADATA.prepare(
        "INSERT INTO chat_messages (role, content, model, timestamp) VALUES (?, ?, ?, ?)"
      ).bind(msg.role, msg.content, msg.model || "unknown", msg.timestamp || new Date().toISOString()).run();
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // --- AI GATEWAY PROXY ---
    if (path === "/ai/generate" && request.method === "POST") {
      const body = await request.json() as Record<string, unknown>;
      const model = pickString(body.model, env.FAST_MODEL, env.DEFAULT_CODE_MODEL) || env.FAST_MODEL;
      const prompt = pickString(body.prompt, body.instruction) || "";
      const requestId = pickString(body.requestId) || `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const startedAt = Date.now();

      if (!prompt) {
        return Response.json({ error: "prompt is required" }, { status: 400, headers: corsHeaders });
      }

      // Rate Limiting check
      if (env.AI_RATE_LIMITER) {
        const limiter = env.AI_RATE_LIMITER as { limit: (options: { key: string }) => Promise<{ success: boolean }> };
        const { success } = await limiter.limit({ key: model });
        if (!success) {
          return Response.json({ error: "Rate limit exceeded for model: " + model, requestId }, { status: 429, headers: corsHeaders });
        }
      }

      try {
        const options = isRecord(body.options) ? body.options : {};
        const result = await runWorkersAi(env, model, { prompt, ...options });
        const latency = Date.now() - startedAt;

        // Log to D1 (fire and forget for now, but we await to ensure integrity during phase 2)
        await env.D1_METADATA.prepare(
          "INSERT INTO ai_calls (id, model, prompt, response, latency_ms, status) VALUES (?, ?, ?, ?, ?, 'success')"
        ).bind(requestId, model, prompt.slice(0, 1000), JSON.stringify(result).slice(0, 2000), latency).run();

        return Response.json({ model, result, requestId }, { headers: corsHeaders });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const latency = Date.now() - startedAt;
        
        await env.D1_METADATA.prepare(
          "INSERT INTO ai_calls (id, model, prompt, error, latency_ms, status) VALUES (?, ?, ?, ?, ?, 'failed')"
        ).bind(requestId, model, prompt.slice(0, 1000), message, latency).run();

        return Response.json({ error: message, requestId }, { status: 500, headers: corsHeaders });
      }
    }

    // --- KKV DATA API ---
    if (path === "/kkv/clients") {
      if (request.method === "GET") {
        const result = await env.D1_METADATA.prepare("SELECT * FROM clients ORDER BY name ASC").all();
        return Response.json(result.results, { headers: corsHeaders });
      }
      if (request.method === "POST") {
        const body = await request.json() as any;
        const id = body.id || crypto.randomUUID();
        await env.D1_METADATA.prepare(
          "INSERT INTO clients (id, name, tax_number, email, address) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, body.name, body.tax_number || null, body.email || null, body.address || null).run();
        return Response.json({ success: true, id }, { status: 201, headers: corsHeaders });
      }
    }

    if (path === "/kkv/invoices") {
      if (request.method === "GET") {
        const result = await env.D1_METADATA.prepare("SELECT * FROM invoices ORDER BY created_at DESC").all();
        return Response.json(result.results, { headers: corsHeaders });
      }
      if (request.method === "POST") {
        const body = await request.json() as any;
        const id = body.id || crypto.randomUUID();
        await env.D1_METADATA.prepare(
          "INSERT INTO invoices (id, client_id, invoice_number, amount, currency, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, body.client_id, body.invoice_number || null, body.amount, body.currency || "HUF", body.status || "draft", body.due_date || null).run();
        return Response.json({ success: true, id }, { status: 201, headers: corsHeaders });
      }
    }

    // --- STATIC ASSETS ---
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
      return await env.ASSETS.fetch(new Request(new URL("/", request.url)));
    } catch {
      return Response.json({ 
        status: "online", 
        version: "3.0.0", 
        swarm: "active",
        queues: ["bas-task-queue", "bas-result-queue", "bas-dlq"],
        models: {
          default: env.DEFAULT_CODE_MODEL,
          reasoning: env.REASONING_MODEL,
          fast: env.FAST_MODEL,
        },
        endpoints: [
          "POST /queue/submit",
          "GET/POST /artifacts/:agentId",
          "GET /analytics/summary",
          "/swarm/*",
          "/chat/messages",
        ],
      }, { headers: corsHeaders });
    }
  },

  // --- QUEUE CONSUMER ---
  async queue(batch: MessageBatch<TaskMessage>, env: Env): Promise<void> {
    await handleQueueBatch(batch, env as any);
  },
};
