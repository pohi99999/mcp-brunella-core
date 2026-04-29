/**
 * EdgeHealthMonitor Unit Tests
 *
 * - Snapshot default state
 * - Status transitions via probe (mocked fetch)
 * - Health history
 * - isEdgeAvailable / isEdgeHealthy helpers
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
let edgeHealthMonitor;
async function freshMonitor() {
    vi.resetModules();
    const mod = await import('@packages/core-logic/edgeHealthMonitor.js');
    return mod.edgeHealthMonitor;
}
describe('EdgeHealthMonitor', () => {
    beforeEach(async () => {
        edgeHealthMonitor = await freshMonitor();
    });
    afterEach(() => {
        edgeHealthMonitor.stop();
        vi.restoreAllMocks();
    });
    it('should start with offline status', () => {
        const snap = edgeHealthMonitor.getSnapshot();
        expect(snap.status).toBe('offline');
        expect(snap.latencyMs).toBe(-1);
        expect(snap.consecutiveFailures).toBe(0);
        expect(snap.lastSuccessAt).toBeNull();
    });
    it('should correctly detect healthy status on successful probe', async () => {
        // Mock fetch to return OK fast
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        }));
        const snapshot = await edgeHealthMonitor.probe();
        expect(snapshot.status).toBe('healthy');
        expect(snapshot.latencyMs).toBeGreaterThanOrEqual(0);
        expect(snapshot.consecutiveFailures).toBe(0);
        expect(snapshot.lastSuccessAt).toBeTruthy();
    });
    it('should track offline after consecutive failures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
        await edgeHealthMonitor.probe(); // failure 1 → degraded
        expect(edgeHealthMonitor.getSnapshot().status).toBe('degraded');
        await edgeHealthMonitor.probe(); // failure 2 → degraded
        expect(edgeHealthMonitor.getSnapshot().status).toBe('degraded');
        await edgeHealthMonitor.probe(); // failure 3 → offline
        expect(edgeHealthMonitor.getSnapshot().status).toBe('offline');
    });
    it('should store history entries', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await edgeHealthMonitor.probe();
        await edgeHealthMonitor.probe();
        const history = edgeHealthMonitor.getHistory();
        expect(history.length).toBe(2);
        expect(history[0].status).toBe('healthy');
    });
    it('isEdgeAvailable should be true for healthy/degraded, false for offline', async () => {
        // Start offline
        expect(edgeHealthMonitor.isEdgeAvailable()).toBe(false);
        // Probe success
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await edgeHealthMonitor.probe();
        expect(edgeHealthMonitor.isEdgeAvailable()).toBe(true);
    });
    it('isEdgeHealthy should be true only for healthy status', async () => {
        expect(edgeHealthMonitor.isEdgeHealthy()).toBe(false);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await edgeHealthMonitor.probe();
        expect(edgeHealthMonitor.isEdgeHealthy()).toBe(true);
    });
    it('setWorkerUrl should reset status to offline', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
        await edgeHealthMonitor.probe();
        expect(edgeHealthMonitor.getSnapshot().status).toBe('healthy');
        edgeHealthMonitor.setWorkerUrl('https://new-worker.example.com');
        expect(edgeHealthMonitor.getSnapshot().status).toBe('offline');
        expect(edgeHealthMonitor.getSnapshot().consecutiveFailures).toBe(0);
    });
});
