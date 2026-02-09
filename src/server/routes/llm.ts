import { Router } from 'express';
import { chatWithOllama, generateResponse } from '../../core/llm_client.js';

export function createProvidersRoutes(): Router {
    const router = Router();

    router.get('/status', async (req, res) => {
        try {
            const checks = [
                { id: 'ollama', name: 'Ollama (Helyi)', test: () => generateResponse('hi', 'ollama') },
                { id: 'gemini', name: 'Google Gemini', test: () => generateResponse('hi', 'gemini') },
                { id: 'github', name: 'GitHub Models', test: () => generateResponse('hi', 'github') }
            ];

            const results = await Promise.all(checks.map(async (c) => {
                try {
                    const start = Date.now();
                    await c.test();
                    return { id: c.id, name: c.name, status: 'online', latency: Date.now() - start };
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    return { id: c.id, name: c.name, status: 'offline', error: msg };
                }
            }));

            res.json({ providers: results });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createOllamaRoutes(): Router {
    const router = Router();

    /**
     * @swagger
     * /api/ollama/models:
     *   get:
     *     summary: List Ollama Models
     *     description: Fetches available models from the configured Ollama instance.
     *     responses:
     *       200:
     *         description: List of models
     */
    router.get('/models', async (req, res) => {
        try {
            const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
            const response = await fetch(`${baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json() as { models?: unknown[] };
            res.json({ models: data.models || [] });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, models: [] });
        }
    });

    router.post('/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || process.env.OLLAMA_MODEL || 'gemma2:9b';
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await chatWithOllama(fullPrompt, selectedModel);
            res.json({ response });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createGeminiRoutes(): Router {
    const router = Router();

    router.get('/models', (req, res) => {
        try {
            const envList = process.env.GEMINI_MODELS;
            const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const models = (envList ? envList.split(',') : [defaultModel])
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name, provider: 'gemini', tier: 'configured' }));
            res.json({ models });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, models: [] });
        }
    });

    /**
     * @swagger
     * /api/gemini/generate:
     *   post:
     *     summary: Generate with Gemini
     *     description: Generates text using Google Gemini models.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               prompt:
     *                 type: string
     *               model:
     *                 type: string
     *               system:
     *                 type: string
     *     responses:
     *       200:
     *         description: Generated response
     */
    router.post('/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await generateResponse(fullPrompt, 'gemini', selectedModel);
            res.json({ response });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createGithubModelsRoutes(): Router {
    const router = Router();

    router.get('/models', (req, res) => {
        try {
            const envList = process.env.GITHUB_MODELS;
            const defaultModel = process.env.GITHUB_MODEL || 'gpt-4o';
            const models = (envList ? envList.split(',') : [defaultModel])
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name, provider: 'github' }));
            res.json({ models });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, models: [] });
        }
    });

    /**
     * @swagger
     * /api/github-models/generate:
     *   post:
     *     summary: Generate with GitHub Models
     *     description: Generates text using GitHub Models (GPT-4o via Azure).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               prompt:
     *                 type: string
     *               model:
     *                 type: string
     *               system:
     *                 type: string
     *     responses:
     *       200:
     *         description: Generated response
     */
    router.post('/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || 'gpt-4o';
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await generateResponse(fullPrompt, 'github', selectedModel);
            res.json({ response });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
