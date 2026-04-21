/**
 * Dev Agent Worker - Edge-based Code Generation & Evaluation
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: any;
  BAS_API_KEY: string;
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

    const basKeyHeader = request.headers.get("X-BAS-API-Key");
    if (env.BAS_API_KEY && basKeyHeader !== env.BAS_API_KEY) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    try {
      const { agent, task, context, requestId } = await request.json() as any;

      if (["DeveloperAgent", "EvaluatorAgent"].includes(agent)) {
        // Dev logic: Code generation/review via AI
        const prompt = `You are the ${agent}. Task: ${task}.
        Generate high-quality code or perform a thorough code review.`;
        
        const aiResponse = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          prompt
        });

        return Response.json({
          requestId,
          agent,
          status: "completed",
          result: { code: aiResponse.response, timestamp: new Date().toISOString() }
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Agent not handled" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
