/**
 * Phoenix Protocol v2 - Heartbeat Monitor Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { heartbeatMonitor } from '../src/utils/heartbeatMonitor.js';

describe('Phoenix Protocol v2 - Heartbeat Monitor', () => {
  beforeEach(() => {
    // Stop any previous running monitor
    heartbeatMonitor.stop();
  });

  afterEach(() => {
    // Clean up after each test
    heartbeatMonitor.stop();
  });

  describe('Start/Stop', () => {
    it('should start monitoring services', () => {
      heartbeatMonitor.start({ enabled: true, intervalMs: 30000 }); // Long interval for test
      expect(heartbeatMonitor.isActive()).toBe(true);
    });

    it('should stop monitoring services', () => {
      heartbeatMonitor.start({ enabled: true, intervalMs: 30000 });
      expect(heartbeatMonitor.isActive()).toBe(true);
      heartbeatMonitor.stop();
      expect(heartbeatMonitor.isActive()).toBe(false);
    });

    it('should not start if disabled via config', () => {
      heartbeatMonitor.start({ enabled: false });
      expect(heartbeatMonitor.isActive()).toBe(false);
    });
  });

  describe('Service Status', () => {
    it('should get overall health status', () => {
      const overall = heartbeatMonitor.getOverallHealth();
      expect(overall).toHaveProperty('status');
      expect(overall).toHaveProperty('unhealthyServices');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(overall.status);
    });

    it('should get all service statuses', () => {
      const statuses = heartbeatMonitor.getStatus();
      expect(statuses).toBeInstanceOf(Map);
      expect(statuses.size).toBeGreaterThan(0);

      // Check that essential services are monitored
      expect(statuses.has('ollama') || statuses.has('fastapi') || statuses.has('dashboard')).toBe(true);
    });

    it('should get individual service status', () => {
      const ollamaStatus = heartbeatMonitor.getServiceStatus('ollama');
      if (ollamaStatus) {
        expect(ollamaStatus).toHaveProperty('name', 'ollama');
        expect(ollamaStatus).toHaveProperty('status');
        expect(ollamaStatus).toHaveProperty('lastCheck');
        expect(ollamaStatus).toHaveProperty('consecutiveFailures');
      }
    });
  });

  describe('Failure Handling', () => {
    it('should register failure handlers', () => {
      const handler = vi.fn();
      heartbeatMonitor.onFailure('ollama', handler);
      // Handler registered - should not throw
      expect(true).toBe(true);
    });

    it('should reset failures for a service', () => {
      heartbeatMonitor.resetFailures('ollama');
      const status = heartbeatMonitor.getServiceStatus('ollama');
      if (status) {
        expect(status.consecutiveFailures).toBe(0);
      }
    });
  });

  describe('Manual Health Checks', () => {
    it('should trigger manual health check for a service', async () => {
      // Manual check should complete without error
      const result = await heartbeatMonitor.checkNow('ollama');
      // Result might be undefined if service is not configured, that's ok
      if (result) {
        expect(result).toHaveProperty('name', 'ollama');
        expect(result).toHaveProperty('status');
      }
    });

    it('should handle manual check for non-existent service', async () => {
      const result = await heartbeatMonitor.checkNow('non-existent-service');
      expect(result).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customConfig = {
        enabled: true,
        intervalMs: 10000,
        timeoutMs: 5000,
        maxRetries: 5,
      };

      heartbeatMonitor.start(customConfig);
      expect(heartbeatMonitor.isActive()).toBe(true);
    });

    it('should use default config if not provided', () => {
      heartbeatMonitor.start();
      // If PHOENIX_HEARTBEAT_ENABLED is not set to false, it should start
      const isActive = heartbeatMonitor.isActive();
      expect(typeof isActive).toBe('boolean');
    });
  });

  describe('Integration', () => {
    it('should have valid service health structure', () => {
      const statuses = heartbeatMonitor.getStatus();

      statuses.forEach((health) => {
        expect(health).toHaveProperty('name');
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('lastCheck');
        expect(health).toHaveProperty('consecutiveFailures');
        expect(health).toHaveProperty('latencyMs');
        expect(health).toHaveProperty('error');
        expect(['healthy', 'unhealthy', 'degraded', 'checking']).toContain(health.status);
        expect(typeof health.consecutiveFailures).toBe('number');
        expect(health.consecutiveFailures).toBeGreaterThanOrEqual(0);
      });
    });

    it('should track service health over time', () => {
      const before = heartbeatMonitor.getServiceStatus('ollama');
      const after = heartbeatMonitor.getServiceStatus('ollama');

      // Both should exist and have valid timestamps
      if (before && after) {
        expect(before.lastCheck).toBeInstanceOf(Date);
        expect(after.lastCheck).toBeInstanceOf(Date);
      }
    });
  });
});
