/**
 * BAS Cloudflare Orchestrator - Brunella Agent System
 * Hybrid Architecture: Edge orchestration + Local Browser-Use execution
 */

import { Ai } from "@cloudflare/ai";
import { handleBrowserTask } from "./browser.js";

// Re-export Durable Object for wrangler
export { SwarmCoordinator } from "./swarmCoordinator.js";

interface Env {
  AI: Ai;
  BAS_TASKS: KVNamespace;
  D1_METADATA: D1Database;
  R2_KNOWLEDGE: R2Bucket;
  TASK_QUEUE: Queue;
  SWARM_COORDINATOR: DurableObjectNamespace;
  BROWSER: any;
  N8N_WEBHOOK_URL: string;
  BROWSER_USE_ENDPOINT: string;
  DEFAULT_CODE_MODEL: string;
  R2_PREFIX: string;
  VECTORIZE?: VectorizeIndex;
}

interface ChatMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp: string;
  synced: number; // 0 or 1
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- NEW CHAT SYNC ENDPOINTS ---

    // GET /chat/messages - List messages for sync
    if (path === "/chat/messages" && request.method === "GET") {
      try {
        const result = await env.D1_METADATA.prepare(
          "SELECT * FROM chat_messages ORDER BY timestamp ASC LIMIT 100"
        ).all();
        return Response.json(result.results, { headers: corsHeaders });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    // POST /chat/messages - Add new message (from Mobile or PC)
    if (path === "/chat/messages" && request.method === "POST") {
      try {
        const msg = (await request.json()) as ChatMessage;
        const result = await env.D1_METADATA.prepare(
          "INSERT INTO chat_messages (role, content, model, timestamp, synced) VALUES (?, ?, ?, ?, ?)"
        ).bind(
          msg.role,
          msg.content,
          msg.model || "unknown",
          msg.timestamp || new Date().toISOString(),
          1 // Mark as synced immediately if coming via API
        ).run();
        return Response.json({ success: true, id: result.meta.last_row_id }, { headers: corsHeaders });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    // --- END NEW CHAT SYNC ENDPOINTS ---

    // (Eredeti /task, /status, /analytics végpontok megtartása...)
    // Megjegyzés: A teljes fájlt nem írom felül, hogy ne veszítsük el a többi logikát, 
    // de az implementáció során ezeket az új blokkokat illesztem be.
    
    return Response.json({ error: "Endpoint logic not fully implemented in this mock" }, { status: 404, headers: corsHeaders });
  }
};
