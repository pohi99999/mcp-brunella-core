/**
 * BAS Cloudflare Orchestrator - Core Entry Point
 * Swarm: swarmCreate, swarmHandoff, swarmArtifact, swarmStatus
 * Queues: Async task distribution via bas-task-queue
 * R2: Artifact storage via vodor1
 * Analytics: Agent telemetry via BAS_ANALYTICS
 */

import { Ai } from "@cloudflare/ai";
export { SwarmCoordinator } from "./swarmCoordinator.js";
import { handleQueueBatch, enqueueTask, type TaskMessage } from "./queueHandler.js";
import { R2ArtifactManager } from "./r2Artifacts.js";
import { BASAnalytics } from "./analyticsEngine.js";

interface Env {
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

  CLOUDFLARE_API_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- SECURITY CHECK ---
    const authHeader = request.headers.get("Authorization");
    if (path.startsWith("/chat/") || path.startsWith("/swarm/")) {
       const expectedToken = (env.CLOUDFLARE_API_TOKEN || "").trim();
       const receivedToken = (authHeader || "").replace("Bearer ", "").trim();
       if (expectedToken && receivedToken !== expectedToken) {
         return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
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
