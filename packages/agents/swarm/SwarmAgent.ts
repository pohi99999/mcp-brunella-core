/**
 * SwarmAgent — Agent that participates in a self-organizing swarm colony
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Each SwarmAgent wraps an existing IAgent and adds swarm-specific behavior:
 * role election, task bidding, peer communication, and colony lifecycle events.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import type { IAgent } from '../types.js';

export type SwarmRole = 'leader' | 'worker' | 'specialist' | 'observer' | 'idle';

export interface SwarmAgentConfig {
  agentId: string;
  swarmId: string;
  innerAgent: IAgent;
  initialRole?: SwarmRole;
  maxConcurrentTasks?: number;
}

export interface TaskBid {
  agentId: string;
  taskId: string;
  confidence: number;      // 0–1 fit score
  estimatedTimeMs: number;
  capabilities: string[];
}

export interface SwarmTaskResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'error' | 'timeout';
  result?: unknown;
  error?: string;
  durationMs: number;
}

export class SwarmAgent extends EventEmitter {
  readonly agentId: string;
  readonly swarmId: string;
  readonly innerAgent: IAgent;

  private _role: SwarmRole;
  private _activeTasks = new Map<string, { taskId: string; startedAt: number }>();
  private _completedCount = 0;
  private _failedCount = 0;
  private maxConcurrent: number;

  constructor(config: SwarmAgentConfig) {
    super();
    this.agentId = config.agentId;
    this.swarmId = config.swarmId;
    this.innerAgent = config.innerAgent;
    this._role = config.initialRole ?? 'idle';
    this.maxConcurrent = config.maxConcurrentTasks ?? 3;
  }

  get role(): SwarmRole { return this._role; }
  get activeTasks(): number { return this._activeTasks.size; }
  get isAvailable(): boolean { return this._activeTasks.size < this.maxConcurrent; }
  get capabilities(): string[] { return this.innerAgent.capabilities; }

  /** Assign a new role */
  setRole(role: SwarmRole): void {
    const prev = this._role;
    this._role = role;
    logInfo('SwarmAgent', `${this.agentId} role: ${prev} → ${role}`);
    this.emit('role:changed', { agentId: this.agentId, from: prev, to: role });
  }

  /** Bid on a task based on capability match and availability */
  bid(taskId: string, requiredCapabilities: string[]): TaskBid | null {
    if (!this.isAvailable) return null;

    const matched = requiredCapabilities.filter(c => this.capabilities.includes(c));
    const confidence = requiredCapabilities.length > 0
      ? matched.length / requiredCapabilities.length
      : 0.5;

    if (confidence === 0) return null;

    return {
      agentId: this.agentId,
      taskId,
      confidence,
      estimatedTimeMs: 5000 + (1 - confidence) * 10000,
      capabilities: matched,
    };
  }

  /** Execute a task via the inner agent */
  async executeTask(taskId: string, task: string, context?: Record<string, unknown>): Promise<SwarmTaskResult> {
    const start = Date.now();
    this._activeTasks.set(taskId, { taskId, startedAt: start });
    this.emit('task:started', { agentId: this.agentId, taskId });

    try {
      const result = await this.innerAgent.execute(task, context);
      this._completedCount++;
      this._activeTasks.delete(taskId);

      const taskResult: SwarmTaskResult = {
        taskId,
        agentId: this.agentId,
        status: 'success',
        result,
        durationMs: Date.now() - start,
      };
      this.emit('task:completed', taskResult);
      return taskResult;
    } catch (err: unknown) {
      this._failedCount++;
      this._activeTasks.delete(taskId);
      const msg = err instanceof Error ? err.message : String(err);
      logWarn('SwarmAgent', `Task ${taskId} failed on ${this.agentId}: ${msg}`);

      const taskResult: SwarmTaskResult = {
        taskId,
        agentId: this.agentId,
        status: 'error',
        error: msg,
        durationMs: Date.now() - start,
      };
      this.emit('task:failed', taskResult);
      return taskResult;
    }
  }

  /** Get agent performance stats */
  getStats(): { completed: number; failed: number; active: number; successRate: number } {
    const total = this._completedCount + this._failedCount;
    return {
      completed: this._completedCount,
      failed: this._failedCount,
      active: this._activeTasks.size,
      successRate: total > 0 ? this._completedCount / total : 1,
    };
  }
}
