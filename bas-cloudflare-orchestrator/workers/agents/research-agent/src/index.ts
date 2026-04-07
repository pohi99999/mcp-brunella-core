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

import { parseAiResponse } from '../../../../src/utils/aiHelpers.js';

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
      const bodyRaw = await request.json().catch(() => ({}));
      const body = typeof bodyRaw === 'object' && bodyRaw !== null ? (bodyRaw as Record<string, unknown>) : {};
      const agent = typeof body.agent === 'string' ? body.agent : '';
      const task = typeof body.task === 'string' ? body.task : String(body.task ?? '');
      const requestId = typeof body.requestId === 'string' ? body.requestId : String(body.requestId ?? '');

      if (["ResearcherAgent", "DataScientistAgent"].includes(agent)) {
        // Research logic: Vector search + AI summary
        const embedModel = "@cf/baai/bge-small-en-v1.5";
        const queryVectorRaw = await env.AI.run(embedModel as any, { text: [task] });
        const vector = queryVectorRaw && typeof queryVectorRaw === 'object' && Array.isArray((queryVectorRaw as any).data) ? (queryVectorRaw as any).data[0] : null;
        const matches = vector ? await env.VECTORIZE_MEMORY.query(vector, { topK: 3 }) : [];

        const prompt = `You are the ${agent}. Task: ${task}. Found relevant context: ${JSON.stringify(matches)}. Provide a comprehensive research summary.`;

        const llmModel = "@cf/meta/llama-3.1-8b-instruct";
        const aiRaw = await env.AI.run(llmModel as any, { prompt });
        const { text: analysis } = parseAiResponse(aiRaw);

        return Response.json({
          requestId,
          agent,
          status: "completed",
          result: { analysis, sources: matches, timestamp: new Date().toISOString() }
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Agent not handled" }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  }
};
