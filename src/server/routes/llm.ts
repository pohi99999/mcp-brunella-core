import { Router } from 'express';
import { chatWithOllama, generateResponse } from '../../core/llm_client.js';
import { logError } from '../../utils/logger.js';

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

/**
 * Unified LLM Routes (cloudflareChatProvider + LLM status)
 *
 * POST /api/llm/generate → { prompt, provider?, model? } → { text, provider, model }
 * GET  /api/llm/status   → { providers: [...] }
 */
export function createLLMRoutes(): Router {
    const router = Router();

    // GET /api/llm/status
    router.get('/status', async (_req, res) => {
        try {
            const checks = [
                { id: 'ollama', name: 'Ollama (Helyi)', provider: 'ollama' as const },
                { id: 'gemini', name: 'Google Gemini', provider: 'gemini' as const },
                { id: 'github', name: 'GitHub Models', provider: 'github' as const },
            ];

            const results = await Promise.all(checks.map(async (c) => {
                try {
                    const start = Date.now();
                    await generateResponse('hi', c.provider);
                    return { id: c.id, name: c.name, status: 'online' as const, latency: Date.now() - start };
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    return { id: c.id, name: c.name, status: 'offline' as const, error: msg };
                }
            }));

            res.json({ providers: results });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // POST /api/llm/generate
    router.post('/generate', async (req, res) => {
        try {
            const { prompt, provider = 'ollama', model } = req.body as {
                prompt?: string;
                provider?: string;
                model?: string;
            };

            if (!prompt) {
                res.status(400).json({ error: 'prompt mező kötelező' });
                return;
            }

            let text: string;
            let usedProvider = provider;
            let usedModel = model || '';

            if (provider === 'cloudflare') {
                try {
                    const cfUrl = process.env.CLOUDFLARE_WORKER_URL;
                    if (!cfUrl) throw new Error('CLOUDFLARE_WORKER_URL nincs beállítva');
                    const cfRes = await fetch(`${cfUrl}/ai/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, model: model || '@cf/meta/llama-3.1-8b-instruct' }),
                        signal: AbortSignal.timeout(30000),
                    });
                    if (!cfRes.ok) throw new Error(`CF HTTP ${cfRes.status}`);
                    const data = await cfRes.json() as { result?: { response?: string }; response?: string };
                    text = String(data?.result?.response ?? data?.response ?? '');
                    usedModel = model || '@cf/meta/llama-3.1-8b-instruct';
                } catch (cfError: unknown) {
                    const cfMsg = cfError instanceof Error ? cfError.message : String(cfError);
                    logError('LLMRoutes', `Cloudflare AI hiba, Ollama fallback: ${cfMsg}`);
                    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
                    text = await chatWithOllama(prompt, ollamaModel);
                    usedProvider = 'ollama';
                    usedModel = ollamaModel;
                }
            } else if (provider === 'gemini') {
                text = await generateResponse(prompt, 'gemini', model);
                usedModel = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
            } else if (provider === 'github') {
                text = await generateResponse(prompt, 'github', model);
                usedModel = model || 'gpt-4o';
            } else {
                const ollamaModel = model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
                text = await chatWithOllama(prompt, ollamaModel);
                usedProvider = 'ollama';
                usedModel = ollamaModel;
            }

            res.json({ text, provider: usedProvider, model: usedModel });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logError('LLMRoutes', `Generate hiba: ${msg}`);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
