import { Router } from 'express';
import { chatWithOllama, generateResponse, resolveOllamaFallbackModel } from '@packages/core-logic/llm_client.js';
import { sendAnthropicMessage } from '@packages/core-logic/anthropicClient.js';
import { getBifrostGateway } from '@packages/core-logic/bifrost_gateway.js';
import { logDebug, logError } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';

interface CatalogModel {
    id: string;
    name: string;
    provider: string;
    source: 'runtime' | 'env' | 'default';
}

interface CatalogProvider {
    id: string;
    label: string;
    enabled: boolean;
    defaultModel: string;
    models: CatalogModel[];
}

interface RuntimeModelListResult {
    models: string[];
    error?: string;
}

interface AnythingLLMWorkspaceSummary {
    id: string;
    name: string;
    slug: string;
}

interface AnythingLLMWorkspaceResult {
    workspaces: AnythingLLMWorkspaceSummary[];
    error?: string;
}

type GenerateProvider = 'ollama' | 'cloudflare' | 'gemini' | 'github' | 'anthropic';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function readGenerateProvider(value: unknown): GenerateProvider | null {
    const provider = readString(value) ?? 'ollama';
    if (
        provider === 'ollama' ||
        provider === 'cloudflare' ||
        provider === 'gemini' ||
        provider === 'github' ||
        provider === 'anthropic'
    ) {
        return provider;
    }
    return null;
}

function parseModelEnvList(envValue: string | undefined, fallback: string[]): string[] {
    const models = (envValue ? envValue.split(',') : fallback)
        .map((name) => name.trim())
        .filter(Boolean);
    return Array.from(new Set(models));
}

function getGithubTokenEnvName(): string | null {
    if (process.env.GH_TOKEN) return 'GH_TOKEN';
    if (process.env.GITHUB_TOKEN) return 'GITHUB_TOKEN';
    if (process.env.GITHUB_PAT) return 'GITHUB_PAT';
    return null;
}

function getGithubDefaultModel(): string {
    return process.env.GITHUB_MODELS_DEFAULT_MODEL || process.env.GITHUB_MODEL || 'gpt-4.1';
}

function getAnythingLLMWorkspaceSlug(): string {
    return process.env.ANYTHINGLLM_WORKSPACE || process.env.ANYTHINGLLM_WORKSPACE_SLUG || 'brunella_main';
}

function normalizeWorkspace(value: unknown): AnythingLLMWorkspaceSummary | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    const slug = typeof record.slug === 'string' ? record.slug : '';
    if (!slug) return null;
    return {
        id: typeof record.id === 'string' ? record.id : slug,
        name: typeof record.name === 'string' ? record.name : slug,
        slug,
    };
}

async function listOllamaModelNames(baseUrl: string): Promise<RuntimeModelListResult> {
    try {
        const response = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return { models: [], error: `Ollama API error: ${response.status} ${response.statusText}` };
        }
        const data = await response.json() as { models?: Array<{ name?: string }> };
        const models = (data.models || [])
            .map((model) => String(model.name || '').trim())
            .filter(Boolean);
        return { models: Array.from(new Set(models)) };
    } catch (error: unknown) {
        return { models: [], error: ensureError(error).message };
    }
}

async function listAnythingLLMWorkspaces(baseUrl: string, apiKey: string | undefined): Promise<AnythingLLMWorkspaceResult> {
    if (!apiKey) {
        return { workspaces: [], error: 'ANYTHINGLLM_API_KEY not configured' };
    }
    try {
        const response = await fetch(`${baseUrl}/api/v1/workspaces`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return { workspaces: [], error: `AnythingLLM API error: ${response.status} ${response.statusText}` };
        }
        const data = await response.json() as { workspaces?: unknown[] };
        const workspaces = (data.workspaces || [])
            .map(normalizeWorkspace)
            .filter((workspace): workspace is AnythingLLMWorkspaceSummary => workspace !== null);
        return { workspaces };
    } catch (error: unknown) {
        return { workspaces: [], error: ensureError(error).message };
    }
}

