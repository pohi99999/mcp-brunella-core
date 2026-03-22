// CEAN Refine — DataScientistAgent edge fallback
export interface Env {
  AI: Ai;
  CEAN_API_KEY: string;
  D1: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apiKey = request.headers.get('x-cean-api-key');
    if (apiKey !== env.CEAN_API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const body = await request.json() as { data: unknown; task: string };

    const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a data scientist. Analyze data, identify patterns, clean inconsistencies, and provide actionable insights.' },
        { role: 'user', content: `Task: ${body.task}\n\nData: ${JSON.stringify(body.data).slice(0, 3000)}` }
      ]
    });

    return new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json' } });
  }
};
