/**
 * Market Intelligence Agent Worker - Edge-based Price Monitoring
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
      const body = await request.json() as any;
      const { agent, task, context, requestId } = body;

      if (agent === "MarketIntelAgent") {
        return await handleMarketIntel(task, context, requestId, env, corsHeaders);
      }

      return Response.json({ error: "Agent logic not implemented in this worker" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};

async function handleMarketIntel(task: string, context: any, requestId: string, env: Env, headers: any) {
  // Edge-based implementation:
  // 1. Competitive analysis via Workers AI
  
  const analysisPrompt = `Analyze the current market trends for the following request: ${task}. 
  Provide a JSON summary with price estimates and competitor insights.`;
  
  const aiResponse = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
    prompt: analysisPrompt
  });

  const result = {
    message: "Market intelligence analysis completed on Edge",
    analysis: aiResponse.response,
    timestamp: new Date().toISOString()
  };

  return Response.json({ requestId, status: "completed", result }, { headers });
}
