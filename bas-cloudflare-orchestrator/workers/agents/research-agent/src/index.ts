/**
 * Research Agent Worker - Edge-based RAG & Data Science
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: any;
  VECTORIZE_MEMORY: VectorizeIndex;
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

      if (["ResearcherAgent", "DataScientistAgent"].includes(agent)) {
        // Research logic: Vector search + AI summary
        const queryVector = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [task] });
        const matches = await env.VECTORIZE_MEMORY.query(queryVector.data[0], { topK: 3 });

        const prompt = `You are the ${agent}. Task: ${task}.
        Found relevant context: ${JSON.stringify(matches)}.
        Provide a comprehensive research summary.`;
        
        const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          prompt
        });

        return Response.json({
          requestId,
          agent,
          status: "completed",
          result: { analysis: aiResponse.response, sources: matches, timestamp: new Date().toISOString() }
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Agent not handled" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
