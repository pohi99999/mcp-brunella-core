/**
 * CEAN Harvest Agent Worker
 * Responsible for harvesting and collecting data from various sources
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        // CORS headers
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers });
        }
        try {
            // Health check endpoint
            if (path === '/health' && request.method === 'GET') {
                return new Response(JSON.stringify({
                    status: 'healthy',
                    worker: 'harvest-agent',
                    version: '1.0.0',
                    timestamp: new Date().toISOString(),
                }), { status: 200, headers });
            }
            // List harvest tasks
            if (path === '/tasks' && request.method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM harvest_tasks ORDER BY createdAt DESC LIMIT 100').all();
                return new Response(JSON.stringify({ tasks: results, count: results.length }), {
                    status: 200,
                    headers,
                });
            }
            // Create harvest task
            if (path === '/tasks' && request.method === 'POST') {
                const body = (await request.json());
                const now = new Date().toISOString();
                const taskId = `harvest-${Date.now()}`;
                const { success } = await env.DB.prepare(`INSERT INTO harvest_tasks (id, source, target, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)`).bind(taskId, body.source, body.target, 'pending', now, now).run();
                if (!success) {
                    return new Response(JSON.stringify({ error: 'Failed to create task' }), {
                        status: 500,
                        headers,
                    });
                }
                return new Response(JSON.stringify({
                    id: taskId,
                    source: body.source,
                    target: body.target,
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                }), { status: 201, headers });
            }
            // Get specific task
            if (path.startsWith('/tasks/') && request.method === 'GET') {
                const taskId = path.split('/')[2];
                const { results } = await env.DB.prepare('SELECT * FROM harvest_tasks WHERE id = ?').bind(taskId).all();
                if (results.length === 0) {
                    return new Response(JSON.stringify({ error: 'Task not found' }), {
                        status: 404,
                        headers,
                    });
                }
                return new Response(JSON.stringify(results[0]), { status: 200, headers });
            }
            // Update task status
            if (path.startsWith('/tasks/') && request.method === 'PUT') {
                const taskId = path.split('/')[2];
                const body = (await request.json());
                const now = new Date().toISOString();
                const { success } = await env.DB.prepare('UPDATE harvest_tasks SET status = ?, updatedAt = ? WHERE id = ?').bind(body.status, now, taskId).run();
                if (!success) {
                    return new Response(JSON.stringify({ error: 'Failed to update task' }), {
                        status: 500,
                        headers,
                    });
                }
                return new Response(JSON.stringify({ id: taskId, status: body.status, updatedAt: now }), {
                    status: 200,
                    headers,
                });
            }
            // Default: Not Found
            return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
                status: 404,
                headers,
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Harvest Worker Error:', errorMsg);
            return new Response(JSON.stringify({ error: 'Internal server error', details: errorMsg }), { status: 500, headers });
        }
    },
    async scheduled(event, env, ctx) {
        /**
         * Harvest scheduled job - runs every 6 hours
         * Collects pending harvest tasks and processes them
         */
        console.log('Harvest scheduled job triggered at:', new Date().toISOString());
        try {
            // Get pending tasks
            const { results } = await env.DB.prepare("SELECT * FROM harvest_tasks WHERE status = 'pending' LIMIT 50").all();
            console.log(`Processing ${results.length} pending harvest tasks`);
            // Mark as processing
            for (const task of results) {
                await env.DB.prepare("UPDATE harvest_tasks SET status = 'processing', updatedAt = ? WHERE id = ?").bind(new Date().toISOString(), task.id).run();
            }
            // Simulate harvest processing
            await new Promise((resolve) => setTimeout(resolve, 2000));
            // Mark as completed
            for (const task of results) {
                await env.DB.prepare("UPDATE harvest_tasks SET status = 'completed', updatedAt = ? WHERE id = ?").bind(new Date().toISOString(), task.id).run();
            }
            console.log(`Completed ${results.length} harvest tasks`);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Harvest scheduled job error:', errorMsg);
        }
    },
};
//# sourceMappingURL=index.js.map