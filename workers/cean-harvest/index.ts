// CEAN Harvest — Scheduled data harvest worker
export interface Env {
  AI: Ai;
  D1: D1Database;
  CEAN_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'cean-harvest' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('cean-harvest worker', { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Harvest runs every 6 hours via Cron Trigger
    const sources = ['https://github.com/trending', 'https://news.ycombinator.com/best'];

    for (const source of sources) {
      try {
        const resp = await fetch(source);
        const html = await resp.text();

        // Use AI to summarize
        const summary = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: 'Summarize the key tech trends from this content in 3 bullet points.' },
            { role: 'user', content: html.slice(0, 4000) }
          ]
        });

        // Store in D1
        await env.D1.prepare(
          'INSERT INTO harvest_results (ts, source, summary) VALUES (?, ?, ?)'
        ).bind(Date.now(), source, JSON.stringify(summary)).run();
      } catch (e) {
        console.error(`Harvest failed for ${source}:`, e);
      }
    }
  }
};
