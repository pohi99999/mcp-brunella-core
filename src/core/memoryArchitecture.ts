// src/core/memoryArchitecture.ts
// 4-layer unified memory for L5 autonomous agents

import Database from 'better-sqlite3';
import path from 'path';
import { searchRAG } from '../utils/rag.js';

export interface UnifiedMemoryResult {
  working: unknown[];
  episodic: unknown[];
  semantic: unknown[];
  procedural: unknown[];
}

// Layer 1: Working memory — in-process ring buffer (fast, session-scoped)
class WorkingMemory {
  private buffer: Array<{ query: string; content: string; ts: number }> = [];
  private readonly maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  add(query: string, content: string) {
    this.buffer.push({ query, content, ts: Date.now() });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  search(query: string): unknown[] {
    const q = query.toLowerCase();
    return this.buffer
      .filter(e => e.query.toLowerCase().includes(q) || e.content.toLowerCase().includes(q))
      .slice(-5)
      .map(e => e.content);
  }
}

// Layer 2: Episodic memory — SQLite audit log ("what happened")
class EpisodicMemory {
  search(query: string): unknown[] {
    try {
      const db = new Database(path.join(process.cwd(), 'data', 'audit.db'), { readonly: true });
      const rows = db.prepare(
        `SELECT payload FROM audit_log WHERE payload LIKE ? ORDER BY created_at DESC LIMIT 5`
      ).all(`%${query}%`);
      db.close();
      return rows;
    } catch {
      return [];
    }
  }
}

// Layer 3: Semantic memory — LanceDB vector search ("what I know")
class SemanticMemory {
  async search(query: string): Promise<unknown[]> {
    try {
      return await searchRAG(query, 5);
    } catch {
      return [];
    }
  }
}

// Layer 4: Procedural memory — Golden Dataset JSONL ("how to do it")
import { readFileSync, existsSync } from 'fs';

class ProceduralMemory {
  search(query: string): unknown[] {
    try {
      const file = path.join(process.cwd(), 'myai', 'incubator', 'training_data.jsonl');
      if (!existsSync(file)) return [];
      const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
      const q = query.toLowerCase();
      return lines
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter((e): e is Record<string, unknown> => e !== null)
        .filter(e => JSON.stringify(e).toLowerCase().includes(q))
        .slice(0, 3);
    } catch {
      return [];
    }
  }
}

export class FourLayerMemory {
  readonly working = new WorkingMemory(50);
  private readonly episodic = new EpisodicMemory();
  private readonly semantic = new SemanticMemory();
  private readonly procedural = new ProceduralMemory();

  /** Parallel recall from all 4 layers */
  async recall(query: string): Promise<UnifiedMemoryResult> {
    const [episodic, semantic] = await Promise.all([
      Promise.resolve(this.episodic.search(query)),
      this.semantic.search(query),
    ]);
    return {
      working: this.working.search(query),
      episodic,
      semantic,
      procedural: this.procedural.search(query),
    };
  }

  /** Flatten all layers into a single context string for LLM prompts */
  async recallAsContext(query: string): Promise<string> {
    const r = await this.recall(query);
    const parts: string[] = [];
    if (r.working.length) parts.push(`Working: ${JSON.stringify(r.working)}`);
    if (r.episodic.length) parts.push(`Episodic: ${JSON.stringify(r.episodic)}`);
    if (r.semantic.length) parts.push(`Semantic: ${JSON.stringify(r.semantic)}`);
    if (r.procedural.length) parts.push(`Procedural: ${JSON.stringify(r.procedural)}`);
    return parts.join('\n');
  }
}