async function buildOrchestrationReadiness() {
    const githubModel = getGithubDefaultModel();
    const githubTokenEnv = getGithubTokenEnvName();
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const ollamaFallbackModel = resolveOllamaFallbackModel();
    const anythingBaseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
    const anythingWorkspaceSlug = getAnythingLLMWorkspaceSlug();

    const [ollamaRuntime, anythingRuntime] = await Promise.all([
        listOllamaModelNames(ollamaBaseUrl),
        listAnythingLLMWorkspaces(anythingBaseUrl, process.env.ANYTHINGLLM_API_KEY),
    ]);

    const fallbackModelAvailable = ollamaRuntime.models.includes(ollamaFallbackModel);
    const workspace = anythingRuntime.workspaces.find((item) => item.slug === anythingWorkspaceSlug) || null;

    const primaryBlockers = githubTokenEnv ? [] : ['GitHub Models token not configured'];
    const fallbackBlockers = [
        ...(ollamaRuntime.error ? [`Ollama runtime unavailable: ${ollamaRuntime.error}`] : []),
        ...(!fallbackModelAvailable ? [`Ollama fallback model not found: ${ollamaFallbackModel}`] : []),
    ];
    const anythingBlockers = [
        ...(anythingRuntime.error ? [anythingRuntime.error] : []),
        ...(!workspace ? [`AnythingLLM workspace not found: ${anythingWorkspaceSlug}`] : []),
    ];
    const blockers = [...primaryBlockers, ...fallbackBlockers, ...anythingBlockers];
    const fallbackReady = fallbackBlockers.length === 0;
    const fullyReady = blockers.length === 0;

    return {
        summary: {
            status: fullyReady ? 'ready' : fallbackReady ? 'partial' : 'blocked',
            blockers,
        },
        primary: {
            provider: 'github',
            label: 'GitHub Models',
            model: githubModel,
            apiModel: githubModel.includes('/') ? githubModel : `openai/${githubModel}`,
            configured: githubTokenEnv !== null,
            tokenEnv: githubTokenEnv,
            blockers: primaryBlockers,
        },
        fallback: {
            provider: 'ollama',
            label: 'Ollama Local',
            baseUrl: ollamaBaseUrl,
            model: ollamaFallbackModel,
            configured: fallbackReady,
            availableModels: ollamaRuntime.models,
            runtimeError: ollamaRuntime.error,
            blockers: fallbackBlockers,
        },
        anythingllm: {
            baseUrl: anythingBaseUrl,
            apiKeyConfigured: Boolean(process.env.ANYTHINGLLM_API_KEY),
            workspace: {
                slug: anythingWorkspaceSlug,
                available: workspace !== null,
                matched: workspace,
            },
            workspaces: anythingRuntime.workspaces,
            runtimeError: anythingRuntime.error,
            blockers: anythingBlockers,
        },
    };
}

async function buildModelCatalog(): Promise<CatalogProvider[]> {
    const enabledProviders = new Set(getBifrostGateway().getEnabledProviders());

    const githubDefaultModel = process.env.GITHUB_MODELS_DEFAULT_MODEL || process.env.GITHUB_MODEL || 'gpt-4.1';
    const geminiDefaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const anthropicDefaultModel = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    const cloudflareDefaultModel = process.env.CF_AI_SMART_MODEL || '@cf/meta/llama-3.3-70b-instruct';
    const ollamaDefaultModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

    let ollamaModels: CatalogModel[] = [];
    try {
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        const response = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const data = await response.json() as { models?: Array<{ name?: string }> };
            ollamaModels = (data.models || [])
                .map((model) => String(model.name || '').trim())
                .filter(Boolean)
                .map((name) => ({ id: name, name, provider: 'ollama', source: 'runtime' as const }));
        }
    } catch (error: unknown) {
        logDebug('LLMRoutes', `Runtime Ollama catalog fetch skipped: ${ensureError(error).message}`);
    }

    if (ollamaModels.length === 0) {
        ollamaModels = parseModelEnvList(process.env.OLLAMA_MODELS, [ollamaDefaultModel]).map((name) => ({
            id: name,
            name,
            provider: 'ollama',
            source: name === ollamaDefaultModel ? 'default' as const : 'env' as const,
        }));
    }

    const catalog: CatalogProvider[] = [
        {
            id: 'github',
            label: 'GitHub Models',
            enabled: enabledProviders.has('github'),
            defaultModel: githubDefaultModel,
            models: parseModelEnvList(process.env.GITHUB_MODELS, [githubDefaultModel]).map((name) => ({
                id: name,
                name,
                provider: 'github',
                source: name === githubDefaultModel ? 'default' as const : 'env' as const,
            })),
        },
        {
            id: 'gemini',
            label: 'Google Gemini',
            enabled: enabledProviders.has('gemini'),
            defaultModel: geminiDefaultModel,
            models: parseModelEnvList(process.env.GEMINI_MODELS, [geminiDefaultModel]).map((name) => ({
                id: name,
                name,
                provider: 'gemini',
                source: name === geminiDefaultModel ? 'default' as const : 'env' as const,
            })),
        },
        {
            id: 'anthropic',
            label: 'Anthropic Claude',
            enabled: enabledProviders.has('anthropic'),
            defaultModel: anthropicDefaultModel,
            models: parseModelEnvList(process.env.ANTHROPIC_MODELS || process.env.CLAUDE_MODELS, [anthropicDefaultModel]).map((name) => ({
                id: name,
                name,
                provider: 'anthropic',
                source: name === anthropicDefaultModel ? 'default' as const : 'env' as const,
            })),
        },
        {
            id: 'cloudflare',
            label: 'Cloudflare AI',
            enabled: enabledProviders.has('cloudflare'),
            defaultModel: cloudflareDefaultModel,
            models: parseModelEnvList(process.env.CF_AI_MODELS, [cloudflareDefaultModel]).map((name) => ({
                id: name,
                name,
                provider: 'cloudflare',
                source: name === cloudflareDefaultModel ? 'default' as const : 'env' as const,
            })),
        },
        {
            id: 'ollama',
            label: 'Ollama Local',
            enabled: true,
            defaultModel: ollamaDefaultModel,
            models: ollamaModels,
        },
    ];

    return catalog;
}

