import { Router } from 'express';

export function createIncubatorRoutes(): Router {
    const router = Router();

    router.post('/gold-sample', async (req, res) => {
        try {
            const pythonBaseUrl = process.env.PYTHON_SUBSET_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${pythonBaseUrl}/incubator/gold-sample`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            const data = await response.json();
            res.status(response.status).json(data);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/stats', async (req, res) => {
        try {
            const pythonBaseUrl = process.env.PYTHON_SUBSET_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${pythonBaseUrl}/incubator/stats`);
            const data = await response.json();
            res.status(response.status).json(data);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createN8nRoutes(): Router {
    const router = Router();

    router.get('/workflows', async (req, res) => {
        try {
            const baseUrl = process.env.N8N_BASE_URL || 'https://n8n-latest-fulv.onrender.com';
            const apiKey = process.env.N8N_API_KEY;
            const response = await fetch(`${baseUrl}/api/v1/workflows`, {
                headers: apiKey ? { 'X-N8N-API-KEY': apiKey } : undefined,
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`n8n API error: ${response.statusText}`);
            }

            const data = await response.json();
            res.json(data);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
