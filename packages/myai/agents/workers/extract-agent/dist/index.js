export default {
    async fetch(request, env) {
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
                return new Response(JSON.stringify({
                    status: 'healthy',
                    worker: 'extract-agent',
                    version: '1.0.0',
                    timestamp: new Date().toISOString(),
                }), { status: 200, headers });
            }
            if (url.pathname === '/extract' && request.method === 'POST') {
                const body = (await request.json());
                const extractId = `extract-${Date.now()}`;
                const now = new Date().toISOString();
                await env.DB.prepare('INSERT INTO extraction_tasks (id, source, rules, status, createdAt) VALUES (?, ?, ?, ?, ?)').bind(extractId, JSON.stringify(body.source), JSON.stringify(body.rules), 'pending', now).run();
                return new Response(JSON.stringify({ id: extractId, status: 'pending', createdAt: now }), { status: 201, headers });
            }
            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
        }
    },
};
//# sourceMappingURL=index.js.map