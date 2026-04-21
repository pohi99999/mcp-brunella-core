/**
 * PredictiveRouter — History-aware routing with load prediction
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Extends EdgeRouter with predictive decisions based on historical
 * latency, failure rates, and load patterns.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface RouteRecord {
  capability: string;
  nodeId: string;
  latencyMs: number;
  success: boolean;
  timestamp: number;
}

export interface NodeLoadProfile {
  nodeId: string;
  avgLatencyMs: number;
  successRate: number;
  requestCount: number;
  estimatedLoad: number;   // 0–1 
  lastUpdated: number;
}

export interface PredictiveDecision {
  capability: string;
  selectedNodeId: string;
  score: number;
  reason: string;
  alternatives: Array<{ nodeId: string; score: number }>;
}

export class PredictiveRouter extends EventEmitter {
  private history: RouteRecord[] = [];
  private profiles = new Map<string, NodeLoadProfile>();
  private readonly maxHistorySize: number;
  private readonly decayWindowMs: number;

  constructor(opts?: { maxHistorySize?: number; decayWindowMs?: number }) {
    super();
    this.maxHistorySize = opts?.maxHistorySize ?? 1000;
    this.decayWindowMs = opts?.decayWindowMs ?? 300_000; // 5 min
  }

  /** Record a route outcome */
  recordOutcome(record: RouteRecord): void {
    this.history.push(record);
    if (this.history.length > this.maxHistorySize) {
      this.history.splice(0, this.history.length - this.maxHistorySize);
    }
    this.updateProfile(record.nodeId);
  }

  /** Predict the best node for a capability */
  predict(capability: string, candidateNodeIds: string[]): PredictiveDecision {
    if (candidateNodeIds.length === 0) {
      return {
        capability,
        selectedNodeId: '',
        score: 0,
        reason: 'No candidates',
        alternatives: [],
      };
    }

    const now = Date.now();
    const scored: Array<{ nodeId: string; score: number }> = [];

    for (const nodeId of candidateNodeIds) {
      const profile = this.profiles.get(nodeId);
      if (!profile) {
        scored.push({ nodeId, score: 0.5 }); // neutral for unknown
        continue;
      }

      // Score: success_rate * 0.5 + (1 - normalized_latency) * 0.3 + (1 - load) * 0.2
      const latencyScore = Math.max(0, 1 - profile.avgLatencyMs / 5000);
      const freshnessBonus = (now - profile.lastUpdated < this.decayWindowMs) ? 0 : -0.1;
      const score = profile.successRate * 0.5 + latencyScore * 0.3 + (1 - profile.estimatedLoad) * 0.2 + freshnessBonus;

      scored.push({ nodeId, score: Math.max(0, Math.min(1, score)) });
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const decision: PredictiveDecision = {
      capability,
      selectedNodeId: best.nodeId,
      score: best.score,
      reason: this.explainDecision(best.nodeId),
      alternatives: scored.slice(1),
    };

    this.emit('prediction', decision);
    return decision;
  }

  /** Get load profile for a node */
  getProfile(nodeId: string): NodeLoadProfile | undefined {
    return this.profiles.get(nodeId);
  }

  /** Get all profiles */
  getAllProfiles(): NodeLoadProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Get recent history for a capability */
  getHistory(capability?: string, limit = 50): RouteRecord[] {
    const filtered = capability
      ? this.history.filter(r => r.capability === capability)
      : this.history;
    return filtered.slice(-limit);
  }

  /** Update a node's load profile based on all historical data */
  private updateProfile(nodeId: string): void {
    const now = Date.now();
    const recentWindow = now - this.decayWindowMs;
    const nodeRecords = this.history.filter(r => r.nodeId === nodeId && r.timestamp > recentWindow);

    if (nodeRecords.length === 0) return;

    const totalLatency = nodeRecords.reduce((sum, r) => sum + r.latencyMs, 0);
    const successCount = nodeRecords.filter(r => r.success).length;

    this.profiles.set(nodeId, {
      nodeId,
      avgLatencyMs: totalLatency / nodeRecords.length,
      successRate: successCount / nodeRecords.length,
      requestCount: nodeRecords.length,
      estimatedLoad: Math.min(1, nodeRecords.length / 100), // rough load estimate
      lastUpdated: now,
    });
  }

  /** Generate human-readable explanation */
  private explainDecision(nodeId: string): string {
    const profile = this.profiles.get(nodeId);
    if (!profile) return 'No historical data — default selection';
    return `avg ${profile.avgLatencyMs.toFixed(0)}ms, ${(profile.successRate * 100).toFixed(0)}% success, load ${(profile.estimatedLoad * 100).toFixed(0)}%`;
  }
}

