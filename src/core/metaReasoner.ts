/**
 * MetaReasoner — Higher-order reasoning about the system's own decisions
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Observes agent decisions, workflow outcomes, and system metrics,
 * then reasons about *why* certain strategies work or fail,
 * producing meta-level insights and strategy recommendations.
 */

import { EventEmitter } from 'events';
import { logInfo } from '../utils/logger.js';

export interface DecisionRecord {
  id: string;
  decisionMaker: string;       // agent/swarm/kernel that decided
  action: string;               // what was decided
  context: Record<string, unknown>;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  outcomeDetails?: string;
  metrics: Record<string, number>;  // e.g. durationMs, quality, cost
  timestamp: number;
}

export interface MetaInsight {
  id: string;
  category: 'pattern' | 'anomaly' | 'recommendation' | 'warning';
  description: string;
  confidence: number;            // 0–1
  supportingDecisions: string[]; // decision IDs
  suggestedAction?: string;
  createdAt: number;
}

export interface ReasoningSession {
  sessionId: string;
  startedAt: number;
  decisionsAnalyzed: number;
  insightsProduced: number;
  completedAt?: number;
}

export class MetaReasoner extends EventEmitter {
  private decisions: DecisionRecord[] = [];
  private insights = new Map<string, MetaInsight>();
  private sessions: ReasoningSession[] = [];
  private insightCounter = 0;
  private sessionCounter = 0;

  /** Record a decision for analysis */
  recordDecision(decision: Omit<DecisionRecord, 'id' | 'timestamp'>): DecisionRecord {
    const full: DecisionRecord = {
      ...decision,
      id: `dec-${this.decisions.length + 1}-${Date.now()}`,
      timestamp: Date.now(),
    };
    this.decisions.push(full);

    // Keep last 500 decisions
    if (this.decisions.length > 500) {
      this.decisions.splice(0, this.decisions.length - 500);
    }

    this.emit('decision:recorded', full);
    return full;
  }

  /** Run a meta-reasoning session across recent decisions */
  reason(windowMs = 300_000): MetaInsight[] {
    const session: ReasoningSession = {
      sessionId: `mrs-${++this.sessionCounter}-${Date.now()}`,
      startedAt: Date.now(),
      decisionsAnalyzed: 0,
      insightsProduced: 0,
    };

    const cutoff = Date.now() - windowMs;
    const recent = this.decisions.filter(d => d.timestamp > cutoff);
    session.decisionsAnalyzed = recent.length;

    if (recent.length === 0) {
      session.completedAt = Date.now();
      this.sessions.push(session);
      return [];
    }

    const newInsights: MetaInsight[] = [];

    // Pattern: repeated failures from same maker
    const failuresByMaker = new Map<string, DecisionRecord[]>();
    for (const d of recent) {
      if (d.outcome === 'failure') {
        const list = failuresByMaker.get(d.decisionMaker) || [];
        list.push(d);
        failuresByMaker.set(d.decisionMaker, list);
      }
    }

    for (const [maker, failures] of failuresByMaker) {
      if (failures.length >= 3) {
        newInsights.push(this.createInsight(
          'pattern',
          `${maker} has ${failures.length} failures in recent window — possible systematic issue`,
          0.8,
          failures.map(f => f.id),
          `Review ${maker}'s decision strategy and inputs`
        ));
      }
    }

    // Anomaly: sudden quality drop
    const avgMetric = (records: DecisionRecord[], key: string) => {
      const vals = records.map(r => r.metrics[key]).filter((v): v is number => v !== undefined);
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    };

    const half = Math.floor(recent.length / 2);
    if (half > 2) {
      const firstHalf = recent.slice(0, half);
      const secondHalf = recent.slice(half);
      const qualityFirst = avgMetric(firstHalf, 'quality');
      const qualitySecond = avgMetric(secondHalf, 'quality');

      if (qualityFirst > 0 && qualitySecond > 0 && qualitySecond < qualityFirst * 0.7) {
        newInsights.push(this.createInsight(
          'anomaly',
          `Quality dropped ${((1 - qualitySecond / qualityFirst) * 100).toFixed(0)}% in recent decisions`,
          0.7,
          secondHalf.map(d => d.id),
          'Investigate recent system changes or load increases'
        ));
      }
    }

    // Recommendation: if success rate is high for certain actions
    const successRate = recent.filter(d => d.outcome === 'success').length / recent.length;
    if (successRate > 0.9) {
      newInsights.push(this.createInsight(
        'recommendation',
        `System performing well (${(successRate * 100).toFixed(0)}% success rate) — current strategies effective`,
        0.9,
        recent.slice(0, 5).map(d => d.id)
      ));
    }

    // Store insights
    for (const insight of newInsights) {
      this.insights.set(insight.id, insight);
      this.emit('insight', insight);
    }

    session.insightsProduced = newInsights.length;
    session.completedAt = Date.now();
    this.sessions.push(session);

    logInfo('MetaReasoner', `Session ${session.sessionId}: analyzed ${session.decisionsAnalyzed} decisions, produced ${session.insightsProduced} insights`);
    return newInsights;
  }

  /** Get all insights */
  getInsights(category?: MetaInsight['category']): MetaInsight[] {
    const all = Array.from(this.insights.values());
    if (!category) return all;
    return all.filter(i => i.category === category);
  }

  /** Get recent decisions */
  getDecisions(limit = 50): DecisionRecord[] {
    return this.decisions.slice(-limit);
  }

  /** Get session history */
  getSessions(): ReasoningSession[] {
    return [...this.sessions];
  }

  /** Get stats */
  getStats(): { decisions: number; insights: number; sessions: number } {
    return {
      decisions: this.decisions.length,
      insights: this.insights.size,
      sessions: this.sessions.length,
    };
  }

  private createInsight(
    category: MetaInsight['category'],
    description: string,
    confidence: number,
    supportingDecisions: string[],
    suggestedAction?: string
  ): MetaInsight {
    return {
      id: `mi-${++this.insightCounter}-${Date.now()}`,
      category,
      description,
      confidence,
      supportingDecisions,
      suggestedAction,
      createdAt: Date.now(),
    };
  }
}
