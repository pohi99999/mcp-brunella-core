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
  N8N_WEBHOOK_URL: string;
  BROWSER_USE_ENDPOINT: string;
  DEFAULT_CODE_MODEL: string;
}

interface BASTask {
  id: string;
  type: "browser" | "research" | "code" | "orchestrate";
  status: "pending" | "dispatched" | "running" | "completed" | "failed";
  payload: Record<string, unknown>;
  result?: unknown;
  createdAt: string;
  updatedAt: string;
}

// Task ID generator
function generateTaskId(): string {
  return `bas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// AI-powered task classifier
async function classifyTask(ai: Ai, instruction: string): Promise<BASTask["type"]> {
  const normalized = instruction.toLowerCase();

  // Keyword-based heuristics (Fast track)
  const codeKeywords = ["script", "kód", "code", "python", "js", "javascript", "függvény", "function", "írj", "write", "program"];
  if (codeKeywords.some(kw => normalized.includes(kw)) &&
    (normalized.includes("írj") || normalized.includes("write") || normalized.includes("generál") || normalized.includes("generate"))) {
    return "code";
  }

  const browserKeywords = ["nyisd meg", "open", "kattints", "click", "keress a neten", "search web", "böngésző", "browser"];
  if (browserKeywords.some(kw => normalized.includes(kw))) {
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

Válaszolj CSAK a kategória nevével, semmi mással.`
      },
      { role: "user", content: instruction }
    ],
    max_tokens: 10
  });

  const result = (response as { response?: string }).response?.toLowerCase().trim() || "orchestrate";

  if (["browser", "research", "code", "orchestrate"].includes(result)) {
    return result as BASTask["type"];
  }
  return "orchestrate";
}

// Coding Agent - Direct code generation using Workers AI
async function handleCodingTask(ai: Ai, instruction: string, model: string = "@cf/meta/llama-3.1-8b-instruct", history: Array<{ role: "user" | "assistant" | "system"; content: string }> = []) {
  const messages = [
    {
      role: "system",
      content: "Te egy profi kódoló ügynök vagy a BAS (Brunella Agent System) keretében. Feladatod kiváló minőségű, tiszta és dokumentált kód generálása a felhasználó kérése alapján. Válaszolj magyarul a magyarázatokban, de a kód legyen angol nyelvű standardok szerinti."
    }
  ];

  // Append history if valid
  if (Array.isArray(history) && history.length > 0) {
    messages.push(...history.map(h => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content
    })));
  }

  // Append current instruction
  messages.push({ role: "user", content: instruction });

  const response = await ai.run(model as any, {
    messages
  });
  return response;
}

// Dispatch task to appropriate handler
async function dispatchTask(task: BASTask, env: Env, workerOrigin: string): Promise<void> {
  const target = task.type === "browser"
    ? env.BROWSER_USE_ENDPOINT
    : env.N8N_WEBHOOK_URL;
  const callbackPath = task.type === "browser" ? "browser-use" : "n8n";

  try {
    await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        type: task.type,
        payload: task.payload,
        callbackUrl: `${workerOrigin}/webhook/${callbackPath}`
      })
    });
  } catch (error) {
    console.error(`Dispatch failed for task ${task.id}:`, error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /task - Submit new task
    if (path === "/task" && request.method === "POST") {
      const body = await request.json() as { instruction: string; context?: Record<string, unknown> };
      const { instruction, context } = body;

      if (!instruction) {
        return Response.json({ error: "instruction required" }, { status: 400, headers: corsHeaders });
      }

      const ai = new Ai(env.AI);
      const taskType = await classifyTask(ai, instruction);

      const task: BASTask = {
        id: generateTaskId(),
        type: taskType,
        status: "pending",
        payload: { instruction, context },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store task
      await env.BAS_TASKS.put(task.id, JSON.stringify(task), { expirationTtl: 86400 });

      // Dispatch to handler
      task.status = "dispatched";
      await env.BAS_TASKS.put(task.id, JSON.stringify(task));
      const workerOrigin = new URL(request.url).origin;

      if (taskType === "code") {
        // Direct execution for code tasks if preferred, or still send to n8n as fallback
        task.status = "running";
        await env.BAS_TASKS.put(task.id, JSON.stringify(task));

        try {
          const history = Array.isArray(context?.history) ? context.history : [];
          const codeResult = await handleCodingTask(ai, instruction, env.DEFAULT_CODE_MODEL, history);
          task.status = "completed";
          task.result = codeResult;
          task.updatedAt = new Date().toISOString();
          await env.BAS_TASKS.put(task.id, JSON.stringify(task));

          return Response.json({
            success: true,
            taskId: task.id,
            type: taskType,
            result: codeResult,
            message: "Code generated successfully via Workers AI Coding Agent"
          }, { headers: corsHeaders });
        } catch (e: any) {
          task.status = "failed";
          task.result = { error: e.message };
          await env.BAS_TASKS.put(task.id, JSON.stringify(task));
          return Response.json({ error: "Coding agent failed", details: e.message }, { status: 500, headers: corsHeaders });
        }
      }

      await dispatchTask(task, env, workerOrigin);

      return Response.json({
        success: true,
        taskId: task.id,
        type: taskType,
        message: `Task dispatched to ${taskType === "browser" ? "Browser-Use (robotkéz)" : "n8n"}`
      }, { headers: corsHeaders });
    }

    // GET /status/:taskId - Check status
    if (path.startsWith("/status/") && request.method === "GET") {
      const taskId = path.replace("/status/", "");
      const taskData = await env.BAS_TASKS.get(taskId);

      if (!taskData) {
        return Response.json({ error: "Task not found" }, { status: 404, headers: corsHeaders });
      }

      return Response.json(JSON.parse(taskData), { headers: corsHeaders });
    }

    // POST /webhook/browser-use - Browser-Use callback
    if (path === "/webhook/browser-use" && request.method === "POST") {
      const body = await request.json() as { taskId: string; status: string; result?: unknown };
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
      const body = await request.json() as { taskId: string; status: string; result?: unknown };
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

    // GET / - Health check & info
    if (path === "/" || path === "") {
      return Response.json({
        service: "BAS Cloudflare Orchestrator",
        version: "1.0.0",
        architecture: "hybrid",
        endpoints: {
          submitTask: "POST /task",
          checkStatus: "GET /status/:taskId",
          browserUseWebhook: "POST /webhook/browser-use",
          n8nWebhook: "POST /webhook/n8n"
        },
        status: "operational"
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }
};
