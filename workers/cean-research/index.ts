// CEAN Research — ResearcherAgent edge fallback
export interface Env {
  AI: Ai;
  CEAN_API_KEY: string;
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

    const body = await request.json() as { task: string; context?: string };

    const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a research agent. Analyze the given task and provide detailed findings, sources, and recommendations.' },
        { role: 'user', content: body.context ? `Context: ${body.context}\n\nTask: ${body.task}` : body.task }
      ]
    });

    return new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json' } });
  }
};
