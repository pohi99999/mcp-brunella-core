import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be defined before imports
const mockAiGatewayGenerate = vi.fn();

// Mock aiGateway to isolate llm_client logic
vi.mock('../src/utils/aiGateway.js', () => ({
    aiGateway: {
        generate: mockAiGatewayGenerate
    }
}));

// Mock LangSmith traceable to be a pass-through
vi.mock('langsmith/traceable', () => ({
    traceable: (fn: any) => fn
}));

// Mock metrics to avoid side effects
vi.mock('../src/utils/metrics.js', () => ({
    recordLlmUsageAndCost: vi.fn()
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn()
}));

// Mock Google Generative AI
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent
}));

vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel = mockGetGenerativeModel;
        }
    };
});

describe('llm_client', () => {
    let generateResponse: any;

    beforeEach(async () => {
        vi.resetModules(); // Reset modules to re-evaluate top-level code
        vi.clearAllMocks();
        global.fetch = vi.fn();

        // Set environment variables BEFORE importing the module
        // Use a safe string for OLLAMA_MODEL to avoid secret masking confusion in logs
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        process.env.GITHUB_TOKEN = 'test-github-token';
        process.env.OLLAMA_MODEL = 'test-ollama-model';

        // Dynamic import to pick up env vars
        const module = await import('../src/core/llm_client.js');
        generateResponse = module.generateResponse;
    });

    afterEach(() => {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GITHUB_TOKEN;
        delete process.env.OLLAMA_MODEL;
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
            mockAiGatewayGenerate.mockResolvedValue('Ollama response');

            const result = await generateResponse('test prompt');

            expect(mockAiGatewayGenerate).toHaveBeenCalledWith(
                'test prompt',
                expect.objectContaining({
                    model: 'test-ollama-model', // Should match our test env var
                    temperature: 0.7
                })
            );
            expect(result).toBe('Ollama response');
        });

        it('should fallback to Ollama if primary provider fails (except Ollama itself)', async () => {
            // Setup Gemini failure
            mockGenerateContent.mockRejectedValueOnce(new Error('Gemini API Error'));
            // Setup Ollama success
            mockAiGatewayGenerate.mockResolvedValue('Fallback Ollama response');

            const result = await generateResponse('test prompt', 'gemini');

            expect(result).toBe('Fallback Ollama response');
            // Should have tried Gemini first
            expect(mockGenerateContent).toHaveBeenCalled();
            // Then Ollama
            expect(mockAiGatewayGenerate).toHaveBeenCalled();
        });

        it('should fallback to Ollama if Gemini API key is missing', async () => {
            vi.resetModules();
            delete process.env.GEMINI_API_KEY;
            // Re-import to pick up missing key
            const module = await import('../src/core/llm_client.js');
            generateResponse = module.generateResponse;

            mockAiGatewayGenerate.mockResolvedValue('Fallback Ollama response');

            const result = await generateResponse('test', 'gemini');
            expect(result).toBe('Fallback Ollama response');
        });

        it('should throw error if both primary and fallback fail', async () => {
            vi.resetModules();
            delete process.env.GEMINI_API_KEY;
            const module = await import('../src/core/llm_client.js');
            generateResponse = module.generateResponse;

            // Fail Ollama too
            mockAiGatewayGenerate.mockRejectedValue(new Error('Ollama Failed'));

            // Expect it to throw the ORIGINAL error (GEMINI_API_KEY not configured)
            await expect(generateResponse('test', 'gemini')).rejects.toThrow('GEMINI_API_KEY not configured');
        });
    });
});
