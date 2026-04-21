/**
 * SwarmManager — Self-organizing agent colony orchestration
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Creates, monitors, and manages swarm colonies. Handles:
 * - Colony lifecycle (spawn, dissolve)
 * - Dynamic role election (leader/worker/specialist)
 * - Task distribution via competitive bidding
 * - Colony health and auto-scaling
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { SwarmAgent, type TaskBid, type SwarmTaskResult } from './SwarmAgent.js';
import { eventBus } from '@packages/core-logic/eventBus.js';
import { saveCheckpoint, pruneCheckpoints } from '@packages/core-logic/swarm/colonyPersistence.js';

export interface SwarmColony {
  swarmId: string;
  name: string;
  objective: string;
  agents: Map<string, SwarmAgent>;
  leaderId: string | null;
  status: 'forming' | 'active' | 'degraded' | 'dissolved' | 'paused';
  createdAt: number;
  metrics: ColonyMetrics;
}

export interface ColonyMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgDurationMs: number;
  throughput: number;  // tasks per minute
  lastActivity: number;
}

export interface SwarmTask {
  taskId: string;
  task: string;
  requiredCapabilities: string[];
  context?: Record<string, unknown>;
  priority: number;  // higher = more urgent
}

export class SwarmManager extends EventEmitter {
  private colonies = new Map<string, SwarmColony>();
  private taskCounter = 0;
  private checkpointInterval = 5; // auto-checkpoint every N tasks

  /** Create a new swarm colony */
  createColony(config: { swarmId: string; name: string; objective: string }): SwarmColony {
    const colony: SwarmColony = {
      swarmId: config.swarmId,
      name: config.name,
      objective: config.objective,
      agents: new Map(),
      leaderId: null,
      status: 'forming',
      createdAt: Date.now(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        avgDurationMs: 0,
        throughput: 0,
        lastActivity: Date.now(),
      },
    };

    this.colonies.set(config.swarmId, colony);
    logInfo('SwarmManager', `Colony created: ${config.name} (${config.swarmId})`);
    this.emit('colony:created', colony);
    eventBus.emit({
      source: 'SwarmManager',
      type: 'swarm.spawned',
      payload: { swarmId: colony.swarmId, name: colony.name },
    });
    return colony;
  }

  /** Add an agent to a colony */
  addAgent(swarmId: string, agent: SwarmAgent): boolean {
    const colony = this.colonies.get(swarmId);
    if (!colony) {
      logWarn('SwarmManager', `Colony ${swarmId} not found`);
      return false;
    }

    colony.agents.set(agent.agentId, agent);
    agent.setRole('worker');

    // Auto-elect leader if none
    if (!colony.leaderId) {
      this.electLeader(swarmId);
    }

    if (colony.status === 'forming' && colony.agents.size >= 2) {
      colony.status = 'active';
      this.emit('colony:active', colony);
    }

    logInfo('SwarmManager', `Agent ${agent.agentId} joined colony ${swarmId} (${colony.agents.size} members)`);
    return true;
  }

  /** Remove an agent from a colony */
  removeAgent(swarmId: string, agentId: string): void {
    const colony = this.colonies.get(swarmId);
    if (!colony) return;

    colony.agents.delete(agentId);

    if (colony.leaderId === agentId) {
      colony.leaderId = null;
      this.electLeader(swarmId);
    }

    if (colony.agents.size === 0) {
      colony.status = 'dissolved';
      this.emit('colony:dissolved', colony);
    }
  }

  /** Elect a leader based on success rate and capabilities */
  electLeader(swarmId: string): string | null {
    const colony = this.colonies.get(swarmId);
    if (!colony || colony.agents.size === 0) return null;

    let bestId: string | null = null;
    let bestScore = -1;

    for (const [id, agent] of colony.agents) {
      const stats = agent.getStats();
      const score = stats.successRate * 0.6 + (agent.capabilities.length / 10) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    if (bestId) {
      // Demote current leader
      if (colony.leaderId && colony.agents.has(colony.leaderId)) {
        colony.agents.get(colony.leaderId)!.setRole('worker');
      }
      colony.leaderId = bestId;
      colony.agents.get(bestId)!.setRole('leader');
      logInfo('SwarmManager', `Leader elected for ${swarmId}: ${bestId}`);
    }

    return bestId;
  }

  /** Submit a task to a colony — uses competitive bidding */
  async submitTask(swarmId: string, task: SwarmTask): Promise<SwarmTaskResult | null> {
    const colony = this.colonies.get(swarmId);
    if (!colony || colony.status === 'dissolved' || colony.status === 'paused') {
      logWarn('SwarmManager', `Cannot submit task to colony ${swarmId}: not available`);
      return null;
    }

    // Collect bids from available agents
    const bids: TaskBid[] = [];
    for (const agent of colony.agents.values()) {
      const bid = agent.bid(task.taskId, task.requiredCapabilities);
      if (bid) bids.push(bid);
    }

    if (bids.length === 0) {
      logWarn('SwarmManager', `No bids for task ${task.taskId} in colony ${swarmId}`);
      return null;
    }

    // Select best bid (highest confidence, lowest time)
    bids.sort((a, b) => {
      const scoreDiff = b.confidence - a.confidence;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return a.estimatedTimeMs - b.estimatedTimeMs;
    });

    const winner = bids[0];
    const agent = colony.agents.get(winner.agentId)!;

    logInfo('SwarmManager', `Task ${task.taskId} assigned to ${winner.agentId} (confidence: ${winner.confidence.toFixed(2)})`);

    const result = await agent.executeTask(task.taskId, task.task, task.context);

    // Update colony metrics
    if (result.status === 'success') {
      colony.metrics.tasksCompleted++;
    } else {
      colony.metrics.tasksFailed++;
    }
    const totalTasks = colony.metrics.tasksCompleted + colony.metrics.tasksFailed;
    colony.metrics.avgDurationMs =
      (colony.metrics.avgDurationMs * (totalTasks - 1) + result.durationMs) / totalTasks;
    colony.metrics.lastActivity = Date.now();

    // Auto-checkpoint after every N tasks
    if (totalTasks > 0 && totalTasks % this.checkpointInterval === 0) {
      try {
        saveCheckpoint(colony);
        pruneCheckpoints(colony.swarmId, 5);
      } catch (error: unknown) {
        const err = ensureError(error);
        logWarn('SwarmManager', `Auto-checkpoint failed for colony ${swarmId}: ${err.message}`);
      }
    }

    return result;
  }

  /** Get a colony */
  getColony(swarmId: string): SwarmColony | undefined {
    return this.colonies.get(swarmId);
  }

  /** List all colonies */
  listColonies(): SwarmColony[] {
    return Array.from(this.colonies.values());
  }

  /** Dissolve a colony */
  dissolveColony(swarmId: string): void {
    const colony = this.colonies.get(swarmId);
    if (!colony) return;

    colony.status = 'dissolved';
    for (const agent of colony.agents.values()) {
      agent.setRole('idle');
    }
    colony.agents.clear();
    colony.leaderId = null;

    logInfo('SwarmManager', `Colony ${swarmId} dissolved`);
    this.emit('colony:dissolved', colony);
    eventBus.emit({
      source: 'SwarmManager',
      type: 'swarm.dissolved',
      payload: { swarmId },
    });
  }

  /** Pause all active colonies (Phoenix Protocol failover) */
  pauseAllColonies(): void {
    for (const colony of this.colonies.values()) {
      if (colony.status === 'active' || colony.status === 'forming') {
        colony.status = 'paused';
        logInfo('SwarmManager', `Colony ${colony.swarmId} paused`);
        this.emit('colony:paused', colony);
      }
    }
  }

  /** Resume all paused colonies (Phoenix Protocol recovery) */
  resumeAllColonies(): void {
    for (const colony of this.colonies.values()) {
      if (colony.status === 'paused') {
        colony.status = 'active';
        logInfo('SwarmManager', `Colony ${colony.swarmId} resumed`);
        this.emit('colony:resumed', colony);
      }
    }
  }

  /** Returns the default Triád colony configuration */
  static getTriadConfig(): { name: string; agentIds: string[] } {
    return {
      name: 'Triad',
      agentIds: ['researcher', 'DataScientist', 'Developer'],
    };
  }

  /** Generate a unique task ID */
  nextTaskId(): string {
    return `swarm-task-${++this.taskCounter}-${Date.now()}`;
  }
}
