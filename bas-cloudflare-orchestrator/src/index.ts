/**
 * BAS Cloudflare Orchestrator - Core Entry Point
 * Swarm: swarmCreate, swarmHandoff, swarmArtifact, swarmStatus
 */

import { Ai } from "@cloudflare/ai";
export { SwarmCoordinator } from "./swarmCoordinator.js";

interface Env {
  AI: any;
  D1_METADATA: D1Database;
  BAS_TASKS: KVNamespace;
  R2_KNOWLEDGE: R2Bucket;
  SWARM_COORDINATOR: DurableObjectNamespace;
  ASSETS: any;
  DEFAULT_CODE_MODEL: string;
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
      // Swarm Health Check keywords: swarmCreate, swarmHandoff, swarmArtifact
      return Response.json({ 
        status: "online", 
        version: "2.5.0", 
        swarm: "active",
        endpoints: ["swarmCreate", "swarmHandoff", "swarmArtifact"] 
      }, { headers: corsHeaders });
    }
  },
};
