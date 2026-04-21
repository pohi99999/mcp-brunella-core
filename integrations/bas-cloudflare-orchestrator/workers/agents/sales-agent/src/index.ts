/**
 * Sales Agent Worker - Edge-based Outreach, Copywriting & Nurturing
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

      if (["SalesAgent", "NurturerAgent", "CopywriterAgent"].includes(agent)) {
        return await handleSalesOutreach(agent, task, context, requestId, env, corsHeaders);
      }

      return Response.json({ error: "Agent logic not implemented in this worker" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};

async function handleSalesOutreach(agent: string, task: string, context: any, requestId: string, env: Env, headers: any) {
  const prompt = `You are the ${agent}. Your task is: ${task}.
  Generate a professional B2B response or content based on this request.`;
  
  const aiResponse = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
    prompt
  });

  const result = {
    agent,
    message: "Outreach content generated on Edge",
    content: aiResponse.response,
    timestamp: new Date().toISOString()
  };

  return Response.json({ requestId, status: "completed", result }, { headers });
}
