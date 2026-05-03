export { SwarmCoordinator } from "./swarmCoordinator.js";

import { enqueueTask } from "./queueHandler.js";
import {
  authenticateWorkerRequest,
  buildCorsHeaders,
  getWorkerRouteAccess,
} from "./security.js";
import type { WorkerEnv } from "./types.js";

interface SwarmCoordinatorBindingContract {
  SWARM_COORDINATOR: DurableObjectNamespace;
}

void (0 as unknown as SwarmCoordinatorBindingContract);

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function text(data: string, status = 200, headers: HeadersInit = {}): Response {
  return new Response(data, { status, headers });
}

function getRequestId(): string {
  return `req-${crypto.randomUUID()}`;
}

function normalizeJsonBody<T extends Record<string, unknown>>(body: T | null | undefined): T {
  return (body ?? {}) as T;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  return (await request.json()) as Record<string, unknown>;
}

async function callAiGateway(
  env: WorkerEnv,
  model: string,
  input: { prompt?: string; messages?: unknown[] },
): Promise<unknown> {
  if (env.AI?.run) {
    return await env.AI.run(model, input);
  }
  return { response: "AI unavailable" };
}

async function logDispatch(
  env: WorkerEnv,
  requestId: string,
  agentName: string,
  taskType: string,
  target: string,
  reason: string,
): Promise<void> {
  if (!env.D1_METADATA) {
    return;
  }
  await env.D1_METADATA
    .prepare(
      "INSERT INTO dispatch_log (id, agent_name, task_type, target, reason, success, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(requestId, agentName, taskType, target, reason, 1, 0, new Date().toISOString())
    .run();
}

async function handleAiGenerate(request: Request, env: WorkerEnv): Promise<Response> {
  const body = normalizeJsonBody(await readJson(request));
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const model =
    typeof body.model === "string" && body.model.length > 0
      ? body.model
      : env.FAST_MODEL ?? "@cf/meta/llama-3.1-70b-instruct";

  if (!prompt.trim()) {
    return json({ error: "prompt is required" }, 400);
  }

  try {
    const result = await callAiGateway(env, model, { prompt });
    return json({ model, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
}

async function handleKvClients(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.D1_METADATA) {
    return json({ error: "D1 not configured" }, 503);
  }

  if (request.method === "GET") {
    const result = await env.D1_METADATA.prepare("SELECT * FROM clients ORDER BY name ASC").all();
    return json(result.results ?? []);
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    const id = typeof body.id === "string" ? body.id : crypto.randomUUID();
    await env.D1_METADATA
      .prepare("INSERT INTO clients (id, name, tax_number, email, address) VALUES (?, ?, ?, ?, ?)")
      .bind(
        id,
        typeof body.name === "string" ? body.name : "",
        typeof body.tax_number === "string" ? body.tax_number : null,
        typeof body.email === "string" ? body.email : null,
        typeof body.address === "string" ? body.address : null,
      )
      .run();
    return json({ success: true, id }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
}

async function handleKvInvoices(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.D1_METADATA) {
    return json({ error: "D1 not configured" }, 503);
  }

  if (request.method === "GET") {
    const result = await env.D1_METADATA.prepare("SELECT * FROM invoices ORDER BY created_at DESC").all();
    return json(result.results ?? []);
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    const id = typeof body.id === "string" ? body.id : crypto.randomUUID();
    await env.D1_METADATA
      .prepare(
        "INSERT INTO invoices (id, client_id, invoice_number, amount, currency, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        typeof body.client_id === "string" ? body.client_id : null,
        typeof body.invoice_number === "string" ? body.invoice_number : null,
        typeof body.amount === "number" ? body.amount : Number(body.amount ?? 0),
        typeof body.currency === "string" ? body.currency : "HUF",
        typeof body.status === "string" ? body.status : "draft",
        typeof body.due_date === "string" ? body.due_date : null,
      )
      .run();
    return json({ success: true, id }, 201);
  }

  return json({ error: "Method not allowed" }, 405);
}

async function handleWorkersList(env: WorkerEnv): Promise<Response> {
  void env;
  return json([]);
}

async function handleZeroPromptSummary(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.D1_METADATA) {
    return json({ error: "D1 not configured" }, 503);
  }

  const key = "zero-prompt-summary";
  if (request.method === "POST") {
    const body = await readJson(request);
    const mirroredAt = typeof body.mirroredAt === "string" ? body.mirroredAt : new Date().toISOString();
    const summary = body.summary ?? {};
    await env.D1_METADATA
      .prepare("INSERT INTO edge_runtime_mirror (key, summary_json, mirrored_at) VALUES (?, ?, ?)")
      .bind(key, JSON.stringify(summary), mirroredAt)
      .run();
    return json({ success: true, mirroredAt, summary });
  }

  const row = await env.D1_METADATA
    .prepare("SELECT key, summary_json, mirrored_at FROM edge_runtime_mirror WHERE key = ?")
    .bind(key)
    .first<{ key: string; summary_json: string; mirrored_at: string }>();

  if (!row) {
    return json({ error: "Summary not found" }, 404);
  }

  return json({ success: true, mirroredAt: row.mirrored_at, summary: JSON.parse(row.summary_json) });
}

async function handleDispatchSmart(request: Request, env: WorkerEnv): Promise<Response> {
  const body = normalizeJsonBody(await readJson(request));
  const taskMeta = normalizeJsonBody(body.taskMeta as Record<string, unknown> | null | undefined);
  const payload = normalizeJsonBody(body.payload as Record<string, unknown> | null | undefined);
  const requestId = typeof body.requestId === "string" && body.requestId.length > 0 ? body.requestId : getRequestId();
  const agentName = typeof taskMeta.agentName === "string" ? taskMeta.agentName : "unknown";
  const taskType = typeof taskMeta.type === "string" ? taskMeta.type : "task";
  const isAsync = Boolean(taskMeta.isAsync);
  const requiresLocalModel = Boolean(taskMeta.requiresLocalModel);
  const requiresExternalAPI = Boolean(taskMeta.requiresExternalAPI);
  const isDataLookup = Boolean(taskMeta.isDataLookup);
  const involvesLLM = Boolean(taskMeta.involvesLLM);
  const isVectorSearch = Boolean(taskMeta.isVectorSearch);

  if (isAsync && env.TASK_QUEUE) {
    await enqueueTask(env.TASK_QUEUE, { requestId, taskMeta, payload });
    await logDispatch(env, requestId, agentName, taskType, "cf_queue", "async task");
    return json({ requestId, taskId: `task_${requestId}`, decision: { target: "cf_queue" }, queued: true, status: "queued", result: { status: "queued" } });
  }

  if (isDataLookup) {
    if (payload.key && Object.prototype.hasOwnProperty.call(payload, "value")) {
      if (env.BAS_TASKS?.put) {
        await env.BAS_TASKS.put(String(payload.key), JSON.stringify(payload.value));
      }
      await logDispatch(env, requestId, agentName, taskType, "cf_kv", "kv write");
      return json({ requestId, decision: { target: "cf_kv" }, status: "completed", result: { key: String(payload.key), stored: true } });
    }

    if (payload.key) {
      const key = String(payload.key);
      const value = env.BAS_TASKS?.get ? await env.BAS_TASKS.get(key) : null;
      await logDispatch(env, requestId, agentName, taskType, "cf_kv", "kv read");
      return json({ requestId, decision: { target: "cf_kv" }, status: "completed", result: { key, value } });
    }

    if ((payload.query || payload.sql) && env.D1_METADATA) {
      const sql = String(payload.query ?? payload.sql);
      const params = Array.isArray(payload.params) ? payload.params : [];
      const stmt = env.D1_METADATA.prepare(sql).bind(...params);
      const isSelect = /^\s*select/i.test(sql);
      const result = isSelect ? await stmt.all() : await stmt.run();
      await logDispatch(env, requestId, agentName, taskType, "cf_d1", "d1 query");
      return json({ requestId, decision: { target: "cf_d1" }, status: "completed", result });
    }
  }

  if (requiresExternalAPI && env.D1_METADATA) {
    const worker = await env.D1_METADATA
      .prepare("SELECT worker_url FROM worker_routing WHERE agent_name = ? AND is_healthy = 1 LIMIT 1")
      .bind(agentName)
      .first<{ worker_url: string }>();
    const fallbackWorker = worker
      ? worker
      : await env.D1_METADATA
          .prepare("SELECT worker_url FROM worker_routing WHERE is_healthy = 1 LIMIT 1")
          .first<{ worker_url: string }>();

    const workerUrl = fallbackWorker?.worker_url;
    if (!workerUrl) {
      await env.D1_METADATA
        .prepare("INSERT INTO worker_tasks (id, agent_name, worker_url, task, context, status, result, error, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(requestId, agentName, null, JSON.stringify(taskMeta), JSON.stringify(payload), "failed", null, "No healthy worker found", new Date().toISOString())
        .run();
      return json({ requestId, decision: { target: "cf_worker" }, status: "failed", error: "No healthy worker found" });
    }

    try {
      const response = await fetch(`${workerUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BAS-API-Key": env.CLOUDFLARE_API_TOKEN ?? env.BAS_API_KEY ?? "",
        },
        body: JSON.stringify({ requestId, taskMeta, payload }),
      });
      const result = await response.json();
      await env.D1_METADATA
        .prepare("INSERT INTO worker_tasks (id, agent_name, worker_url, task, context, status, result, error, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(requestId, agentName, workerUrl, JSON.stringify(taskMeta), JSON.stringify(payload), "completed", JSON.stringify(result), null, new Date().toISOString())
        .run();
      return json({ requestId, decision: { target: "cf_worker" }, status: "completed", workerUrl, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await env.D1_METADATA
        .prepare("INSERT INTO worker_tasks (id, agent_name, worker_url, task, context, status, result, error, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(requestId, agentName, workerUrl, JSON.stringify(taskMeta), JSON.stringify(payload), "failed", null, message, new Date().toISOString())
        .run();
      return json({ requestId, decision: { target: "cf_worker" }, status: "failed", error: message, workerUrl });
    }
  }

  if (involvesLLM) {
    const model =
      typeof payload.model === "string" && payload.model.length > 0
        ? payload.model
        : env.FAST_MODEL ?? env.DEFAULT_CODE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
    const result = await callAiGateway(env, model, {
      prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
      messages: Array.isArray(payload.messages) ? payload.messages : undefined,
    });
    await logDispatch(env, requestId, agentName, taskType, "cf_ai_gateway", "llm");
    return json({ requestId, decision: { target: "cf_ai_gateway" }, status: "completed", result });
  }

  if (isVectorSearch && env.VECTORIZE_CEAN && env.VECTORIZE_MEMORY) {
    const vector = Array.isArray(payload.vector) ? payload.vector.map((value) => Number(value)) : [];
    const result = await env.VECTORIZE_CEAN.query(vector, { topK: 5 });
    await logDispatch(env, requestId, agentName, taskType, "cf_vectorize", "vector search");
    return json({ requestId, decision: { target: "cf_vectorize" }, status: "completed", result });
  }

  if (requiresLocalModel) {
    await logDispatch(env, requestId, agentName, taskType, "local", "local model requested");
    return json({ requestId, decision: { target: "local" }, status: "local", result: { delegated: false } });
  }

  await logDispatch(env, requestId, agentName, taskType, "local", "default local route");
  return json({ requestId, decision: { target: "local" }, status: "local", result: { delegated: false } });
}

async function handleProtectedRoute(request: Request, env: WorkerEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  switch (path) {
    case "/ai/generate":
      return handleAiGenerate(request, env);
    case "/dispatch":
    case "/dispatch-smart":
      return handleDispatchSmart(request, env);
    case "/workers":
      return handleWorkersList(env);
    case "/routing":
      return json({ routes: ["swarmCreate", "swarmHandoff", "swarmArtifact"] });
    case "/zero-prompt/summary":
      return handleZeroPromptSummary(request, env);
    case "/task":
      return json({ success: true, requestId: getRequestId() });
    case "/history":
      return json([]);
    case "/queue/submit":
      return json({ success: true });
    case "/chat/messages":
      return json([]);
    case "/kkv/clients":
      return handleKvClients(request, env);
    case "/kkv/invoices":
      return handleKvInvoices(request, env);
    default:
      return json({ error: "Not found" }, 404);
  }
}

async function handleSwarmRoute(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.SWARM_COORDINATOR) {
    return json({ error: "Swarm coordinator not configured" }, 503);
  }

  const id = env.SWARM_COORDINATOR.idFromName("global");
  const stub = env.SWARM_COORDINATOR.get(id);
  return stub.fetch(request);
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
    }

    if (path.startsWith("/swarm")) {
      return handleSwarmRoute(request, env);
    }

    if (path === "/health") {
      return json(
        {
          status: "healthy",
          endpoints: ["swarmCreate", "swarmHandoff", "swarmArtifact", "aiGenerate", "dispatchSmart", "zeroPromptSummary"],
        },
        200,
        buildCorsHeaders(request, env),
      );
    }

    const access = getWorkerRouteAccess(path, request.method);
    if (access === "protected") {
      const auth = authenticateWorkerRequest(request, env);
      if (!auth.ok) {
        return json({ error: auth.error }, auth.status, buildCorsHeaders(request, env));
      }
      return handleProtectedRoute(request, env);
    }

    if (path === "/") {
      return text("Brunella Cloudflare Orchestrator", 200, buildCorsHeaders(request, env));
    }

    return json({ error: "Not found" }, 404, buildCorsHeaders(request, env));
  },
};

export default worker;
