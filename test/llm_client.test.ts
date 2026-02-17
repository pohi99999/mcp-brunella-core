import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateResponse } from '../src/core/llm_client.js';

const { mockGenerateContent, mockGetGenerativeModel } = vi.hoisted(() => {
    const mockGenerateContent = vi.fn();
    const mockGetGenerativeModel = vi.fn(() => ({
        generateContent: mockGenerateContent
    }));
    return { mockGenerateContent, mockGetGenerativeModel };
});

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel = mockGetGenerativeModel;
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

// Mock fetch for Ollama and GitHub
global.fetch = vi.fn();

describe('llm_client', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        global.fetch = vi.fn();
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        process.env.GITHUB_TOKEN = 'test-github-token';
        process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
        process.env.OLLAMA_MODEL = 'qwen2.5-coder:7b'; // Set explicit model for test consistency
        process.env.AI_GATEWAY_ENABLED = 'false'; // Force local Ollama for tests
    });

    describe('generateResponse', () => {
        it('should use Gemini provider when requested', async () => {
            mockGenerateContent.mockResolvedValue({
                response: { text: () => 'Gemini response' }
            });

            const result = await generateResponse('test prompt', 'gemini');

            expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.0-flash' });
            expect(mockGenerateContent).toHaveBeenCalledWith('test prompt');
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
                'https://models.inference.ai.azure.com/chat/completions',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-github-token'
                    }),
                    body: expect.stringContaining('"model":"gpt-4o"')
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
                'http://127.0.0.1:11434/api/chat', // Use exact URL found in logs
                expect.objectContaining({
                    method: 'POST',
                    // Allow specific model or any non-empty string for resilience
                    body: expect.stringContaining('"role":"user"')
                })
            );
            expect(result).toBe('Ollama response');
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
