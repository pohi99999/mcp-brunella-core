/**
 * AI Gateway Tests (v3.0 - Pure Fetch API)
 * Tests Cloudflare Workers AI and Ollama integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIGatewayClient } from '../src/utils/aiGateway.js';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn()
}));

// Mock global fetch
global.fetch = vi.fn();

describe('AIGatewayClient (v3.0 Pure Fetch)', () => {
    let client: AIGatewayClient;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Configuration', () => {
        it('should initialize with Ollama (local) by default', () => {
            client = new AIGatewayClient({
                enabled: false,
                ollamaBaseUrl: 'http://localhost:11434',
                ollamaModel: 'llama3.1:8b'
            });

            expect(client).toBeDefined();
            expect(client.isUsingGateway()).toBe(false);
        });

        it('should initialize with CF Workers AI when enabled', () => {
            client = new AIGatewayClient({
                enabled: true,
                cfAccountId: 'test-account',
                cfGatewayId: 'test-gateway',
                cfApiToken: 'test-token'
            });

            expect(client.isUsingGateway()).toBe(true);
        });

        it('should disable gateway if CF_API_TOKEN missing', () => {
            client = new AIGatewayClient({
                enabled: true,
                cfApiToken: ''
            });

            expect(client.isUsingGateway()).toBe(false);
        });

        it('should return config', () => {
            client = new AIGatewayClient({ enabled: false });
            const config = client.getConfig();

            expect(config).toHaveProperty('enabled');
            expect(config).toHaveProperty('ollamaBaseUrl');
            expect(config).toHaveProperty('cfModel');
        });
    });

    describe('Statistics', () => {
        beforeEach(() => {
            client = new AIGatewayClient({ enabled: false });
        });

        it('should initialize with zero stats', () => {
            const stats = client.getStats();

            expect(stats.totalRequests).toBe(0);
            expect(stats.cfRequests).toBe(0);
            expect(stats.ollamaRequests).toBe(0);
            expect(stats.errors).toBe(0);
        });

        it('should reset stats', () => {
            client.resetStats();
            const stats = client.getStats();

            expect(stats.totalRequests).toBe(0);
            expect(stats.averageLatency).toBe(0);
        });
    });

    describe('Routing Logic', () => {
        it('should route to CF Workers AI when enabled', () => {
            client = new AIGatewayClient({
                enabled: true,
                cfAccountId: 'test-account',
                cfGatewayId: 'test-gateway',
                cfApiToken: 'token'
            });

            expect(client.isUsingGateway()).toBe(true);
        });

        it('should route to Ollama when gateway disabled', () => {
            client = new AIGatewayClient({
                enabled: false,
                ollamaBaseUrl: 'http://localhost:11434'
            });

            expect(client.isUsingGateway()).toBe(false);
        });

        it('should fallback to Ollama if CF token missing', () => {
            client = new AIGatewayClient({
                enabled: true,
                cfApiToken: ''
            });

            // Auto-downgrade to local Ollama
            expect(client.isUsingGateway()).toBe(false);
        });
    });

    describe('Chat API', () => {
        beforeEach(() => {
            client = new AIGatewayClient({ enabled: false });
        });

        it('should call Ollama /api/chat endpoint', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: { content: 'Hello world' } })
            });

            const result = await client.chat([{ role: 'user', content: 'Hi' }]);

            expect(result).toBe('Hello world');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/chat'),
                expect.any(Object)
            );
        });

        it('should throw on empty response', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: {} })
            });

            await expect(client.chat([{ role: 'user', content: 'Hi' }]))
                .rejects.toThrow('Empty response');
        });
    });

    describe('Embeddings API', () => {
        beforeEach(() => {
            client = new AIGatewayClient({ enabled: false });
        });

        it('should call Ollama /api/embeddings endpoint', async () => {
            const mockEmbedding = new Array(768).fill(0.1);
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ embedding: mockEmbedding })
            });

            const result = await client.embeddings('test text');

            expect(result).toEqual(mockEmbedding);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/embeddings'),
                expect.any(Object)
            );
        });

        it('should return zero vector on error', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            const result = await client.embeddings('test');

            expect(result).toHaveLength(768);
            expect(result.every(v => v === 0)).toBe(true);
        });
    });
});

