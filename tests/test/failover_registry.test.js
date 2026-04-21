/**
 * FailoverRegistry Unit Tests
 *
 * - Default mappings exist
 * - getFallbacks returns ordered chain
 * - registerMapping works
 * - recordAttempt + getAttempts
 * - stats
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
let failoverRegistry;
async function freshRegistry() {
    vi.resetModules();
    const mod = await import('../src/core/failoverRegistry.js');
    return mod.failoverRegistry;
}
describe('FailoverRegistry', () => {
    beforeEach(async () => {
        failoverRegistry = await freshRegistry();
    });
    it('should have default failover mappings', () => {
        const mappings = failoverRegistry.getAllMappings();
        expect(mappings.length).toBeGreaterThanOrEqual(5);
        const devMapping = mappings.find((m) => m.primary === 'Developer');
        expect(devMapping).toBeDefined();
        expect(devMapping.fallbacks.length).toBeGreaterThan(0);
    });
    it('should return fallbacks for known agent (case-insensitive)', () => {
        const fallbacks = failoverRegistry.getFallbacks('developer');
        expect(Array.isArray(fallbacks)).toBe(true);
        expect(fallbacks.length).toBeGreaterThan(0);
        expect(fallbacks).toContain('evaluator');
    });
    it('should return empty array for unknown agent', () => {
        const fallbacks = failoverRegistry.getFallbacks('NonExistentAgent');
        expect(fallbacks).toEqual([]);
    });
    it('should allow registering custom mapping', () => {
        failoverRegistry.registerMapping({
            primary: 'CustomAgent',
            fallbacks: ['FallbackA', 'FallbackB'],
            categories: ['test'],
        });
        const fallbacks = failoverRegistry.getFallbacks('CustomAgent');
        expect(fallbacks).toEqual(['FallbackA', 'FallbackB']);
    });
    it('should record and retrieve attempts', () => {
        failoverRegistry.recordAttempt({
            primaryAgent: 'Developer',
            fallbackAgent: 'evaluator',
            taskInstruction: 'fix bug',
            success: true,
            attemptIndex: 0,
            timestamp: new Date().toISOString(),
        });
        const attempts = failoverRegistry.getAttempts();
        expect(attempts.length).toBe(1);
        expect(attempts[0].primaryAgent).toBe('Developer');
        expect(attempts[0].success).toBe(true);
    });
    it('should filter attempts by agent', () => {
        failoverRegistry.recordAttempt({
            primaryAgent: 'Developer',
            fallbackAgent: 'evaluator',
            taskInstruction: 'task1',
            success: true,
            attemptIndex: 0,
            timestamp: new Date().toISOString(),
        });
        failoverRegistry.recordAttempt({
            primaryAgent: 'researcher',
            fallbackAgent: 'orchestrator',
            taskInstruction: 'task2',
            success: false,
            attemptIndex: 0,
            timestamp: new Date().toISOString(),
        });
        const devAttempts = failoverRegistry.getAttempts('Developer');
        expect(devAttempts.length).toBe(1);
        expect(devAttempts[0].primaryAgent).toBe('Developer');
    });
    it('should limit attempts returned', () => {
        for (let i = 0; i < 10; i++) {
            failoverRegistry.recordAttempt({
                primaryAgent: 'Agent' + i,
                fallbackAgent: 'Fallback' + i,
                taskInstruction: 'task' + i,
                success: i % 2 === 0,
                attemptIndex: 0,
                timestamp: new Date().toISOString(),
            });
        }
        const limited = failoverRegistry.getAttempts(undefined, 3);
        expect(limited.length).toBe(3);
    });
    it('should generate stats', () => {
        failoverRegistry.recordAttempt({
            primaryAgent: 'Developer',
            fallbackAgent: 'evaluator',
            taskInstruction: 't',
            success: true,
            attemptIndex: 0,
            timestamp: new Date().toISOString(),
        });
        failoverRegistry.recordAttempt({
            primaryAgent: 'Developer',
            fallbackAgent: 'orchestrator',
            taskInstruction: 't',
            success: false,
            attemptIndex: 1,
            timestamp: new Date().toISOString(),
        });
        const stats = failoverRegistry.getStats();
        expect(stats.totalAttempts).toBe(2);
        expect(stats.successCount).toBe(1);
        expect(stats.failureCount).toBe(1);
        expect(stats.byAgent['developer']).toBeDefined();
        expect(stats.byAgent['developer'].total).toBe(2);
    });
    it('should clear attempts', () => {
        failoverRegistry.recordAttempt({
            primaryAgent: 'X',
            fallbackAgent: 'Y',
            taskInstruction: 'test',
            success: true,
            attemptIndex: 0,
            timestamp: new Date().toISOString(),
        });
        failoverRegistry.clearAttempts();
        expect(failoverRegistry.getAttempts().length).toBe(0);
    });
});
