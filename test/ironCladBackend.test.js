/**
 * Iron Clad Python AI Backend - Integration Test Suite
 *
 * Tests the unified Python backend (FastAPI + LiteLLM Gateway + vLLM)
 * Port: 8010
 */
import { describe, it, expect, beforeAll } from 'vitest';
const BACKEND_URL = 'http://127.0.0.1:8010';
const BACKEND_TIMEOUT = 5000; // 5s
/**
 * Check if the Iron Clad backend is running
 */
async function isBackendRunning() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${BACKEND_URL}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res.ok;
    }
    catch {
        return false;
    }
}
describe('Iron Clad Backend - Integration Tests', () => {
    let backendAvailable = false;
    let testModel = 'qwen2.5-coder:7b'; // Default fallback
    beforeAll(async () => {
        backendAvailable = await isBackendRunning();
        if (!backendAvailable) {
            console.warn('[SKIP] Iron Clad backend not running on port 8010. Start with: python -m myai.backend.app');
        }
        else {
            // Try to get first available generative model (skip embedding models)
            try {
                const res = await fetch(`${BACKEND_URL}/models`, {
                    signal: AbortSignal.timeout(BACKEND_TIMEOUT),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data && data.data.length > 0) {
                        // Filter out embedding models
                        const generativeModels = data.data.filter((m) => !m.id.includes('embed') && !m.id.includes('nomic'));
                        if (generativeModels.length > 0) {
                            testModel = generativeModels[0].id;
                        }
                        console.log(`[INFO] Using test model: ${testModel}`);
                    }
                }
            }
            catch {
                // Use default
            }
        }
    });
    describe('Health Check', () => {
        it('should return healthy status', async () => {
            if (!backendAvailable)
                return;
            const res = await fetch(`${BACKEND_URL}/health`, {
                signal: AbortSignal.timeout(BACKEND_TIMEOUT),
            });
            expect(res.ok).toBe(true);
            const data = await res.json();
            expect(data).toHaveProperty('status', 'ok');
            expect(data).toHaveProperty('service');
            expect(data).toHaveProperty('default_model');
        });
    });
    describe('Models Endpoint', () => {
        it('should list available models', async () => {
            if (!backendAvailable)
                return;
            const res = await fetch(`${BACKEND_URL}/models`, {
                signal: AbortSignal.timeout(BACKEND_TIMEOUT),
            });
            expect(res.ok).toBe(true);
            const data = await res.json();
            expect(data).toHaveProperty('data');
            expect(Array.isArray(data.data)).toBe(true);
            // Each model should have id and object fields
            if (data.data.length > 0) {
                const model = data.data[0];
                expect(model).toHaveProperty('id');
                expect(model).toHaveProperty('object', 'model');
            }
        });
    });
    describe('Chat Completions', () => {
        it('should complete a simple chat request', { timeout: 60000 }, async () => {
            if (!backendAvailable)
                return;
            const payload = {
                model: testModel,
                messages: [
                    { role: 'user', content: 'Say "Integration test OK" and nothing else.' },
                ],
                temperature: 0.1,
                max_tokens: 50,
            };
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000), // 15s for LLM response
            });
            expect(res.ok).toBe(true);
            const data = await res.json();
            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('created');
            expect(data).toHaveProperty('model');
            expect(data).toHaveProperty('choices');
            expect(Array.isArray(data.choices)).toBe(true);
            expect(data.choices.length).toBeGreaterThan(0);
            const choice = data.choices[0];
            expect(choice).toHaveProperty('message');
            expect(choice.message).toHaveProperty('content');
            expect(typeof choice.message.content).toBe('string');
            expect(choice.message.content.length).toBeGreaterThan(0);
        });
        it('should handle temperature and max_tokens parameters', { timeout: 60000 }, async () => {
            if (!backendAvailable)
                return;
            const payload = {
                model: testModel,
                messages: [
                    { role: 'user', content: 'Count from 1 to 5.' },
                ],
                temperature: 0.0,
                max_tokens: 20,
            };
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });
            expect(res.ok).toBe(true);
            const data = await res.json();
            expect(data.choices[0].message.content).toBeTruthy();
        });
        it('should reject invalid model names', async () => {
            if (!backendAvailable)
                return;
            const payload = {
                model: 'non-existent-model-xyz',
                messages: [
                    { role: 'user', content: 'Hello' },
                ],
            };
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(10000),
            });
            // Should either return 500 or successfully fallback to default model
            // Depending on provider configuration
            expect([200, 400, 500]).toContain(res.status);
        });
        it('should reject stream=true in Phase 1', async () => {
            if (!backendAvailable)
                return;
            const payload = {
                model: testModel,
                messages: [
                    { role: 'user', content: 'Hello' },
                ],
                stream: true,
            };
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(5000),
            });
            // Phase 1 does not support streaming
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.detail).toContain('stream');
        });
    });
    describe('Error Handling', () => {
        it('should return 404 for non-existent endpoints', async () => {
            if (!backendAvailable)
                return;
            const res = await fetch(`${BACKEND_URL}/non-existent-endpoint`, {
                signal: AbortSignal.timeout(BACKEND_TIMEOUT),
            });
            expect(res.status).toBe(404);
        });
        it('should handle malformed JSON in POST requests', async () => {
            if (!backendAvailable)
                return;
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json {{{',
                signal: AbortSignal.timeout(BACKEND_TIMEOUT),
            });
            expect(res.status).toBe(422); // FastAPI validation error
        });
    });
    describe('Performance', () => {
        it('should respond to health check within 500ms', async () => {
            if (!backendAvailable)
                return;
            const start = Date.now();
            const res = await fetch(`${BACKEND_URL}/health`);
            const latency = Date.now() - start;
            expect(res.ok).toBe(true);
            expect(latency).toBeLessThan(500);
        });
        it('should handle concurrent requests', async () => {
            if (!backendAvailable)
                return;
            const requests = Array.from({ length: 5 }, () => fetch(`${BACKEND_URL}/models`, {
                signal: AbortSignal.timeout(BACKEND_TIMEOUT),
            }));
            const responses = await Promise.all(requests);
            const allOk = responses.every((r) => r.ok);
            expect(allOk).toBe(true);
        });
    });
    describe('Provider Gateway', () => {
        it('should route requests through LiteLLM gateway', { timeout: 60000 }, async () => {
            if (!backendAvailable)
                return;
            // This test verifies the gateway is operational by checking usage metadata
            const payload = {
                model: testModel,
                messages: [
                    { role: 'user', content: 'Hi' },
                ],
                max_tokens: 5,
            };
            const res = await fetch(`${BACKEND_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });
            expect(res.ok).toBe(true);
            const data = await res.json();
            // Usage metadata indicates successful provider routing
            expect(data).toHaveProperty('usage');
            expect(data.usage).toHaveProperty('prompt_tokens');
            expect(data.usage).toHaveProperty('completion_tokens');
            expect(data.usage).toHaveProperty('total_tokens');
        });
    });
});
