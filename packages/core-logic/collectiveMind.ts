/**
 * CollectiveMind — Shared collective reasoning across the agent ecosystem
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Aggregates insights from all agents, swarms, and subsystems into a
 * shared reasoning layer. Provides consensus-building, conflict detection,
 * and synthesized perspectives for complex decisions.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface Perspective {
  id: string;
  sourceId: string;            // agent, swarm, or subsystem ID
  sourceType: 'agent' | 'swarm' | 'subsystem' | 'user';
  topic: string;
  stance: string;              // the position or insight
  confidence: number;          // 0–1
  evidence: string[];
  tags: string[];
  createdAt: number;
}

export interface ConsensusResult {
  topic: string;
  perspectives: Perspective[];
  consensusReached: boolean;
  dominantStance: string;
  avgConfidence: number;
  conflictingViews: Array<{ a: Perspective; b: Perspective; reason: string }>;
  synthesis: string;
  timestamp: number;
}

export interface CollectiveQuery {
  topic: string;
  context?: Record<string, unknown>;
  minConfidence?: number;
  maxPerspectives?: number;
}

export class CollectiveMind extends EventEmitter {
  private perspectives = new Map<string, Perspective>();
  private perspectiveCounter = 0;

  /** Submit a perspective from any source */
  submit(input: Omit<Perspective, 'id' | 'createdAt'>): Perspective {
    const perspective: Perspective = {
      ...input,
      id: `persp-${++this.perspectiveCounter}-${Date.now()}`,
      createdAt: Date.now(),
    };
    this.perspectives.set(perspective.id, perspective);
    logInfo('CollectiveMind', `Perspective from ${input.sourceId} on "${input.topic}": ${input.stance.substring(0, 60)}`);
    this.emit('perspective:submitted', perspective);
    return perspective;
  }

  /** Remove a perspective */
  remove(perspectiveId: string): boolean {
    return this.perspectives.delete(perspectiveId);
  }

  /** Build consensus on a topic */
  buildConsensus(query: CollectiveQuery): ConsensusResult {
    const minConf = query.minConfidence ?? 0;
    const maxP = query.maxPerspectives ?? 50;
    const topicLower = query.topic.toLowerCase();

    // Gather relevant perspectives
    const relevant = Array.from(this.perspectives.values())
      .filter(p => {
        if (p.confidence < minConf) return false;
        const matches = p.topic.toLowerCase().includes(topicLower) ||
          p.tags.some(t => topicLower.includes(t.toLowerCase()));
        return matches;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxP);

    if (relevant.length === 0) {
      return {
        topic: query.topic,
        perspectives: [],
        consensusReached: false,
        dominantStance: '',
        avgConfidence: 0,
        conflictingViews: [],
        synthesis: 'No relevant perspectives found.',
        timestamp: Date.now(),
      };
    }

    // Group by stance similarity (simple string-based grouping)
    const stanceGroups = new Map<string, Perspective[]>();
    for (const p of relevant) {
      const key = p.stance.toLowerCase().substring(0, 30);
      const group = stanceGroups.get(key) || [];
      group.push(p);
      stanceGroups.set(key, group);
    }

    // Find dominant stance
    let dominantKey = '';
    let dominantCount = 0;
    for (const [key, group] of stanceGroups) {
      if (group.length > dominantCount) {
        dominantCount = group.length;
        dominantKey = key;
      }
    }

    const dominantStance = stanceGroups.get(dominantKey)?.[0]?.stance ?? '';
    const avgConfidence = relevant.reduce((s, p) => s + p.confidence, 0) / relevant.length;

    // Detect conflicts: perspectives on same topic with very different stances
    const conflicts: Array<{ a: Perspective; b: Perspective; reason: string }> = [];
    const groups = Array.from(stanceGroups.values());
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        conflicts.push({
          a: groups[i][0],
          b: groups[j][0],
          reason: `Different stances: "${groups[i][0].stance.substring(0, 40)}" vs "${groups[j][0].stance.substring(0, 40)}"`,
        });
      }
    }

    const consensusReached = stanceGroups.size === 1 || (dominantCount / relevant.length) >= 0.7;

    const synthesis = consensusReached
      ? `Consensus reached: "${dominantStance}" (${dominantCount}/${relevant.length} perspectives, avg confidence ${avgConfidence.toFixed(2)})`
      : `No consensus: ${stanceGroups.size} distinct stances across ${relevant.length} perspectives`;

    const result: ConsensusResult = {
      topic: query.topic,
      perspectives: relevant,
      consensusReached,
      dominantStance,
      avgConfidence,
      conflictingViews: conflicts,
      synthesis,
      timestamp: Date.now(),
    };

    this.emit('consensus:built', result);
    return result;
  }

  /** Get perspectives for a specific source */
  getBySource(sourceId: string): Perspective[] {
    return Array.from(this.perspectives.values()).filter(p => p.sourceId === sourceId);
  }

  /** Get all perspectives on a topic */
  getByTopic(topic: string): Perspective[] {
    const t = topic.toLowerCase();
    return Array.from(this.perspectives.values()).filter(p => p.topic.toLowerCase().includes(t));
  }

  /** Get stats */
  getStats(): { total: number; bySouce: Record<string, number>; avgConfidence: number; topics: number } {
    const bySource: Record<string, number> = {};
    const topics = new Set<string>();
    let totalConf = 0;

    for (const p of this.perspectives.values()) {
      bySource[p.sourceType] = (bySource[p.sourceType] ?? 0) + 1;
      topics.add(p.topic);
      totalConf += p.confidence;
    }

    return {
      total: this.perspectives.size,
      bySouce: bySource,
      avgConfidence: this.perspectives.size > 0 ? totalConf / this.perspectives.size : 0,
      topics: topics.size,
    };
  }
}

