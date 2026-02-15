/**
 * Scaling Service - Business logic for auto-scaling
 * Path: src/services/scalingService.ts
 * 
 * Handles:
 * - Scale-up/down decisions based on metrics
 * - Scaling policy enforcement
 * - Cooldown management
 */

import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';

export interface ScalingPolicy {
  scaleUpThreshold: {
    latencyP95Ms: number;
    errorRatePercent: number;
  };
  scaleDownThreshold: {
    latencyP95Ms: number;
    errorRatePercent: number;
    durationMinutes: number;
  };
  cooldownMinutes: number;
  minWorkers: number;
  maxWorkers: number;
}

export interface ScalingDecision {
  should_scale: boolean;
  action: 'scale_up' | 'scale_down' | 'maintain' | null;
  reason: string;
  current_workers: number;
  target_workers: number;
}

export const DEFAULT_POLICY: ScalingPolicy = {
  scaleUpThreshold: {
    latencyP95Ms: 500,
    errorRatePercent: 5
  },
  scaleDownThreshold: {
    latencyP95Ms: 100,
    errorRatePercent: 1,
    durationMinutes: 5
  },
  cooldownMinutes: 5,
  minWorkers: 2,
  maxWorkers: 10
};

export class ScalingService {
  private policies: Map<string, ScalingPolicy> = new Map();
  private lastScalingTime: Map<string, number> = new Map();

  constructor(private db: Database) {
    // Initialize with default policies for all existing fleets
    this.initializePolicies();
  }

