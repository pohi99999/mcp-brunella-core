/**
 * BAS Cloudflare Worker - Edge Orchestrator
 *
 * Felelősségek:
 * 1. API Gateway - Külső belépési pont
 * 2. Task Router - AI-alapú osztályozás
 * 3. KV Storage - Elosztott task queue
 * 4. Tunnel Proxy - Lokális rendszer elérés
 * 5. Workers AI - Fallback LLM
 */

import { Env, TaskPayload, TaskRecord } from "./types.js";
import { parseAiResponse } from './lib/aiHelpers.js';
export { EdgeCoordinator } from "./edge-coordinator.js";
export { DailyHealthCheckWorkflow } from "./workflows/daily-health-check.js";
export { TaskPipelineWorkflow } from "./workflows/task-pipeline.js";

// Task típus osztályozás Workers AI-val (upgraded model)
async function classifyTask(env: Env, instruction: string): Promise<{ type: string; tokens: number }>
{
  const model = env.DEFAULT_CODE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  try {
    const modelName = typeof model === 'string' ? model : String(model ?? '');
    const aiRaw = await env.AI.run(modelName as never, {
      messages: [{ role: 'user', content: instruction }],
      max_tokens: 50,
    });

    const { text: parsedText, tokens: tokensUsed } = parseAiResponse(aiRaw);
    const responseText = String(parsedText ?? '').trim().toLowerCase();
    return { type: responseText || 'general', tokens: tokensUsed || 0 };
  } catch {
    return { type: 'general', tokens: 0 };
  }
}

