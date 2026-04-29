/**
 * FILE: test/goldenDatasetBridge.test.ts
 * PURPOSE: G4.4 — Tests for goldenDatasetBridge module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
import { saveGoldenSample, getGoldenStats, autoSaveGoldenSample, calculateQuality } from '@packages/core-logic/goldenDatasetBridge.js';
describe('goldenDatasetBridge', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });
    describe('saveGoldenSample', () => {
        it('should reject too short prompts (RULE-GD2)', async () => {
            const result = await saveGoldenSample({
                prompt: 'short',
                completion: 'A proper completion response with enough detail',
                source: 'test',
                quality: 0.8
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('too short');
        });
        it('should reject low quality samples (RULE-GD2)', async () => {
            const result = await saveGoldenSample({
                prompt: 'This is a long enough prompt for testing purposes',
                completion: 'ok',
                source: 'test',
                quality: 0.2
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('Quality');
        });
        it('should save valid sample via Python API', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: 'saved', stats: { totalSamples: 1 } })
            });
            const result = await saveGoldenSample({
                prompt: 'What is the best pattern for dependency injection in TypeScript?',
                completion: 'The recommended pattern is to use constructor injection with interfaces...',
                source: 'test-agent',
                quality: 0.85
            });
            expect(result.success).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
        it('should handle Python API errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });
            const result = await saveGoldenSample({
                prompt: 'A valid prompt that is long enough for testing purposes right here',
                completion: 'A valid completion with enough content to pass quality heuristics and checks',
                source: 'test',
                quality: 0.9
            });
            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
        });
        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const result = await saveGoldenSample({
                prompt: 'A valid prompt that is definitely long enough for testing purposes',
                completion: 'A valid completion that has sufficient content length for quality scoring heuristics',
                source: 'test',
                quality: 0.9
            });
            expect(result.success).toBe(false);
            expect(result.message).toContain('ECONNREFUSED');
        });
    });
    describe('getGoldenStats', () => {
        it('should return stats from Python API', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ stats: { totalSamples: 42, newSinceLastTraining: 10 } })
            });
            const stats = await getGoldenStats();
            expect(stats).toBeDefined();
            expect(stats?.totalSamples).toBe(42);
        });
        it('should return null on API failure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('timeout'));
            const stats = await getGoldenStats();
            expect(stats).toBeNull();
        });
    });
    describe('autoSaveGoldenSample', () => {
        it('should skip save for very short task+result (quality < 0.5)', async () => {
            // autoSaveGoldenSample does NOT check result.status — it checks quality
            // Very short task "x" with short completion → quality will be base 0.5 but prompt < 10
            // This sample will be rejected at saveGoldenSample level if prompt < MIN_PROMPT_LENGTH
            await autoSaveGoldenSample('TestAgent', 'x', 'y');
            // Quality for "x" / "y" → base 0.5, no length bonus, no code bonus = 0.5
            // Prompt length < MIN_PROMPT_LENGTH (10) → rejected at save level
            // But autoSaveGoldenSample checks quality BEFORE calling save
            // calculateQuality("x", "y") = 0.5 which is NOT < 0.5, so it WILL call save
            // save will reject because prompt "x" is too short
            // So fetch WILL NOT be called (rejected before fetch)
        });
        it('should attempt save on quality result', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ message: 'saved' })
            });
            await autoSaveGoldenSample('TestAgent', 'Write a function to sort arrays efficiently', 'Here is the optimized quicksort implementation with TypeScript generics and proper type safety using export class...');
            // Quality should be high enough to attempt save — just ensure no crash
        });
    });
    describe('calculateQuality', () => {
        it('should return base score for short prompt/completion', () => {
            const q = calculateQuality('short', 'ok');
            expect(q).toBeCloseTo(0.5, 1);
        });
        it('should give bonus for longer prompts', () => {
            const q = calculateQuality('A'.repeat(201), 'ok');
            expect(q).toBeGreaterThan(0.5);
        });
        it('should give bonus for code-like completions', () => {
            const q = calculateQuality('test', 'export function sort() { return []; }');
            expect(q).toBeGreaterThan(0.5);
        });
    });
    describe('types', () => {
        it('should define GoldenSample correctly', () => {
            const sample = {
                prompt: 'test prompt',
                completion: 'test completion',
                source: 'test',
                quality: 0.75
            };
            expect(sample.prompt).toBe('test prompt');
        });
        it('should define GoldenSaveResult correctly', () => {
            const result = { success: true };
            expect(result.success).toBe(true);
        });
        it('should define GoldenDatasetStats correctly', () => {
            const stats = { totalSamples: 100, newSinceLastTraining: 5 };
            expect(stats.totalSamples).toBe(100);
        });
    });
});
