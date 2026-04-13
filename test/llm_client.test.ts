import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateResponse } from '../src/core/llm_client.js';

const { mockGenerateContent, mockBifrostGenerate } = vi.hoisted(() => {
    const mockGenerateContent = vi.fn();
    const mockBifrostGenerate = vi.fn();
    return { mockGenerateContent, mockBifrostGenerate };
});

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            models = {
                generateContent: mockGenerateContent
            };
        }
    };
});

// Mock aiGateway to always use local Ollama (bypass CF routing in tests)
vi.mock('../src/utils/aiGateway.js', async () => {
    const { AIGatewayClient, ...rest } = await vi.importActual('../src/utils/aiGateway.js') as any;
    const localClient = new AIGatewayClient({ enabled: false });
    return {
        ...rest,
        AIGatewayClient,
        aiGateway: localClient
    };
});

// Mock LangSmith traceable to be a pass-through
vi.mock('langsmith/traceable', () => ({
    traceable: (fn: any) => fn
}));

vi.mock('../src/core/bifrost_gateway.js', () => ({
    bifrostGateway: {
        generate: mockBifrostGenerate,
    },
}));

// Mock fetch for Ollama and GitHub
global.fetch = vi.fn();

describe('llm_client', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn();
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        process.env.GITHUB_TOKEN = 'test-github-token';
        // Ensure consistent base URL and model for testing
        process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
        process.env.OLLAMA_MODEL = 'qwen2.5-coder:7b';
        process.env.AI_GATEWAY_ENABLED = 'false'; // Force local Ollama for tests
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.CLAUDE_API_KEY;
    });

    describe('generateResponse', () => {
        it('should use Gemini provider when requested', async () => {
            mockGenerateContent.mockResolvedValue({
                text: 'Gemini response'
            });

            const result = await generateResponse('test prompt', 'gemini');

            expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            }));
            expect(result).toBe('Gemini response');
        });

        it('should use GitHub provider when requested', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'GitHub response' } }]
                })
            });

            const result = await generateResponse('test prompt', 'github');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://models.github.ai/inference/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-github-token'
                    }),
                    body: expect.stringContaining('"model":"openai/gpt-4.1"')
                })
            );
            expect(result).toBe('GitHub response');
        });

        it('should use Ollama (default) when no provider specified', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    message: { content: 'Ollama response' }
                })
            });

            const result = await generateResponse('test prompt');

            expect(global.fetch).toHaveBeenCalledWith(
                // Expect full URL as configured in beforeEach
                'http://127.0.0.1:11434/api/chat',
                expect.objectContaining({
                    method: 'POST',
                    // Model name is read at module import time (not per-call),
                    // so we just verify the request body has the model field
                    body: expect.stringContaining('"model":')
                })
            );
            expect(result).toBe('Ollama response');
        });

        it('should use Bifrost-backed providers when requested', async () => {
            mockBifrostGenerate.mockResolvedValue({
                success: true,
                content: 'Anthropic response',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                duration_ms: 12,
            });

            const result = await generateResponse('review this architecture', 'anthropic');

            expect(mockBifrostGenerate).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'review this architecture',
                provider: 'anthropic',
            }));
            expect(result).toBe('Anthropic response');
        });

        it('should fallback to Ollama if primary provider fails (except Ollama itself)', async () => {
            // fail github
            (global.fetch as any)
                .mockRejectedValueOnce(new Error('GitHub API Error')) // First call fails
                .mockResolvedValueOnce({ // Fallback call succeeds
                    ok: true,
                    json: async () => ({
                        message: { content: 'Fallback Ollama response' }
                    })
                });

            const result = await generateResponse('test prompt', 'github');

            expect(result).toBe('Fallback Ollama response');
            expect(global.fetch).toHaveBeenCalledTimes(2); // 1 github + 1 ollama
        });

        it('should fallback to Ollama if Gemini API key is missing', async () => {
            delete process.env.GEMINI_API_KEY;

            // Allow Ollama fallback to succeed
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    message: { content: 'Fallback Ollama response' }
                })
            });

            const result = await generateResponse('test', 'gemini');
            expect(result).toBe('Fallback Ollama response');
        });

        it('should fallback to Ollama if GitHub Token is missing', async () => {
            delete process.env.GITHUB_TOKEN;
            delete process.env.GITHUB_PAT;

            // Allow Ollama fallback to succeed
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({
                    message: { content: 'Fallback Ollama response' }
                })
            });

            const result = await generateResponse('test', 'github');
            expect(result).toBe('Fallback Ollama response');
        });

        it('should throw error if both primary and fallback fail', async () => {
            delete process.env.GEMINI_API_KEY;

            // Fail Ollama too
            (global.fetch as any).mockRejectedValue(new Error('Ollama Failed'));

            // Expect it to throw the ORIGINAL error (GEMINI_API_KEY not configured)
            await expect(generateResponse('test', 'gemini')).rejects.toThrow('GEMINI_API_KEY not configured');
        });
    });
});