  /**
   * Initialize policies for all existing fleets
   */
  private initializePolicies(): void {
    try {
      const stmt = this.db.prepare('SELECT id FROM cean_fleets');
      const fleets = stmt.all() as Array<{ id: string }>;

      for (const fleet of fleets) {
        if (!this.policies.has(fleet.id)) {
          this.policies.set(fleet.id, { ...DEFAULT_POLICY });
        }
      }

      logInfo('ScalingService', `Initialized policies for ${fleets.length} fleets`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingService', `initializePolicies error: ${msg}`);
    }
  }

  /**
   * Get policy for fleet
   */
  getPolicy(fleetId: string): ScalingPolicy {
    return this.policies.get(fleetId) || { ...DEFAULT_POLICY };
  }

  /**
   * Set policy for fleet
   */
  setPolicy(fleetId: string, policy: ScalingPolicy): boolean {
    try {
      this.policies.set(fleetId, policy);
      logInfo('ScalingService', `Policy updated for fleet ${fleetId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingService', `setPolicy error: ${msg}`);
      return false;
    }
  }

  /**
   * Evaluate fleet and decide if scaling is needed
   */
  evaluateAndDecide(fleetId: string): ScalingDecision {
    try {
      const policy = this.getPolicy(fleetId);

      // Check cooldown
      const lastScaling = this.lastScalingTime.get(fleetId) || 0;
      const timeSinceLastScaling = Date.now() - lastScaling;
      const cooldownMs = policy.cooldownMinutes * 60 * 1000;

      if (timeSinceLastScaling < cooldownMs) {
        return {
          should_scale: false,
          action: null,
          reason: `Cooldown period active (${((cooldownMs - timeSinceLastScaling) / 1000 / 60).toFixed(1)}m remaining)`,
          current_workers: this.getCurrentWorkerCount(fleetId),
          target_workers: this.getCurrentWorkerCount(fleetId)
        };
      }

      // Get current fleet metrics
      const avgLatencyP95 = this.getFleetAverageLatency(fleetId);
      const avgErrorRate = this.getFleetAverageErrorRate(fleetId);
      const currentWorkers = this.getCurrentWorkerCount(fleetId);

      // Check scale-up conditions
      const shouldScaleUp =
        (avgLatencyP95 >= policy.scaleUpThreshold.latencyP95Ms ||
          avgErrorRate >= policy.scaleUpThreshold.errorRatePercent) &&
        currentWorkers < policy.maxWorkers;

      if (shouldScaleUp) {
        const reason =
          avgLatencyP95 >= policy.scaleUpThreshold.latencyP95Ms
            ? `High latency: ${avgLatencyP95.toFixed(2)}ms (threshold: ${policy.scaleUpThreshold.latencyP95Ms}ms)`
            : `High error rate: ${avgErrorRate.toFixed(2)}% (threshold: ${policy.scaleUpThreshold.errorRatePercent}%)`;

        return {
          should_scale: true,
          action: 'scale_up',
          reason,
          current_workers: currentWorkers,
          target_workers: Math.min(currentWorkers + 1, policy.maxWorkers)
        };
      }

      // Check scale-down conditions (more conservative)
      const shouldScaleDown =
        avgLatencyP95 <= policy.scaleDownThreshold.latencyP95Ms &&
        avgErrorRate <= policy.scaleDownThreshold.errorRatePercent &&
        currentWorkers > policy.minWorkers &&
        this.isLowMetricsDurationMet(fleetId, policy.scaleDownThreshold.durationMinutes);

      if (shouldScaleDown) {
        return {
          should_scale: true,
          action: 'scale_down',
          reason: `Low metrics for ${policy.scaleDownThreshold.durationMinutes}m - lat: ${avgLatencyP95.toFixed(2)}ms, err: ${avgErrorRate.toFixed(2)}%`,
          current_workers: currentWorkers,
          target_workers: Math.max(currentWorkers - 1, policy.minWorkers)
        };
      }

      return {
        should_scale: false,
        action: 'maintain',
        reason: `Metrics stable - lat: ${avgLatencyP95.toFixed(2)}ms, err: ${avgErrorRate.toFixed(2)}%`,
        current_workers: currentWorkers,
        target_workers: currentWorkers
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingService', `evaluateAndDecide error: ${msg}`);

      return {
        should_scale: false,
        action: null,
        reason: `Evaluation error: ${msg}`,
        current_workers: 0,
        target_workers: 0
      };
    }
  }

  /**
   * Execute scaling decision
   */
  executeScaling(fleetId: string, decision: ScalingDecision): boolean {
    try {
      if (!decision.should_scale || !decision.action || decision.action === 'maintain') {
        return false;
      }

      const now = new Date().toISOString();
      const eventId = `scale-${Date.now()}-${uuidv4().slice(0, 8)}`;

      const stmt = this.db.prepare(`
        INSERT INTO cean_scaling_events
        (id, fleet_id, event_type, reason, instance_count_before, instance_count_after, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
      `);

      stmt.run(
        eventId,
        fleetId,
        decision.action,
        decision.reason,
        decision.current_workers,
        decision.target_workers,
        now
      );

      // Update cooldown
      this.lastScalingTime.set(fleetId, Date.now());

      logInfo(
        'ScalingService',
        `Scaling executed: ${fleetId} ${decision.action} (${decision.current_workers} → ${decision.target_workers})`
      );

      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingService', `executeScaling error: ${msg}`);
      return false;
    }
  }

  /**
   * Get current active worker count
   */
  private getCurrentWorkerCount(fleetId: string): number {
    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM cean_workers WHERE fleet_id = ? AND status = "active"'
      );
      const result = stmt.get(fleetId) as { count: number };
      return result.count || 0;
    } catch (error: unknown) {
      logError('ScalingService', `getCurrentWorkerCount error`);
      return 0;
    }
  }

  /**
   * Get fleet average latency (p95)
   */
  private getFleetAverageLatency(fleetId: string): number {
    try {
      const stmt = this.db.prepare(`
        SELECT AVG(m.latency_p95) as avg_latency
        FROM cean_workers w
        LEFT JOIN cean_metrics_cache m ON w.id = m.worker_id
        WHERE w.fleet_id = ? AND m.timestamp >= datetime('now', '-5 minutes')
      `);
      const result = stmt.get(fleetId) as { avg_latency: number | null };
      return (result.avg_latency as number) || 0;
    } catch (error: unknown) {
      logError('ScalingService', `getFleetAverageLatency error`);
      return 0;
    }
  }

  /**
   * Get fleet average error rate
   */
  private getFleetAverageErrorRate(fleetId: string): number {
    try {
      const stmt = this.db.prepare(`
        SELECT AVG(m.error_rate) as avg_error_rate
        FROM cean_workers w
        LEFT JOIN cean_metrics_cache m ON w.id = m.worker_id
        WHERE w.fleet_id = ? AND m.timestamp >= datetime('now', '-5 minutes')
      `);
      const result = stmt.get(fleetId) as { avg_error_rate: number | null };
      return (result.avg_error_rate as number) || 0;
    } catch (error: unknown) {
      logError('ScalingService', `getFleetAverageErrorRate error`);
      return 0;
    }
  }

  /**
   * Check if low metrics have been sustained for duration
   */
  private isLowMetricsDurationMet(fleetId: string, durationMinutes: number): boolean {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as sample_count
        FROM (
          SELECT DISTINCT DATE_TRUNC('minute', m.timestamp) as minute
          FROM cean_workers w
          LEFT JOIN cean_metrics_cache m ON w.id = m.worker_id
          WHERE w.fleet_id = ?
            AND m.timestamp >= datetime('now', '-${durationMinutes} minutes')
            AND m.latency_p95 < 100
            AND m.error_rate < 1
        )
      `);

      const result = stmt.get(fleetId) as { sample_count: number };
      return (result.sample_count as number) >= durationMinutes;
    } catch (error: unknown) {
      logError('ScalingService', `isLowMetricsDurationMet error`);
      return false;
    }
  }

  /**
   * Get scaling history for fleet
   */
  getScalingHistory(fleetId: string, limit: number = 10): Record<string, unknown>[] {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          id, event_type, reason, instance_count_before, instance_count_after, status, created_at
        FROM cean_scaling_events
        WHERE fleet_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const results = stmt.all(fleetId, limit) as Record<string, unknown>[];

      return results;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingService', `getScalingHistory error: ${msg}`);
      return [];
    }
  }
}