// Forward requests to the local tunnel (used for backstage API proxying)
async function forwardToLocal(env: Env, path: string, options: RequestInit = {}): Promise<Response> {
  if (!env.BAS_LOCAL_URL) {
    return new Response(JSON.stringify({ error: 'Local URL not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = `${env.BAS_LOCAL_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string> || {}),
        'X-Forwarded-From': 'cloudflare-worker',
      },
    });

    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Local system unreachable', details: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-BAS-API-Key, X-CEAN-API-Key",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Routing
    try {
      // WebSocket / Durable Object routing
      if (path === "/ws" || request.headers.get("Upgrade") === "websocket") {
        const id = env.EDGE_COORDINATOR.idFromName("global");
        const stub = env.EDGE_COORDINATOR.get(id);
        return stub.fetch(request);
      }

      // Health check
      if (path === "/health" || path === "/") {
        const localHealth = await forwardToLocal(env, "/api/health").catch(
          () => null,
        );
        const tunnelStatus = localHealth?.ok ? "connected" : "disconnected";

        return new Response(
          JSON.stringify({
            status: "healthy",
            edge: "cloudflare",
            tunnel: tunnelStatus,
            timestamp: new Date().toISOString(),
            version: "2.0.0",
            capabilities: {
              queues: Boolean(env.TASK_QUEUE),
              r2: Boolean(env.R2_ARTIFACTS),
              vectorize: Boolean(env.VECTORIZE_MEMORY),
              analytics: Boolean(env.BAS_ANALYTICS),
              models: {
                default: env.DEFAULT_CODE_MODEL,
                reasoning: env.REASONING_MODEL,
                fast: env.FAST_MODEL,
              },
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Workers AI generate endpoint (used by /api/llm provider=cloudflare)
      if (path === "/ai/generate" && request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          model?: string;
          messages?: Array<{ role?: string; content?: string }>;
        };

        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const messages = Array.isArray(body.messages)
          ? body.messages
              .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
              .map((m) => ({
                role: m.role === "system" || m.role === "assistant" || m.role === "user" ? m.role : "user",
                content: String(m.content),
              }))
          : [];

        if (!prompt && messages.length === 0) {
          return new Response(
            JSON.stringify({ error: "prompt or messages required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const selectedModel =
          body.model || env.DEFAULT_CODE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

        try {
          const selectedModelName = typeof selectedModel === 'string' ? selectedModel : String(selectedModel ?? '');
          const aiRaw = await env.AI.run(selectedModelName as never, {
            messages:
              messages.length > 0
                ? messages
                : [
                    {
                      role: "user",
                      content: prompt,
                    },
                  ],
            max_tokens: 900,
          });

          const { text: responseText, tokens: tokensUsed } = parseAiResponse(aiRaw);

          return new Response(
            JSON.stringify({
              success: true,
              model: selectedModelName,
              result: {
                response: responseText || "",
                tokens: tokensUsed || 0,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Workers AI generation failed",
              details: String(error),
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // Task submission
      if (path === "/task" && request.method === "POST") {
        const payload: TaskPayload = await request.json();

        if (!payload.instruction) {
          return new Response(
            JSON.stringify({ error: "instruction required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Task ID generálás
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Task osztályozás (típus + token használat)
        const classification = await classifyTask(env, payload.instruction);
        const taskType = classification.type;
        // annotate payload with classification tokens for downstream consumers
        try {
          (payload as Record<string, unknown>).classificationTokens = classification.tokens;
        } catch { /* ignore */ }

        // D1 INSERT
        try {
          await env.DB.prepare(
            `INSERT INTO tasks (id, instruction, status, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              taskId,
              payload.instruction,
              "pending",
              Date.now(),
              Date.now(),
              JSON.stringify({ type: taskType, ...payload }),
            )
            .run();
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Database error", details: String(e) }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Send to Queue for async processing (if Queue binding available)
        if (env.TASK_QUEUE) {
          try {
            await env.TASK_QUEUE.send({
              taskId,
              instruction: payload.instruction,
              type: taskType,
              priority: "normal",
              createdAt: new Date().toISOString(),
              classificationTokens: (payload as Record<string, unknown>).classificationTokens || 0,
            } as TaskPayload);
          } catch {
            // Queue send failed — fallback to direct local dispatch
          }
        }

        // Record telemetry
        if (env.BAS_ANALYTICS) {
          env.BAS_ANALYTICS.writeDataPoint({
            blobs: [taskId, taskType, "edge", "submitted"],
            doubles: [(payload as Record<string, unknown>).classificationTokens || 0, 0],
            indexes: ["task_submit"],
          });
        }

        // Notify local system via tunnel
        const task: TaskRecord = {
          taskId,
          type: taskType,
          status: "pending",
          payload,
          createdAt: new Date().toISOString(),
        };

        const localResponse = await forwardToLocal(env, "/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });

        if (localResponse.ok) {
          await env.DB.prepare(`UPDATE tasks SET status = ? WHERE id = ?`)
            .bind("dispatched", taskId)
            .run();
          task.status = "dispatched";
        }

        return new Response(JSON.stringify(task), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Task status
      if (path.startsWith("/status/")) {
        const taskId = path.split("/")[2];

        try {
          const result = await env.DB.prepare(
            `SELECT * FROM tasks WHERE id = ?`,
          )
            .bind(taskId)
            .first();

          if (!result) {
            return new Response(JSON.stringify({ error: "Task not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Database error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // History endpoint (Phase 3)
      if (path === "/history" && request.method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);

        try {
          const { results } = await env.DB.prepare(
            `SELECT id, instruction, status, created_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT ?`,
          )
            .bind(limit)
            .all();

          return new Response(JSON.stringify({ tasks: results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Database error", details: String(e) }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // API proxy (minden más /api/* útvonal)
      if (path.startsWith("/api/")) {
        return await forwardToLocal(env, path, {
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: request.method !== "GET" ? await request.text() : undefined,
        });
      }

      // Dashboard proxy
      if (path.startsWith("/dashboard")) {
        return await forwardToLocal(env, path.replace("/dashboard", ""), {
          method: request.method,
          headers: Object.fromEntries(request.headers),
        });
      }

      // Workflow trigger endpoints
      if (path === '/workflow/health-check' && request.method === 'POST') {
        const instance = await env.HEALTH_CHECK_WORKFLOW.create({ params: { trigger: 'manual' } });
        return new Response(JSON.stringify({
          workflowId: instance.id,
          status: 'started',
          type: 'daily-health-check'
        }), {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === '/workflow/task-pipeline' && request.method === 'POST') {
        const payload = await request.json();
        const instance = await env.TASK_PIPELINE_WORKFLOW.create({ params: payload });
        return new Response(JSON.stringify({
          workflowId: instance.id,
          status: 'started',
          type: 'task-pipeline'
        }), {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 404
      return new Response(
        JSON.stringify({
          error: "Not Found",
          availableEndpoints: [
            "GET /health",
            "POST /ai/generate",
            "POST /task",
            "GET /status/:taskId",
            "GET /history",
            "POST /workflow/health-check",
            "POST /workflow/task-pipeline",
            "ANY /api/*",
            "ANY /dashboard/*",
          ],
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          details: String(error),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
};
