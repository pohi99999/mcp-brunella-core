/**
 * Lead Agent Worker - Edge-based Lead Mining & Sales Hunter
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: any;
  BAS_API_KEY: string;
  GEMINI_API_KEY: string;
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

      if (agent === "LeadMiningAgent") {
        return await handleLeadMining(task, context, requestId, env, corsHeaders);
      } else if (agent === "SalesHunterAgent") {
        return await handleSalesHunter(task, context, requestId, env, corsHeaders);
      }

      return Response.json({ error: "Agent logic not implemented in this worker" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};

async function handleLeadMining(task: string, context: any, requestId: string, env: Env, headers: any) {
  // Edge-based implementation:
  // 1. In production, this would call a search API or Browser Rendering
  // 2. Use Workers AI for icebreaker generation
  
  const icebreakerPrompt = `Generate a creative B2B icebreaker for: ${task}`;
  const aiResponse = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
    prompt: icebreakerPrompt
  });

  const result = {
    message: "Lead mining simulated on Edge",
    leads: [
      { name: "Sample Business", website: "https://example.com", icebreaker: aiResponse.response }
    ]
  };

  return Response.json({ requestId, status: "completed", result }, { headers });
}

async function handleSalesHunter(task: string, context: any, requestId: string, env: Env, headers: any) {
  // Sales Hunter logic
  const result = {
    message: "Sales hunter simulated on Edge",
    stats: { leadsFound: 5, emailsGenerated: 5 }
  };
  return Response.json({ requestId, status: "completed", result }, { headers });
}
