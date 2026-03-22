// CEAN Router — API Gateway + Workers AI quick tasks
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

    const url = new URL(request.url);

    if (url.pathname === '/api/ai/complete' && request.method === 'POST') {
      const body = await request.json() as { prompt: string; system?: string };
      const messages: { role: string; content: string }[] = [];
      if (body.system) messages.push({ role: 'system', content: body.system });
      messages.push({ role: 'user', content: body.prompt });

      const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'cean-router' }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
};
