/**
 * Finance Agent Worker - Edge-based Invoice Processing & Anomaly Detection
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

      if (["FinanceGuardian", "FinancialGuardAgent"].includes(agent)) {
        // Finance logic: Analysis via AI
        const prompt = `You are the ${agent}. Process the following financial request: ${task}.
        Check for anomalies or extract key invoice data.`;
        
        const aiResponse = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
          prompt
        });

        return Response.json({
          requestId,
          agent,
          status: "completed",
          result: { analysis: aiResponse.response, timestamp: new Date().toISOString() }
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Agent not handled" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
