/**
 * PhoenixEventBus Unit Tests
 *
 * - typed publish/subscribe
 * - history ring buffer
 * - stats
 * - socket broadcaster integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
// We import the CLASS via module so we get a fresh instance for each test
let phoenixEventBus;
// Dynamic import helper to get a fresh singleton each time
async function freshEventBus() {
    // Reset module cache for a clean singleton
    vi.resetModules();
    const mod = await import('../src/core/phoenixEventBus.js');
    return mod.phoenixEventBus;
}
describe('PhoenixEventBus', () => {
    beforeEach(async () => {
        phoenixEventBus = await freshEventBus();
    });
    it('should publish and receive typed events', () => {
        const handler = vi.fn();
        phoenixEventBus.subscribe('phoenix:agent_failed', handler);
        const event = {
            agentName: 'Developer',
            taskInstruction: 'fix bug',
            error: 'timeout',
            retriesExhausted: 3,
            timestamp: new Date().toISOString(),
        };
        phoenixEventBus.publish('phoenix:agent_failed', event);
        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(event);
    });
    it('should unsubscribe a handler', () => {
        const handler = vi.fn();
        phoenixEventBus.subscribe('phoenix:circuit_breaker', handler);
        phoenixEventBus.unsubscribe('phoenix:circuit_breaker', handler);
        phoenixEventBus.publish('phoenix:circuit_breaker', {
            agentName: 'test',
            state: 'open',
            previousState: 'closed',
            failures: 3,
            timestamp: new Date().toISOString(),
        });
        expect(handler).not.toHaveBeenCalled();
    });
    it('should store events in history', () => {
        phoenixEventBus.publish('phoenix:recovery', {
            type: 'crash',
            agent: 'Developer',
            details: 'OOM',
            timestamp: new Date().toISOString(),
        });
        phoenixEventBus.publish('phoenix:recovery', {
            type: 'restart',
            agent: 'evaluator',
            details: 'restarted',
            timestamp: new Date().toISOString(),
        });
        const history = phoenixEventBus.getHistory();
        expect(history.length).toBe(2);
        expect(history[0].event).toBe('phoenix:recovery');
        expect(history[1].event).toBe('phoenix:recovery');
    });
    it('should filter history by event type', () => {
        phoenixEventBus.publish('phoenix:recovery', {
            type: 'crash',
            agent: 'Developer',
            details: 'OOM',
            timestamp: new Date().toISOString(),
        });
        phoenixEventBus.publish('phoenix:circuit_breaker', {
            agentName: 'Developer',
            state: 'open',
            previousState: 'closed',
            failures: 5,
            timestamp: new Date().toISOString(),
        });
        const filtered = phoenixEventBus.getHistory('phoenix:circuit_breaker');
        expect(filtered.length).toBe(1);
        expect(filtered[0].event).toBe('phoenix:circuit_breaker');
    });
    it('should limit history results', () => {
        for (let i = 0; i < 10; i++) {
            phoenixEventBus.publish('phoenix:recovery', {
                type: 'crash',
                agent: 'test',
                details: `event ${i}`,
                timestamp: new Date().toISOString(),
            });
        }
        const limited = phoenixEventBus.getHistory(undefined, 3);
        expect(limited.length).toBe(3);
    });
    it('should calculate stats from history', () => {
        phoenixEventBus.publish('phoenix:agent_failed', {
            agentName: 'dev',
            taskInstruction: 't',
            error: 'e',
            retriesExhausted: 1,
            timestamp: new Date().toISOString(),
        });
        phoenixEventBus.publish('phoenix:agent_failed', {
            agentName: 'eval',
            taskInstruction: 't',
            error: 'e',
            retriesExhausted: 1,
            timestamp: new Date().toISOString(),
        });
        phoenixEventBus.publish('phoenix:circuit_breaker', {
            agentName: 'dev',
            state: 'open',
            previousState: 'closed',
            failures: 3,
            timestamp: new Date().toISOString(),
        });
        const stats = phoenixEventBus.getStats();
        expect(stats['phoenix:agent_failed']).toBe(2);
        expect(stats['phoenix:circuit_breaker']).toBe(1);
    });
    it('should broadcast via socket broadcaster when connected', () => {
        const broadcaster = vi.fn();
        phoenixEventBus.connectSocketBroadcaster(broadcaster);
        phoenixEventBus.publish('phoenix:edge_health', {
            status: 'healthy',
            previousStatus: 'offline',
            latencyMs: 42,
            timestamp: new Date().toISOString(),
        });
        expect(broadcaster).toHaveBeenCalledWith('phoenix:edge_health', expect.objectContaining({ status: 'healthy' }));
    });
    it('should clear history', () => {
        phoenixEventBus.publish('phoenix:recovery', {
            type: 'crash',
            agent: 'test',
            details: 'x',
            timestamp: new Date().toISOString(),
        });
        expect(phoenixEventBus.getHistory().length).toBe(1);
        phoenixEventBus.clearHistory();
        expect(phoenixEventBus.getHistory().length).toBe(0);
    });
});
