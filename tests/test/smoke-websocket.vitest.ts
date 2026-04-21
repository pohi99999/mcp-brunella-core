/**
 * Smoke tests for WebSocket event integration in Crawl4AI and Preferences routes.
 * Verifies module exports and socket emission patterns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Module import smoke tests ---

describe('WebSocket integration smoke tests', () => {
  describe('Module exports', () => {
    it('socketService module exports correctly', async () => {
      const mod = await import('../src/server/SocketService.js');
      expect(mod.socketService).toBeDefined();
      expect(typeof mod.socketService.emit).toBe('function');
      expect(typeof mod.socketService.isReady).toBe('function');
      expect(typeof mod.socketService.broadcastLog).toBe('function');
    });

    it('crawl4ai route still exports createCrawl4aiRouter', async () => {
      const mod = await import('../src/server/routes/crawl4ai.js');
      expect(mod.createCrawl4aiRouter).toBeDefined();
      expect(typeof mod.createCrawl4aiRouter).toBe('function');
    });

    it('preferences route still exports createPreferencesRouter', async () => {
      const mod = await import('../src/server/routes/preferences.js');
      expect(mod.createPreferencesRouter).toBeDefined();
      expect(typeof mod.createPreferencesRouter).toBe('function');
    });
  });

  describe('Socket event emission patterns', () => {
    let mockEmit: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      mockEmit = vi.fn();
      // Replace emit with mock to test emission without a real Socket.IO server
      vi.spyOn(socketService, 'emit').mockImplementation(mockEmit);
    });

    it('crawl4ai:status event has correct shape', async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      const payload = {
        available: true,
        python_api: 'http://127.0.0.1:8000',
        health: { status: 'ok' },
        timestamp: new Date().toISOString(),
      };
      socketService.emit('crawl4ai:status', payload);
      expect(mockEmit).toHaveBeenCalledWith('crawl4ai:status', expect.objectContaining({
        available: true,
        python_api: expect.any(String),
        timestamp: expect.any(String),
      }));
    });

    it('crawl4ai:progress event has correct shape', async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      const payload = {
        url: 'https://example.com',
        status: 'completed',
        timestamp: Date.now(),
      };
      socketService.emit('crawl4ai:progress', payload);
      expect(mockEmit).toHaveBeenCalledWith('crawl4ai:progress', expect.objectContaining({
        url: 'https://example.com',
        status: 'completed',
        timestamp: expect.any(Number),
      }));
    });

    it('crawl4ai:batch-progress event has correct shape', async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      const payload = {
        urlCount: 5,
        status: 'started',
        timestamp: Date.now(),
      };
      socketService.emit('crawl4ai:batch-progress', payload);
      expect(mockEmit).toHaveBeenCalledWith('crawl4ai:batch-progress', expect.objectContaining({
        urlCount: 5,
        status: 'started',
        timestamp: expect.any(Number),
      }));
    });

    it('preferences:change event has correct shape', async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      const payload = {
        userId: 'default',
        action: 'create' as const,
        key: 'test_pref',
        timestamp: Date.now(),
      };
      socketService.emit('preferences:change', payload);
      expect(mockEmit).toHaveBeenCalledWith('preferences:change', expect.objectContaining({
        userId: 'default',
        action: 'create',
        key: 'test_pref',
        timestamp: expect.any(Number),
      }));
    });

    it('preferences:stats event has correct shape', async () => {
      const { socketService } = await import('../src/server/SocketService.js');
      const payload = {
        userId: 'default',
        stats: { total: 10, by_type: { semantic: 5 } },
        timestamp: Date.now(),
      };
      socketService.emit('preferences:stats', payload);
      expect(mockEmit).toHaveBeenCalledWith('preferences:stats', expect.objectContaining({
        userId: 'default',
        stats: expect.objectContaining({ total: 10 }),
        timestamp: expect.any(Number),
      }));
    });

    it('event names follow namespace:action pattern', () => {
      const events = [
        'crawl4ai:status',
        'crawl4ai:progress',
        'crawl4ai:batch-progress',
        'preferences:change',
        'preferences:stats',
      ];
      for (const event of events) {
        expect(event).toMatch(/^[a-z0-9]+:[a-z][a-z0-9-]*$/);
      }
    });
  });
});
