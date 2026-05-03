/**
 * SharedCognition — PAIOS + Brunella shared reasoning and memory layer
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Provides a unified cognition layer where Brunella and PAIOS share
 * context, memory, and reasoning results across the mesh.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';

export interface CognitionEntry {
  id: string;
  source: 'brunella' | 'paios' | 'mesh' | 'user';
  category: 'fact' | 'observation' | 'decision' | 'prediction' | 'memory';
  content: string;
  confidence: number;     // 0–1
  context: Record<string, unknown>;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
}

export interface ReasoningQuery {
  question: string;
  context?: Record<string, unknown>;
  maxResults?: number;
  minConfidence?: number;
}

export interface ReasoningResult {
  query: string;
  entries: CognitionEntry[];
  synthesis: string;
  confidence: number;
  timestamp: number;
}

export class SharedCognition extends EventEmitter {
  private entries = new Map<string, CognitionEntry>();
  private entryCounter = 0;

  /** Store a cognition entry */
  store(entry: Omit<CognitionEntry, 'id' | 'createdAt'>): CognitionEntry {
    const full: CognitionEntry = {
      ...entry,
      id: `cog-${++this.entryCounter}-${Date.now()}`,
      createdAt: Date.now(),
    };
    this.entries.set(full.id, full);
    logInfo('SharedCognition', `Stored ${full.category} from ${full.source}: ${full.content.substring(0, 80)}...`);
    this.emit('entry:stored', full);
    return full;
  }

  /** Remove an entry */
  remove(entryId: string): boolean {
    return this.entries.delete(entryId);
  }

  /** Query cognition by category, tags, and confidence */
  query(query: ReasoningQuery): ReasoningResult {
    const minConf = query.minConfidence ?? 0;
    const maxResults = query.maxResults ?? 20;
    const q = query.question.toLowerCase();

    // Filter and rank entries
    const candidates = Array.from(this.entries.values())
      .filter(e => {
        if (e.confidence < minConf) return false;
        if (e.expiresAt && e.expiresAt < Date.now()) return false;
        return true;
      });

    // Score by relevance: content match + tag match + confidence
    const scored = candidates.map(e => {
      const contentMatch = e.content.toLowerCase().includes(q) ? 0.5 : 0;
      const tagMatch = e.tags.some(t => q.includes(t.toLowerCase())) ? 0.3 : 0;
      const score = contentMatch + tagMatch + e.confidence * 0.2;
      return { entry: e, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topEntries = scored.slice(0, maxResults).map(s => s.entry);

    // Simple synthesis from top results
    const synthesis = topEntries.length > 0
      ? `Found ${topEntries.length} relevant entries. Top source: ${topEntries[0].source}, category: ${topEntries[0].category}.`
      : 'No relevant cognition entries found.';

    const avgConf = topEntries.length > 0
      ? topEntries.reduce((sum, e) => sum + e.confidence, 0) / topEntries.length
      : 0;

    return {
      query: query.question,
      entries: topEntries,
      synthesis,
      confidence: avgConf,
      timestamp: Date.now(),
    };
  }

  /** Get all entries for a source */
  getBySource(source: CognitionEntry['source']): CognitionEntry[] {
    return Array.from(this.entries.values()).filter(e => e.source === source);
  }

  /** Get all entries for a category */
  getByCategory(category: CognitionEntry['category']): CognitionEntry[] {
    return Array.from(this.entries.values()).filter(e => e.category === category);
  }

  /** Purge expired entries */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.entries.delete(id);
        purged++;
      }
    }
    if (purged > 0) logInfo('SharedCognition', `Purged ${purged} expired entries`);
    return purged;
  }

  /** Get stats */
  getStats(): { total: number; bySource: Record<string, number>; byCategory: Record<string, number>; avgConfidence: number } {
    const bySource: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalConf = 0;

    for (const entry of this.entries.values()) {
      bySource[entry.source] = (bySource[entry.source] ?? 0) + 1;
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      totalConf += entry.confidence;
    }

    return {
      total: this.entries.size,
      bySource,
      byCategory,
      avgConfidence: this.entries.size > 0 ? totalConf / this.entries.size : 0,
    };
  }
}
