import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatWithOllama, generateResponse } from '@packages/core-logic/llm_client.js';

vi.mock('@packages/core-logic/llm_client.js', () => ({
  chatWithOllama: vi.fn(),
  generateResponse: vi.fn(),
  resolveOllamaFallbackModel: () => process.env.OLLAMA_FALLBACK_MODEL || process.env.OLLAMA_MODEL || 'gemma4:latest',
}));

vi.mock('@packages/core-logic/anthropicClient.js', () => ({
  sendAnthropicMessage: vi.fn(),
}));

vi.mock('@packages/core-logic/bifrost_gateway.js', () => ({
  getBifrostGateway: () => ({
    getEnabledProviders: () => ['github', 'ollama'],
  }),
}));

const fetchMock = vi.fn();

async function buildApp() {
  const { createLLMRoutes } = await import('@apps/mcp-core/server/routes/llm.js');
  const app = express();
  app.use(express.json());
  app.use('/llm', createLLMRoutes());
  return app;
}

describe('LLM routes orchestration readiness', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_MODELS_DEFAULT_MODEL = 'gpt-4.1';
    process.env.OLLAMA_BASE_URL = 'http://ollama.local';
    process.env.OLLAMA_FALLBACK_MODEL = 'gemma4:latest';
    process.env.ANYTHINGLLM_BASE_URL = 'http://anything.local';
    process.env.ANYTHINGLLM_API_KEY = 'anything-token';
    process.env.ANYTHINGLLM_WORKSPACE = 'brunella_main';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('reports ready when GitHub token, Ollama fallback model, and brunella_main workspace are available', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'http://ollama.local/api/tags') {
        return {
          ok: true,
          json: async () => ({ models: [{ name: 'gemma4:latest' }, { name: 'qwen2.5-coder:7b' }] }),
        };
      }
      if (url === 'http://anything.local/api/v1/workspaces') {
        return {
          ok: true,
          json: async () => ({ workspaces: [{ id: 'ws-1', name: 'Brunella Main', slug: 'brunella_main' }] }),
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const app = await buildApp();
    const response = await request(app).get('/llm/orchestration-readiness');

    expect(response.status).toBe(200);
    expect(response.body.summary.status).toBe('ready');
    expect(response.body.primary.apiModel).toBe('openai/gpt-4.1');
    expect(response.body.primary.configured).toBe(true);
    expect(response.body.fallback.model).toBe('gemma4:latest');
    expect(response.body.fallback.configured).toBe(true);
    expect(response.body.anythingllm.workspace.available).toBe(true);
  });

  it('reports blockers without leaking secrets when primary token and runtime resources are missing', async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_PAT;
    delete process.env.GH_TOKEN;
    delete process.env.ANYTHINGLLM_API_KEY;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'qwen2.5-coder:7b' }] }),
    });

    const app = await buildApp();
    const response = await request(app).get('/llm/orchestration-readiness');

    expect(response.status).toBe(200);
    expect(response.body.summary.status).toBe('blocked');
    expect(response.body.primary.configured).toBe(false);
    expect(response.body.primary.tokenEnv).toBeNull();
    expect(response.body.summary.blockers).toContain('GitHub Models token not configured');
    expect(response.body.summary.blockers).toContain('Ollama fallback model not found: gemma4:latest');
    expect(response.body.summary.blockers).toContain('ANYTHINGLLM_API_KEY not configured');
    expect(JSON.stringify(response.body)).not.toContain('test-token');
    expect(JSON.stringify(response.body)).not.toContain('anything-token');
  });

  it('normalizes GitHub generate requests before delegating to the LLM client', async () => {
    vi.mocked(generateResponse).mockResolvedValueOnce('hello');

    const app = await buildApp();
    const response = await request(app)
      .post('/llm/generate')
      .send({
        prompt: '  hello brunella  ',
        provider: '  github  ',
        model: '  openai/gpt-4.1  ',
        userId: '  ops-user  ',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'hello', provider: 'github', model: 'openai/gpt-4.1' });
    expect(generateResponse).toHaveBeenCalledWith('hello brunella', 'github', 'openai/gpt-4.1');
  });

  it('rejects unsupported generate providers', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/llm/generate')
      .send({ prompt: 'hello', provider: 'unknown-provider' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('unsupported provider');
    expect(chatWithOllama).not.toHaveBeenCalled();
  });

  it('uses Ollama as the default generate provider with trimmed prompts', async () => {
    vi.mocked(chatWithOllama).mockResolvedValueOnce('local hello');

    const app = await buildApp();
    const response = await request(app)
      .post('/llm/generate')
      .send({ prompt: '  local prompt  ', model: '  gemma4:latest  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'local hello', provider: 'ollama', model: 'gemma4:latest' });
    expect(chatWithOllama).toHaveBeenCalledWith('local prompt', 'gemma4:latest');
  });
});
