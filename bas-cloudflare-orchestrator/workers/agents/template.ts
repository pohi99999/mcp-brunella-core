/**
 * BAS Agent Worker Template
 * Ported from local IAgent implementations
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: any;
  BAS_API_KEY: string;
  GEMINI_API_KEY?: string;
  GITHUB_PAT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-BAS-API-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Auth check
    const basKeyHeader = request.headers.get("X-BAS-API-Key");
    if (env.BAS_API_KEY && basKeyHeader !== env.BAS_API_KEY) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const { agent, task, context, requestId } = await request.json() as any;

      if (!agent || !task) {
        return Response.json({ error: "agent and task required" }, { status: 400, headers: corsHeaders });
      }

      // --- AGENT LOGIC GOES HERE ---
      // In a real implementation, you would import the specific agent class
      // For the template, we return a mock success
      
      const result = {
        message: `Task processed by ${agent} on Edge`,
        task,
        data: {
          timestamp: new Date().toISOString(),
          status: "success"
        }
      };

      return Response.json({
        requestId,
        agent,
        status: "completed",
        result
      }, { headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