export function createProvidersRoutes(): Router {
    const router = Router();

    router.get('/config', (_req, res) => {
        const enabledProviders = getBifrostGateway().getEnabledProviders();
        const cloudProviders = ['github', 'gemini', 'anthropic', 'cloudflare'];

        res.json({
            enabledProviders,
            hasLocal: enabledProviders.includes('ollama'),
            hasCloudFallback: enabledProviders.some((provider) => cloudProviders.includes(provider)),
            githubConfigured: enabledProviders.includes('github'),
            cloudflareConfigured: enabledProviders.includes('cloudflare'),
            defaultModels: {
                github: process.env.GITHUB_MODELS_DEFAULT_MODEL || process.env.GITHUB_MODEL || 'gpt-4.1',
                ollama: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
            },
        });
    });

    router.get('/status', async (req, res) => {
        try {
            const anthropicDefaultModel = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
            const checks = [
                { id: 'ollama', name: 'Ollama (Helyi)', test: () => generateResponse('hi', 'ollama') },
                { id: 'gemini', name: 'Google Gemini', test: () => generateResponse('hi', 'gemini') },
                { id: 'github', name: 'GitHub Models', test: () => generateResponse('hi', 'github') },
                { id: 'anthropic', name: 'Anthropic Claude', test: () => sendAnthropicMessage([{ role: 'user', content: 'hi' }], anthropicDefaultModel) }
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
            const defaultModel = getGithubDefaultModel();
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

            const selectedModel = model || 'gpt-4.1';
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

    router.get('/catalog', async (_req, res) => {
        try {
            const providers = await buildModelCatalog();
            res.json({ providers });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, providers: [] });
        }
    });

    router.get('/orchestration-readiness', async (_req, res) => {
        try {
            const readiness = await buildOrchestrationReadiness();
            res.json(readiness);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    // GET /api/llm/status
    router.get('/status', async (_req, res) => {
        try {
            const checks = [
                { id: 'ollama', name: 'Ollama (Helyi)', provider: 'ollama' as const },
                { id: 'gemini', name: 'Google Gemini', provider: 'gemini' as const },
                { id: 'github', name: 'GitHub Models', provider: 'github' as const },
                { id: 'anthropic', name: 'Anthropic Claude', provider: 'anthropic' as const },
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
            const body = isRecord(req.body) ? req.body : {};
            const prompt = readString(body.prompt);
            const provider = readGenerateProvider(body.provider);
            const model = readString(body.model) ?? undefined;
            const userId = readString(body.userId) ?? undefined;

            if (!prompt) {
                res.status(400).json({ error: 'prompt mező kötelező' });
                return;
            }

            if (!provider) {
                res.status(400).json({ error: 'unsupported provider' });
                return;
            }

            let text: string;
            let usedProvider = provider;
            let usedModel = model || '';

            if (provider === 'cloudflare') {
                try {
                    const cfToken = process.env.CF_BAS_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
                    const cfUrl = process.env.CLOUDFLARE_D1_WORKER_URL || process.env.CLOUDFLARE_WORKER_URL;
                    if (!cfUrl) throw new Error('CLOUDFLARE_WORKER_URL nincs beállítva');
                    const ceanApiKey = process.env.CEAN_API_KEY;
                    const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                    };
                    if (cfToken) {
                        headers.Authorization = `Bearer ${cfToken}`;
                        headers['X-BAS-API-Key'] = cfToken;
                    }
                    if (ceanApiKey) {
                        headers['X-CEAN-API-Key'] = ceanApiKey;
                    }

                    const cfRes = await fetch(`${cfUrl}/ai/generate`, {
                        method: 'POST',
                        headers,
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
                usedModel = model || 'gpt-4.1';
            } else if (provider === 'anthropic') {
                const bifrost = getBifrostGateway();
                const response = await bifrost.generate({
                    prompt,
                    provider: 'anthropic',
                    model,
                    taskType: 'general',
                    userId,
                });
                if (!response.success) {
                    throw new Error(response.error || 'Anthropic hívás sikertelen');
                }
                text = response.content || '';
                usedModel = response.model;
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
