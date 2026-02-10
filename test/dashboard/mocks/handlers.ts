import { http, HttpResponse } from 'msw';

/** MSW handlers for dashboard API mocking */
export const handlers = [
    // Health check
    http.get('/api/health', () => {
        return HttpResponse.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            requestId: 'test-req-001',
            services: {
                ollama: { status: 'healthy', latencyMs: 10 },
                anythingllm: { status: 'healthy', latencyMs: 15 },
                agents: { status: 'healthy' },
                mcp: { status: 'no_servers' },
            },
        });
    }),

    // Agents list
    http.get('/api/agents', () => {
        return HttpResponse.json({
            agents: [
                { name: 'Developer', description: 'Code generation agent', role: 'developer' },
                { name: 'Researcher', description: 'Research agent', role: 'researcher' },
                { name: 'Orchestrator', description: 'Central planner', role: 'planner' },
            ],
        });
    }),

    // Agent status
    http.get('/api/agents/status', () => {
        return HttpResponse.json({
            agents: [
                { name: 'Developer', status: 'idle', lastActivity: new Date().toISOString() },
                { name: 'Researcher', status: 'idle', lastActivity: new Date().toISOString() },
                { name: 'Orchestrator', status: 'idle', lastActivity: new Date().toISOString() },
            ],
        });
    }),

    // Registry
    http.get('/api/registry', () => {
        return HttpResponse.json({
            agents: [
                { name: 'Developer', role: 'developer', capabilities: ['code', 'test'], status: 'idle' },
                { name: 'Researcher', role: 'researcher', capabilities: ['search'], status: 'idle' },
            ],
        });
    }),

    // Tools list
    http.get('/api/tools', () => {
        return HttpResponse.json({
            tools: [
                { name: 'read_file', description: 'Read file content', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
                { name: 'write_file', description: 'Write file content', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
            ],
        });
    }),

    // Tasks
    http.get('/api/tasks', () => {
        return HttpResponse.json({ tasks: [], total: 0 });
    }),

    http.get('/api/tasks/stats', () => {
        return HttpResponse.json({ pending: 0, running: 0, completed: 0, failed: 0, total: 0 });
    }),

    // Providers
    http.get('/api/providers/status', () => {
        return HttpResponse.json({
            providers: [
                { name: 'ollama', status: 'online', models: ['llama3.1:8b'] },
                { name: 'github', status: 'configured' },
            ],
        });
    }),

    // Files
    http.get('/api/files/list', () => {
        return HttpResponse.json({
            files: [
                { name: 'src', type: 'directory', size: 0 },
                { name: 'package.json', type: 'file', size: 4096 },
                { name: 'README.md', type: 'file', size: 8192 },
            ],
        });
    }),

    // RAG / Knowledge
    http.get('/rag/stats', () => {
        return HttpResponse.json({ table: 'memory', provider: 'LanceDB', status: 'online', rowCount: 42 });
    }),

    // Incubator
    http.get('/api/incubator/stats', () => {
        return HttpResponse.json({ total_samples: 10, avg_quality: 0.85 });
    }),

    // Developer endpoints
    http.get('/api/v1/developer/status', () => {
        return HttpResponse.json({ version: '3.0.5', status: 'ready' });
    }),

    http.get('/api/v1/developer/history', () => {
        return HttpResponse.json({ pipelines: [] });
    }),

    http.get('/api/v1/developer/queue', () => {
        return HttpResponse.json({ tasks: [], stats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0 } });
    }),

    http.get('/api/v1/developer/metrics', () => {
        return HttpResponse.json({ builds: { total: 5, success: 4 }, tests: { total: 10, passed: 9 }, tasks: [] });
    }),

    http.get('/api/v1/developer/approval', () => {
        return HttpResponse.json([]);
    }),

    http.get('/api/v1/developer/feed', () => {
        return HttpResponse.json([]);
    }),

    // System
    http.get('/api/system/status', () => {
        return HttpResponse.json({
            services: [
                { name: 'ollama', status: 'running' },
                { name: 'anythingllm', status: 'running' },
                { name: 'python', status: 'stopped' },
            ],
        });
    }),

    // Ollama models
    http.get('/api/ollama/models', () => {
        return HttpResponse.json({ models: [{ name: 'llama3.1:8b' }, { name: 'nomic-embed-text' }] });
    }),

    // Agent execute
    http.post('/api/agents/:name/execute', () => {
        return HttpResponse.json({ status: 'success', result: 'Task completed successfully.' });
    }),

    // N8n workflows
    http.get('/api/n8n/workflows', () => {
        return HttpResponse.json({ workflows: [] });
    }),
];
