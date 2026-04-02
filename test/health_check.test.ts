import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock fs and path
vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
    },
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
}));

describe('Health Check Script', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    it('should return healthy when all services respond', async () => {
        // Ollama mock
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/api/tags')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ models: [{ name: 'llama3.1:8b' }] }),
                });
            }
            if (url.includes(':8000/health')) {
                return Promise.resolve({ ok: true });
            }
            if (url.includes('/readyz')) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: 'ready',
                            ready: true,
                            runtime: {
                                budget: {
                                    configuredHeapMb: 1536,
                                    runtimeMemoryLimitMb: 2048,
                                    restartThresholdMb: 1792,
                                    effectiveHeapLimitMb: 1584,
                                    state: 'aligned',
                                },
                            },
                        }),
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        expect(report).toBeDefined();
        expect(report.checks).toBeInstanceOf(Array);
        expect(report.checks.length).toBeGreaterThan(0);
        expect(report.passCount).toBeGreaterThan(0);
        expect(report.overall).toBeDefined();
    });

    it('should detect when Ollama is unreachable', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/api/tags')) {
                return Promise.reject(new Error('ECONNREFUSED'));
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        const ollamaCheck = report.checks.find((c: { name: string }) => c.name === 'Ollama');
        expect(ollamaCheck).toBeDefined();
        expect(ollamaCheck!.status).toBe('fail');
        expect(ollamaCheck!.message).toContain('ECONNREFUSED');
    });

    it('should warn when Ollama has no models', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/api/tags')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ models: [] }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        const ollamaCheck = report.checks.find((c: { name: string }) => c.name === 'Ollama');
        expect(ollamaCheck).toBeDefined();
        expect(ollamaCheck!.status).toBe('warn');
    });

    it('should check build freshness', async () => {
        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        const buildCheck = report.checks.find((c: { name: string }) => c.name === 'Build');
        expect(buildCheck).toBeDefined();
        expect(['pass', 'warn', 'fail']).toContain(buildCheck!.status);
    });

    it('should check API secrets', async () => {
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        const secretsCheck = report.checks.find((c: { name: string }) => c.name === 'API Kulcsok');
        expect(secretsCheck).toBeDefined();
    });

    it('should report overall unhealthy when critical checks fail', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        expect(report.failCount).toBeGreaterThan(0);
        expect(report.overall).toBe('unhealthy');
    });

    it('should warn when runtime memory pressure is elevated', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/api/tags')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ models: [{ name: 'llama3.1:8b' }] }),
                });
            }
            if (url.includes(':8000/health')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });
            }
            if (url.includes('/readyz')) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            status: 'ready',
                            ready: true,
                            runtime: {
                                memory: {
                                    heapUsedMb: 2300,
                                    heapLimitMb: 3072,
                                    heapUtilizationPercent: 74.9,
                                    state: 'warn',
                                },
                                budget: {
                                    configuredHeapMb: 1536,
                                    runtimeMemoryLimitMb: 2048,
                                    restartThresholdMb: 1792,
                                    effectiveHeapLimitMb: 3072,
                                    state: 'drift',
                                },
                            },
                        }),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        const { runHealthCheck } = await import('../scripts/health_check.ts');
        const report = await runHealthCheck();

        const nodeCheck = report.checks.find((c: { name: string }) => c.name === 'Node.js Backend');
        expect(nodeCheck).toBeDefined();
        expect(nodeCheck!.status).toBe('warn');
        expect(nodeCheck!.message).toContain('[warn]');
        expect(nodeCheck!.message).toContain('[contract:drift]');
    });
});
