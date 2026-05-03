/**
 * BrunellaKernel — Meta-level orchestration and system optimization
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * The Kernel is the highest-level coordinator: it observes the entire
 * system (agents, mesh, swarms, flows) and makes meta-decisions about
 * optimization, healing, scaling, and resource allocation.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';

export interface SystemSnapshot {
  timestamp: number;
  agents: { total: number; active: number; idle: number };
  mesh: { nodes: number; healthyNodes: number };
  swarms: { colonies: number; activeColonies: number };
  flows: { registered: number; avgDurationMs: number };
  cognition: { entries: number; avgConfidence: number };
  health: 'optimal' | 'good' | 'degraded' | 'critical';
}

export interface KernelDirective {
  id: string;
  type: 'optimize' | 'heal' | 'scale' | 'rebalance' | 'alert';
  target: string;           // what component to act on
  action: string;           // specific action description
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  result?: string;
}

export interface KernelConfig {
  snapshotIntervalMs: number;
  autoOptimize: boolean;
  degradedThreshold: number;    // 0–1, ratio below which system is degraded
}

const DEFAULT_CONFIG: KernelConfig = {
  snapshotIntervalMs: 30_000,
  autoOptimize: true,
  degradedThreshold: 0.7,
};

export class BrunellaKernel extends EventEmitter {
  private config: KernelConfig;
  private snapshots: SystemSnapshot[] = [];
  private directives: KernelDirective[] = [];
  private directiveCounter = 0;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotProvider: (() => SystemSnapshot) | null = null;

  constructor(config?: Partial<KernelConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Set the snapshot provider function (injected by the system) */
  setSnapshotProvider(provider: () => SystemSnapshot): void {
    this.snapshotProvider = provider;
  }

  /** Start the kernel's observation loop */
  start(): void {
    if (this.snapshotProvider) {
      this.snapshotTimer = setInterval(() => {
        const snapshot = this.takeSnapshot();
        if (snapshot && this.config.autoOptimize) {
          this.evaluate(snapshot);
        }
      }, this.config.snapshotIntervalMs);
    }
    logInfo('BrunellaKernel', 'Kernel started (meta-orchestration active)');
    this.emit('kernel:started');
  }

  /** Stop the kernel */
  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    logInfo('BrunellaKernel', 'Kernel stopped');
    this.emit('kernel:stopped');
  }

  /** Take a system snapshot */
  takeSnapshot(): SystemSnapshot | null {
    if (!this.snapshotProvider) return null;

    const snapshot = this.snapshotProvider();
    this.snapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.splice(0, this.snapshots.length - 100);
    }

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  /** Evaluate a snapshot and generate directives */
  evaluate(snapshot: SystemSnapshot): KernelDirective[] {
    const newDirectives: KernelDirective[] = [];

    // Check mesh health
    if (snapshot.mesh.nodes > 0) {
      const healthRatio = snapshot.mesh.healthyNodes / snapshot.mesh.nodes;
      if (healthRatio < this.config.degradedThreshold) {
        newDirectives.push(this.createDirective(
          'heal', 'mesh', `Mesh health at ${(healthRatio * 100).toFixed(0)}% — trigger healing`, 'high'
        ));
      }
    }

    // Check agent utilization
    if (snapshot.agents.total > 0) {
      const idleRatio = snapshot.agents.idle / snapshot.agents.total;
      if (idleRatio > 0.8 && snapshot.swarms.activeColonies > 0) {
        newDirectives.push(this.createDirective(
          'rebalance', 'agents', `${(idleRatio * 100).toFixed(0)}% agents idle — suggest rebalance`, 'medium'
        ));
      }
    }

    // Check system health
    if (snapshot.health === 'critical') {
      newDirectives.push(this.createDirective(
        'alert', 'system', 'System in CRITICAL state — immediate attention required', 'critical'
      ));
    }

    for (const d of newDirectives) {
      this.directives.push(d);
      this.emit('directive', d);
    }

    return newDirectives;
  }

  /** Create a directive */
  createDirective(
    type: KernelDirective['type'],
    target: string,
    action: string,
    priority: KernelDirective['priority']
  ): KernelDirective {
    return {
      id: `kd-${++this.directiveCounter}-${Date.now()}`,
      type,
      target,
      action,
      priority,
      status: 'pending',
      createdAt: Date.now(),
    };
  }

  /** Complete a directive */
  completeDirective(directiveId: string, result?: string): boolean {
    const d = this.directives.find(d => d.id === directiveId);
    if (!d) return false;
    d.status = 'completed';
    d.completedAt = Date.now();
    d.result = result;
    this.emit('directive:completed', d);
    return true;
  }

  /** Get latest snapshot */
  getLatestSnapshot(): SystemSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /** Get snapshot history */
  getSnapshotHistory(limit = 10): SystemSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /** Get all directives */
  getDirectives(status?: KernelDirective['status']): KernelDirective[] {
    if (!status) return [...this.directives];
    return this.directives.filter(d => d.status === status);
  }

  /** Get kernel stats */
  getStats(): { snapshots: number; directives: number; pending: number; health: string } {
    const latest = this.getLatestSnapshot();
    return {
      snapshots: this.snapshots.length,
      directives: this.directives.length,
      pending: this.directives.filter(d => d.status === 'pending').length,
      health: latest?.health ?? 'unknown',
    };
  }
}
