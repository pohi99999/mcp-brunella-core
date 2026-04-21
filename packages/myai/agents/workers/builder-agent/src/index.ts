import type { D1Database } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            worker: 'builder-agent',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers }
        );
      }

      if (url.pathname === '/build' && request.method === 'POST') {
        const body = (await request.json()) as Record<string, unknown>;
        const buildId = `build-${Date.now()}`;
        const now = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO build_tasks (id, project, config, status, createdAt) VALUES (?, ?, ?, ?, ?)'
        ).bind(buildId, body.project, JSON.stringify(body.config), 'pending', now).run();

        return new Response(
          JSON.stringify({ id: buildId, status: 'pending', createdAt: now }),
          { status: 201, headers }
        );
      }

      if (url.pathname === '/builds' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM build_tasks ORDER BY createdAt DESC LIMIT 50'
        ).all() as { results: unknown[] };

        return new Response(JSON.stringify({ builds: results }), { status: 200, headers });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
    }
  },
};
