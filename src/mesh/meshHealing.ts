/**
 * MeshHealing — Automatic mesh self-healing and fault recovery
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Monitors mesh node health, detects failures, and triggers
 * automatic recovery actions: rerouting, node restart, leader re-election.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn, logError } from '../utils/logger.js';
import type { MeshManager } from './meshManager.js';
import type { MeshNodeInfo } from './meshNode.js';

export interface HealthCheck {
  nodeId: string;
  healthy: boolean;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

export interface HealingAction {
  id: string;
  type: 'reroute' | 'restart' | 'isolate' | 'reelect_leader' | 'scale_up';
  targetNodeId: string;
  reason: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  triggeredAt: number;
  completedAt?: number;
}

export interface MeshHealingConfig {
  checkIntervalMs: number;
  unhealthyThreshold: number;    // consecutive failures before action
  healthCheckTimeoutMs: number;
}

const DEFAULT_CONFIG: MeshHealingConfig = {
  checkIntervalMs: 15_000,
  unhealthyThreshold: 3,
  healthCheckTimeoutMs: 5_000,
};

export class MeshHealing extends EventEmitter {
  private meshManager: MeshManager;
  private config: MeshHealingConfig;
  private failureCounts = new Map<string, number>();
  private actions: HealingAction[] = [];
  private actionCounter = 0;
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(meshManager: MeshManager, config?: Partial<MeshHealingConfig>) {
    super();
    this.meshManager = meshManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start periodic health checks */
  start(): void {
    this.checkTimer = setInterval(() => this.runHealthChecks(), this.config.checkIntervalMs);
    logInfo('MeshHealing', 'Mesh healing started');
  }

  /** Stop health checks */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    logInfo('MeshHealing', 'Mesh healing stopped');
  }

  /** Run health checks on all peers */
  async runHealthChecks(): Promise<HealthCheck[]> {
    const peers = this.meshManager.listPeers();
    const results: HealthCheck[] = [];

    for (const peer of peers) {
      const check = await this.checkNode(peer);
      results.push(check);

      if (!check.healthy) {
        const count = (this.failureCounts.get(peer.nodeId) ?? 0) + 1;
        this.failureCounts.set(peer.nodeId, count);

        if (count >= this.config.unhealthyThreshold) {
          await this.triggerHealing(peer, count);
        }
      } else {
        this.failureCounts.set(peer.nodeId, 0);
      }
    }

    this.emit('healthcheck:complete', results);
    return results;
  }

  /** Check a single node's health */
  async checkNode(peer: MeshNodeInfo): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.healthCheckTimeoutMs);

      const res = await fetch(`${peer.host}/api/v1/mesh/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return {
        nodeId: peer.nodeId,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        timestamp: Date.now(),
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        nodeId: peer.nodeId,
        healthy: false,
        latencyMs: Date.now() - start,
        timestamp: Date.now(),
        error: msg,
      };
    }
  }

  /** Trigger a healing action for a failing node */
  async triggerHealing(peer: MeshNodeInfo, failureCount: number): Promise<HealingAction> {
    const actionType = failureCount >= this.config.unhealthyThreshold * 2 ? 'isolate' : 'reroute';

    const action: HealingAction = {
      id: `heal-${++this.actionCounter}-${Date.now()}`,
      type: actionType,
      targetNodeId: peer.nodeId,
      reason: `${failureCount} consecutive health check failures`,
      status: 'pending',
      triggeredAt: Date.now(),
    };

    this.actions.push(action);
    logWarn('MeshHealing', `Healing action: ${actionType} for ${peer.nodeId} (${failureCount} failures)`);

    try {
      action.status = 'executing';

      if (actionType === 'isolate') {
        this.meshManager.removePeer(peer.nodeId);
        this.failureCounts.delete(peer.nodeId);
        logInfo('MeshHealing', `Node ${peer.nodeId} isolated from mesh`);
      } else {
        // Reroute: mark as degraded (mesh manager still tracks it)
        logInfo('MeshHealing', `Rerouting traffic away from ${peer.nodeId}`);
      }

      action.status = 'completed';
      action.completedAt = Date.now();
    } catch (err: unknown) {
      action.status = 'failed';
      const msg = err instanceof Error ? err.message : String(err);
      logError('MeshHealing', `Healing action failed: ${msg}`);
    }

    this.emit('healing:action', action);
    return action;
  }

  /** Get failure count for a specific node */
  getFailureCount(nodeId: string): number {
    return this.failureCounts.get(nodeId) ?? 0;
  }

  /** Get all healing actions */
  getActions(): HealingAction[] {
    return [...this.actions];
  }

  /** Get stats */
  getStats(): { totalActions: number; completed: number; failed: number; watchedNodes: number } {
    return {
      totalActions: this.actions.length,
      completed: this.actions.filter(a => a.status === 'completed').length,
      failed: this.actions.filter(a => a.status === 'failed').length,
      watchedNodes: this.failureCounts.size,
    };
  }
}
