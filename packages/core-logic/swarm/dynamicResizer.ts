/**
 * Dynamic Resizer — Auto-scale swarm colonies based on load
 * Track #5: Swarm Intelligence v2 — Phase 3
 *
 * Monitors colony load (queue/agent ratio) and automatically adds/removes agents.
 * Detects failed agents via timeout and respawns from last checkpoint.
 */

import { logInfo, logWarn } from '@packages/utils/logger.js';
import type { SwarmColony } from '@packages/agents/swarm/SwarmManager.js';
import type { SwarmAgent } from '@packages/agents/swarm/SwarmAgent.js';

export interface ResizeConfig {
  minAgents: number;       // default: 2
  maxAgents: number;       // default: 10
  scaleUpThreshold: number;    // queue > agents × this → add agent (default: 3)
  scaleDownThreshold: number;  // queue < agents × this → remove agent (default: 0.5)
  heartbeatTimeoutMs: number;  // agent considered dead after this (default: 30000)
  maxRespawnAttempts: number;  // max respawn tries before excluding (default: 3)
}

export interface AgentHealth {
  agentId: string;
  lastActivityMs: number;
  isAlive: boolean;
  failCount: number;
  respawnCount: number;
}

export interface ResizeAction {
  type: 'scale_up' | 'scale_down' | 'respawn' | 'exclude';
  agentId?: string;
  reason: string;
  timestamp: number;
}

const DEFAULT_CONFIG: ResizeConfig = {
  minAgents: 2,
  maxAgents: 10,
  scaleUpThreshold: 3,
  scaleDownThreshold: 0.5,
  heartbeatTimeoutMs: 30000,
  maxRespawnAttempts: 3,
};

/**
 * Evaluate whether the colony needs resizing based on current load
 */
export function evaluateResize(
  colony: SwarmColony,
  queueLength: number,
  config: Partial<ResizeConfig> = {},
): ResizeAction | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const agentCount = colony.agents.size;

  // Scale up: queue overloaded
  if (queueLength > agentCount * cfg.scaleUpThreshold && agentCount < cfg.maxAgents) {
    return {
      type: 'scale_up',
      reason: `Queue (${queueLength}) > agents (${agentCount}) × ${cfg.scaleUpThreshold}`,
      timestamp: Date.now(),
    };
  }

  // Scale down: underutilized
  if (queueLength < agentCount * cfg.scaleDownThreshold && agentCount > cfg.minAgents) {
    // Find least busy agent to remove
    let leastBusy: SwarmAgent | null = null;
    let leastActive = Infinity;

    for (const agent of colony.agents.values()) {
      if (agent.role === 'leader') continue; // never remove leader
      if (agent.activeTasks < leastActive) {
        leastActive = agent.activeTasks;
        leastBusy = agent;
      }
    }

    if (leastBusy) {
      return {
        type: 'scale_down',
        agentId: leastBusy.agentId,
        reason: `Queue (${queueLength}) < agents (${agentCount}) × ${cfg.scaleDownThreshold}`,
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Check agent health based on activity timeout
 */
export function checkAgentHealth(
  agents: SwarmAgent[],
  healthMap: Map<string, AgentHealth>,
  config: Partial<ResizeConfig> = {},
): ResizeAction[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const actions: ResizeAction[] = [];

  for (const agent of agents) {
    let health = healthMap.get(agent.agentId);
    if (!health) {
      health = {
        agentId: agent.agentId,
        lastActivityMs: now,
        isAlive: true,
        failCount: 0,
        respawnCount: 0,
      };
      healthMap.set(agent.agentId, health);
    }

    // Check if agent is active (has recent activity)
    const stats = agent.getStats();
    const isActive = stats.active > 0 || agent.activeTasks > 0;

    if (isActive) {
      health.lastActivityMs = now;
      health.isAlive = true;
      continue;
    }

    // Check timeout
    const timeSinceActivity = now - health.lastActivityMs;
    if (timeSinceActivity > cfg.heartbeatTimeoutMs) {
      health.isAlive = false;
      health.failCount++;

      if (health.respawnCount >= cfg.maxRespawnAttempts) {
        actions.push({
          type: 'exclude',
          agentId: agent.agentId,
          reason: `Agent ${agent.agentId} exceeded max respawn attempts (${cfg.maxRespawnAttempts})`,
          timestamp: now,
        });
        logWarn('DynamicResizer', `Agent ${agent.agentId} excluded after ${cfg.maxRespawnAttempts} respawn attempts`);
      } else {
        health.respawnCount++;
        actions.push({
          type: 'respawn',
          agentId: agent.agentId,
          reason: `Agent ${agent.agentId} timed out after ${timeSinceActivity}ms (attempt ${health.respawnCount}/${cfg.maxRespawnAttempts})`,
          timestamp: now,
        });
        logInfo('DynamicResizer', `Respawning agent ${agent.agentId} (attempt ${health.respawnCount})`);
      }
    }
  }

  return actions;
}

/**
 * Get resize recommendations as a summary
 */
export function getResizeSummary(
  colony: SwarmColony,
  queueLength: number,
  healthMap: Map<string, AgentHealth>,
  config: Partial<ResizeConfig> = {},
): {
  currentSize: number;
  queueLength: number;
  recommendations: ResizeAction[];
  unhealthyAgents: string[];
} {
  const resizeAction = evaluateResize(colony, queueLength, config);
  const agents = Array.from(colony.agents.values());
  const healthActions = checkAgentHealth(agents, healthMap, config);

  const unhealthyAgents = Array.from(healthMap.values())
    .filter(h => !h.isAlive)
    .map(h => h.agentId);

  return {
    currentSize: colony.agents.size,
    queueLength,
    recommendations: resizeAction ? [resizeAction, ...healthActions] : healthActions,
    unhealthyAgents,
  };
}
