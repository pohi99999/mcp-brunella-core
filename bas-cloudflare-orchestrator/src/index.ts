/**
 * BAS Cloudflare Orchestrator - Core Entry Point
 * Swarm: swarmCreate, swarmHandoff, swarmArtifact, swarmStatus
 * Queues: Async task distribution via bas-task-queue
 * R2: Artifact storage via vodor1
 * Analytics: Agent telemetry via BAS_ANALYTICS
 */

import { Ai } from "@cloudflare/ai";
import { safeJsonParse } from './utils/aiHelpers.js';
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

  // Workers AI model config
  DEFAULT_CODE_MODEL: string;
  FALLBACK_CODE_MODEL: string;
  REASONING_MODEL: string;
  FAST_MODEL: string;
  R2_PREFIX: string;
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

    // --- DISPATCH: Route task to specific agent worker ---
    if (path === "/dispatch" && request.method === "POST") {
      const body = await request.json() as any;
      const { agent, task, context, requestId } = body;

      if (!agent || !task) {
        return Response.json({ error: "agent and task required" }, { status: 400, headers: corsHeaders });
      }

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
      if (!body.instruction) {
        return Response.json({ error: "instruction required" }, { status: 400, headers: corsHeaders });
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const task: TaskMessage = {
        taskId,
        instruction: body.instruction,
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
