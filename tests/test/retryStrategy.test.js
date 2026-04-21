import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));
import { withRetry, calculateDelay, DEFAULT_RETRY_CONFIG } from '../src/core/retryStrategy.js';
describe('RetryStrategy (G2.2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('calculateDelay', () => {
        it('should return baseDelay for attempt 1', () => {
            expect(calculateDelay(1)).toBe(1000);
        });
        it('should apply backoff multiplier for attempt 2', () => {
            // 1000 * 3^(2-1) = 3000
            expect(calculateDelay(2)).toBe(3000);
        });
        it('should cap at maxDelay for attempt 3', () => {
            // 1000 * 3^(3-1) = 9000 < 10000, so not capped
            expect(calculateDelay(3)).toBe(9000);
        });
        it('should cap at maxDelay for higher attempts', () => {
            // 1000 * 3^(4-1) = 27000 → capped to 10000
            expect(calculateDelay(4)).toBe(10000);
        });
        it('should respect custom config', () => {
            const config = { ...DEFAULT_RETRY_CONFIG, baseDelay: 500, backoffMultiplier: 2, maxDelay: 5000 };
            // 500 * 2^(2-1) = 1000
            expect(calculateDelay(2, config)).toBe(1000);
            // 500 * 2^(3-1) = 2000
            expect(calculateDelay(3, config)).toBe(2000);
        });
    });
    describe('withRetry', () => {
        it('should return result on first success', async () => {
            const fn = vi.fn().mockResolvedValue('ok');
            const result = await withRetry(fn, 'test');
            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
        });
        it('should retry on failure and succeed eventually', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail1'))
                .mockResolvedValueOnce('ok');
            const result = await withRetry(fn, 'test', { baseDelay: 1, maxDelay: 10 });
            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(2);
        });
        it('should throw after maxRetries exhausted', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('always fails'));
            await expect(withRetry(fn, 'test', { maxRetries: 2, baseDelay: 1, maxDelay: 10 })).rejects.toThrow('always fails');
            // initial + 2 retries = 3 calls
            expect(fn).toHaveBeenCalledTimes(3);
        });
        it('should call onRetry callback on each retry', async () => {
            const onRetry = vi.fn();
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce('ok');
            await withRetry(fn, 'test', { baseDelay: 1, maxDelay: 10, onRetry });
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
        });
        it('should not retry on first success', async () => {
            const onRetry = vi.fn();
            const fn = vi.fn().mockResolvedValue('ok');
            await withRetry(fn, 'test', { onRetry });
            expect(onRetry).not.toHaveBeenCalled();
        });
    });
    describe('DEFAULT_RETRY_CONFIG', () => {
        it('should match RULE-PH2 spec values', () => {
            expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
            expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000);
            expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(10000);
            expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(3);
        });
    });
});
