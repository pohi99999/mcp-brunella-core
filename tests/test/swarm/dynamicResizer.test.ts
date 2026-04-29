/**
 * Tests for Dynamic Resizer — Track #5 Phase 3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateResize, checkAgentHealth, getResizeSummary } from '@packages/core-logic/swarm/dynamicResizer.js';
import type { AgentHealth, ResizeConfig } from '@packages/core-logic/swarm/dynamicResizer.js';
import type { SwarmColony } from '@packages/agents/swarm/SwarmManager.js';

function makeAgent(id: string, role = 'worker', activeTasks = 0) {
  return {
    agentId: id,
    swarmId: 'test',
    role,
    activeTasks,
    isAvailable: activeTasks < 3,
    getStats: () => ({ active: activeTasks, completed: 5, failed: 0, successRate: 1.0 }),
    capabilities: ['general'],
  } as any;
}

function makeColony(agentCount: number, opts?: { includeLeader?: boolean }): SwarmColony {
  const agents = new Map();
  for (let i = 0; i < agentCount; i++) {
    const role = opts?.includeLeader && i === 0 ? 'leader' : 'worker';
    const a = makeAgent(`agent-${i}`, role);
    agents.set(a.agentId, a);
  }
  return {
    swarmId: 'test-colony',
    name: 'Test Colony',
    objective: 'test',
    agents,
    leaderId: opts?.includeLeader ? 'agent-0' : null,
    status: 'active',
    createdAt: Date.now(),
    metrics: { tasksCompleted: 0, tasksFailed: 0, avgDurationMs: 0, throughput: 0, lastActivity: Date.now() },
  } as SwarmColony;
}

describe('Dynamic Resizer', () => {
  describe('evaluateResize', () => {
    it('recommends scale_up when queue is overloaded', () => {
      const colony = makeColony(3);
      const result = evaluateResize(colony, 10, { scaleUpThreshold: 3 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('scale_up');
    });

    it('recommends scale_down when queue is underutilized', () => {
      const colony = makeColony(5, { includeLeader: true });
      const result = evaluateResize(colony, 1, { scaleDownThreshold: 0.5 });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('scale_down');
      expect(result!.agentId).not.toBe('agent-0'); // leader not removed
    });

    it('returns null when load is balanced', () => {
      const colony = makeColony(3);
      const result = evaluateResize(colony, 5, { scaleUpThreshold: 3, scaleDownThreshold: 0.5 });
      expect(result).toBeNull();
    });

    it('respects maxAgents limit', () => {
      const colony = makeColony(10);
      const result = evaluateResize(colony, 100, { maxAgents: 10 });
      expect(result).toBeNull();
    });

    it('respects minAgents limit', () => {
      const colony = makeColony(2);
      const result = evaluateResize(colony, 0, { minAgents: 2 });
      expect(result).toBeNull();
    });
  });

  describe('checkAgentHealth', () => {
    it('returns empty when all agents are active', () => {
      const agents = [makeAgent('a1', 'worker', 1), makeAgent('a2', 'worker', 2)];
      const healthMap = new Map<string, AgentHealth>();
      const actions = checkAgentHealth(agents, healthMap, { heartbeatTimeoutMs: 30000 });
      expect(actions).toHaveLength(0);
    });

    it('detects timed-out agent and recommends respawn', () => {
      const agents = [makeAgent('a1', 'worker', 0)];
      const healthMap = new Map<string, AgentHealth>();
      healthMap.set('a1', {
        agentId: 'a1',
        lastActivityMs: Date.now() - 60000, // 60s ago
        isAlive: true,
        failCount: 0,
        respawnCount: 0,
      });
      const actions = checkAgentHealth(agents, healthMap, { heartbeatTimeoutMs: 30000 });
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('respawn');
    });

    it('excludes agent after max respawn attempts', () => {
      const agents = [makeAgent('a1', 'worker', 0)];
      const healthMap = new Map<string, AgentHealth>();
      healthMap.set('a1', {
        agentId: 'a1',
        lastActivityMs: Date.now() - 60000,
        isAlive: false,
        failCount: 3,
        respawnCount: 3,
      });
      const actions = checkAgentHealth(agents, healthMap, { heartbeatTimeoutMs: 30000, maxRespawnAttempts: 3 });
      expect(actions[0].type).toBe('exclude');
    });

    it('initializes health for new agents', () => {
      const agents = [makeAgent('new-agent', 'worker', 1)];
      const healthMap = new Map<string, AgentHealth>();
      checkAgentHealth(agents, healthMap);
      expect(healthMap.has('new-agent')).toBe(true);
      expect(healthMap.get('new-agent')!.isAlive).toBe(true);
    });
  });

  describe('getResizeSummary', () => {
    it('combines resize and health recommendations', () => {
      const colony = makeColony(3);
      const healthMap = new Map<string, AgentHealth>();
      const summary = getResizeSummary(colony, 10, healthMap, { scaleUpThreshold: 3 });
      expect(summary.currentSize).toBe(3);
      expect(summary.queueLength).toBe(10);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });

    it('reports unhealthy agents', () => {
      const colony = makeColony(2);
      const healthMap = new Map<string, AgentHealth>();
      healthMap.set('agent-0', {
        agentId: 'agent-0',
        lastActivityMs: Date.now() - 60000,
        isAlive: false,
        failCount: 1,
        respawnCount: 1,
      });
      const summary = getResizeSummary(colony, 3, healthMap);
      expect(summary.unhealthyAgents).toContain('agent-0');
    });
  });
});
