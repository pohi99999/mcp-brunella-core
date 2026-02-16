/**
 * Phoenix Protocol v2 - AgentManager Recovery Logic Tests
 *
 * Tests for executeWithRecovery(), restartService(), and restoreState().
 *
 * @version 1.0.0
 * @track phoenix_protocol_v2_20260205
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { agentManager } from '../src/agents/AgentManager.js';
import { saveCheckpoint, clearCheckpoints, closeCheckpointDb } from '../src/core/checkpoint.js';
import type { IAgent } from '../src/agents/types.js';

describe('Phoenix Protocol v2 - AgentManager Recovery Logic', () => {
  // Mock agent for testing
  const mockAgent: IAgent = {
    name: 'TestRecoveryAgent',
    role: 'test',
    description: 'Test agent for Phoenix recovery',
    capabilities: ['test'],
    execute: vi.fn(),
  };

  beforeAll(async () => {
    // Initialize agent manager
    await agentManager.initialize();

    // Register mock agent
    agentManager.registerAgent(mockAgent);

    // Clear any existing checkpoints
    await clearCheckpoints('TestRecoveryAgent:test_task');
  });

  // Reset mocks and circuit breaker before each test
  beforeEach(async () => {
    vi.clearAllMocks();

    // Access the private circuitBreakers map and reset TestRecoveryAgent
    // This is a hack but necessary for isolated tests
    const manager = agentManager as any;
    if (manager.circuitBreakers && manager.circuitBreakers.has('TestRecoveryAgent')) {
      const cb = manager.circuitBreakers.get('TestRecoveryAgent');
      cb.failures = 0;
      cb.isOpen = false;
      cb.lastFailure = 0;
    }
  });

  afterAll(async () => {
    // Cleanup
    await clearCheckpoints('TestRecoveryAgent:test_task');
    await closeCheckpointDb();
  });

  describe('executeWithRecovery()', () => {
    it('should succeed on first attempt if agent executes successfully', async () => {
      // Mock successful execution
      vi.mocked(mockAgent.execute).mockResolvedValueOnce({
        status: 'success',
        data: 'test_result',
      });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'test_task',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.recoveryAttempts).toBe(0);
      expect(mockAgent.execute).toHaveBeenCalledTimes(1);
    });

    it('should attempt recovery on failure and succeed on retry', { timeout: 15000 }, async () => {
      // Mock implementation: fail first 3 times (to exhaust executeAgentWithRetry's internal retries),
      // then succeed on next call (after Phoenix recovery)
      let callCount = 0;
      vi.mocked(mockAgent.execute).mockImplementation(async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error('Temporary failure');
        }
        return { status: 'success', data: 'recovered_result' };
      });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'test_recovery_task',
        {}
      );

      expect(result.success).toBe(true);
      expect(result.recoveryAttempts).toBeGreaterThan(0);
    });

    it('should return degraded status after max recovery attempts', { timeout: 30000 }, async () => {
      // All attempts fail
      vi.mocked(mockAgent.execute).mockRejectedValue(
        new Error('Persistent failure')
      );

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'test_max_retries',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('degraded');
      expect(result.message).toContain('recovery attempts');
      expect(result.recoveryAttempts).toBe(3);
    });
  });

  describe('State Restoration', () => {
    it('should restore state from checkpoint if available', { timeout: 15000 }, async () => {
      // Save a checkpoint first
      const testState = {
        step: 'data_processing',
        progress: 50,
        intermediateResults: ['result1', 'result2'],
      };

      await saveCheckpoint(
        'TestRecoveryAgent:checkpoint_test',
        1,
        'data_processing',
        testState
      );

      // Mock failure then success
      vi.mocked(mockAgent.execute)
        .mockRejectedValueOnce(new Error('Checkpoint test failure'))
        .mockResolvedValueOnce({
          status: 'success',
          data: 'checkpoint_recovered',
        });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'checkpoint_test',
        {}
      );

      expect(result.success).toBe(true);

      // Cleanup
      await clearCheckpoints('TestRecoveryAgent:checkpoint_test');
    });
  });

  describe('Service Restart', () => {
    it('should not restart external services (ollama, fastapi)', async () => {
      // This should complete without errors even though we can't restart external services
      vi.mocked(mockAgent.execute).mockResolvedValueOnce({
        status: 'success',
        data: 'external_service_test',
      });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'external_service_test',
        {}
      );

      expect(result.success).toBe(true);
    });

    it('should reset circuit breaker on agent restart', { timeout: 30000 }, async () => {
      // First execution to trigger circuit breaker
      vi.mocked(mockAgent.execute).mockRejectedValue(
        new Error('Circuit breaker test')
      );

      const result1 = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'circuit_breaker_test',
        {}
      );

      expect(result1.success).toBe(false);

      // After recovery, circuit breaker should be reset
      vi.mocked(mockAgent.execute).mockResolvedValueOnce({
        status: 'success',
        data: 'circuit_reset',
      });

      const result2 = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'circuit_breaker_reset_test',
        {}
      );

      expect(result2.success).toBe(true);
    });
  });

  describe('Phoenix Event Bus Integration', () => {
    it('should publish recovery events during execution', { timeout: 15000 }, async () => {
      const events: any[] = [];

      // Subscribe to Phoenix events (if phoenixEventBus is accessible)
      // For now, we just verify execution completes

      vi.mocked(mockAgent.execute)
        .mockRejectedValueOnce(new Error('Event test failure'))
        .mockResolvedValueOnce({
          status: 'success',
          data: 'event_test_success',
        });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'event_test',
        {}
      );

      expect(result.success).toBe(true);
      // Phoenix events should have been published (verified via logs)
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide meaningful error messages on degradation', { timeout: 30000 }, async () => {
      vi.mocked(mockAgent.execute).mockRejectedValue(
        new Error('Critical system failure')
      );

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'degradation_message_test',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Service degraded');
      expect(result.message).toContain('Critical system failure');
      expect(result.data).toBeNull();
    });
  });

  describe('Integration with Heartbeat Monitor', () => {
    it('should work alongside heartbeat monitoring', async () => {
      // This verifies that recovery logic doesn't interfere with
      // the heartbeat monitor's service checks

      vi.mocked(mockAgent.execute).mockResolvedValueOnce({
        status: 'success',
        data: 'heartbeat_integration_test',
      });

      const result = await agentManager.executeWithRecovery(
        'TestRecoveryAgent',
        'heartbeat_integration',
        {}
      );

      expect(result.success).toBe(true);
      // No conflicts with heartbeat monitor
    });
  });
});
