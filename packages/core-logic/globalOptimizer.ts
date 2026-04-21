/**
 * GlobalOptimizer — Predictive global system optimization
 * Phase 7: Autonomous Superintelligent Infrastructure
 */

import { EventEmitter } from 'events';
import { logInfo } from '@packages/utils/logger.js';

export interface OptimizationSnapshot {
  snapshotId: string;
  timestamp: number;
  throughput: number;
  latencyMs: number;
  errorRate: number;
  costPerHour: number;
  resilienceScore: number;
  autonomyScore: number;
}

export interface ForecastResult {
  windowSize: number;
  throughput: number;
  latencyMs: number;
  errorRate: number;
  costPerHour: number;
  resilienceScore: number;
  autonomyScore: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface OptimizationDirective {
  directiveId: string;
  type: 'performance' | 'cost' | 'resilience' | 'autonomy';
  target: string;
  description: string;
  expectedGain: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'executing' | 'completed';
  createdAt: number;
}

export interface OptimizationRun {
  forecast: ForecastResult;
  directives: OptimizationDirective[];
}

export class GlobalOptimizer extends EventEmitter {
  private readonly snapshots: OptimizationSnapshot[] = [];
  private readonly directives = new Map<string, OptimizationDirective>();
  private directiveCounter = 0;

  recordSnapshot(snapshot: Omit<OptimizationSnapshot, 'snapshotId' | 'timestamp'> & Partial<Pick<OptimizationSnapshot, 'snapshotId' | 'timestamp'>>): OptimizationSnapshot {
    const full: OptimizationSnapshot = {
      ...snapshot,
      snapshotId: snapshot.snapshotId ?? `gos-${this.snapshots.length + 1}-${Date.now()}`,
      timestamp: snapshot.timestamp ?? Date.now(),
    };
    this.snapshots.push(full);
    if (this.snapshots.length > 200) {
      this.snapshots.splice(0, this.snapshots.length - 200);
    }
    this.emit('snapshot:recorded', full);
    return full;
  }

  forecast(windowSize = 5): ForecastResult {
    const recent = this.snapshots.slice(-Math.max(1, windowSize));
    if (recent.length === 0) {
      return {
        windowSize,
        throughput: 0,
        latencyMs: 0,
        errorRate: 0,
        costPerHour: 0,
        resilienceScore: 0,
        autonomyScore: 0,
        trend: 'stable',
      };
    }

    const avg = (selector: (snapshot: OptimizationSnapshot) => number) => recent.reduce((sum, item) => sum + selector(item), 0) / recent.length;
    const first = recent[0];
    const last = recent[recent.length - 1];

    const trendScore =
      (last.throughput - first.throughput) * 0.3 +
      (first.latencyMs - last.latencyMs) * 0.2 +
      (first.errorRate - last.errorRate) * 100 * 0.2 +
      (first.costPerHour - last.costPerHour) * 0.1 +
      (last.resilienceScore - first.resilienceScore) * 0.1 +
      (last.autonomyScore - first.autonomyScore) * 0.1;

    return {
      windowSize: recent.length,
      throughput: avg(item => item.throughput),
      latencyMs: avg(item => item.latencyMs),
      errorRate: avg(item => item.errorRate),
      costPerHour: avg(item => item.costPerHour),
      resilienceScore: avg(item => item.resilienceScore),
      autonomyScore: avg(item => item.autonomyScore),
      trend: trendScore > 5 ? 'improving' : trendScore < -5 ? 'degrading' : 'stable',
    };
  }

  optimize(windowSize = 5): OptimizationRun {
    const forecast = this.forecast(windowSize);
    const directives: OptimizationDirective[] = [];

    if (forecast.latencyMs > 220 || forecast.errorRate > 0.05) {
      directives.push(this.createDirective(
        'performance',
        'request-path',
        `Reduce latency (${forecast.latencyMs.toFixed(0)}ms) and error rate (${(forecast.errorRate * 100).toFixed(1)}%)`,
        0.22,
        forecast.errorRate > 0.08 ? 'critical' : 'high',
      ));
    }

    if (forecast.costPerHour > 4) {
      directives.push(this.createDirective(
        'cost',
        'infra-budget',
        `Trim cost footprint from ${forecast.costPerHour.toFixed(2)}/h without sacrificing resilience`,
        0.15,
        'medium',
      ));
    }

    if (forecast.resilienceScore < 0.7) {
      directives.push(this.createDirective(
        'resilience',
        'mesh-redundancy',
        `Increase resilience score from ${forecast.resilienceScore.toFixed(2)}`,
        0.18,
        'high',
      ));
    }

    if (forecast.autonomyScore < 0.75) {
      directives.push(this.createDirective(
        'autonomy',
        'hyperkernel',
        `Raise autonomy score from ${forecast.autonomyScore.toFixed(2)} via policy + goal alignment`,
        0.12,
        'medium',
      ));
    }

    logInfo('GlobalOptimizer', `Optimization run completed: ${directives.length} directives, trend=${forecast.trend}`);
    return { forecast, directives };
  }

  updateDirectiveStatus(directiveId: string, status: OptimizationDirective['status']): boolean {
    const directive = this.directives.get(directiveId);
    if (!directive) return false;
    directive.status = status;
    this.emit('directive:status', directive);
    return true;
  }

  getSnapshots(limit = 20): OptimizationSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  getLatestSnapshot(): OptimizationSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  getDirectives(status?: OptimizationDirective['status']): OptimizationDirective[] {
    const values = Array.from(this.directives.values());
    return status ? values.filter(item => item.status === status) : values;
  }

  getStats(): { snapshots: number; directives: number; pending: number; trend: ForecastResult['trend'] } {
    const forecast = this.forecast();
    return {
      snapshots: this.snapshots.length,
      directives: this.directives.size,
      pending: this.getDirectives('pending').length,
      trend: forecast.trend,
    };
  }

  private createDirective(
    type: OptimizationDirective['type'],
    target: string,
    description: string,
    expectedGain: number,
    priority: OptimizationDirective['priority'],
  ): OptimizationDirective {
    const directive: OptimizationDirective = {
      directiveId: `god-${++this.directiveCounter}-${Date.now()}`,
      type,
      target,
      description,
      expectedGain,
      priority,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.directives.set(directive.directiveId, directive);
    this.emit('directive', directive);
    return directive;
  }
}

