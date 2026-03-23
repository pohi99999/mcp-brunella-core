/**
 * GraphRAG Engine — Knowledge Graph + Entity Extraction + Contextual Retrieval
 * 
 * Builds on existing KnowledgeGraph (in-memory) + StructuredMemory (SQLite) + RAG (LanceDB/Vectorize)
 * Adds: entity extraction from conversations, relationship mapping, subgraph-based context enrichment.
 * 
 * Architecture:
 *   User message → extractEntities(gpt-4.1) → upsert KnowledgeGraph → persist to SQLite
 *   Query → subgraph retrieval → combine with vector search → enriched context for LLM
 */

import { KnowledgeGraph, type KGNode, type KGEdge } from './knowledgeGraph.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { getGlobalDb } from '../utils/globalDb.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedEntity {
  name: string;
  type: KGNode['type'] | 'company' | 'product' | 'technology' | 'person' | 'event';
  properties: Record<string, unknown>;
}

export interface ExtractedRelation {
  from: string;
  to: string;
  relation: string;
  weight: number;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  concepts: string[];
}

export interface GraphContext {
  relevantNodes: KGNode[];
  relevantEdges: KGEdge[];
  summary: string;
  entityCount: number;
  relationCount: number;
}

// ─── GraphRAG Engine ─────────────────────────────────────────────────────────

export class GraphRagEngine {
  private static instance: GraphRagEngine | null = null;
  private kg: KnowledgeGraph;
  private initialized = false;

  private constructor() {
    this.kg = new KnowledgeGraph();
  }

  static getInstance(): GraphRagEngine {
    if (!GraphRagEngine.instance) {
      GraphRagEngine.instance = new GraphRagEngine();
    }
    return GraphRagEngine.instance;
  }

  /** Initialize SQLite persistence tables */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const db = getGlobalDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS kg_nodes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          label TEXT NOT NULL,
          properties TEXT DEFAULT '{}',
          created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
        );
        CREATE TABLE IF NOT EXISTS kg_edges (
          id TEXT PRIMARY KEY,
          from_node TEXT NOT NULL,
          to_node TEXT NOT NULL,
          relation TEXT NOT NULL,
          weight REAL DEFAULT 1.0,
          properties TEXT DEFAULT '{}',
          created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
          FOREIGN KEY (from_node) REFERENCES kg_nodes(id),
          FOREIGN KEY (to_node) REFERENCES kg_nodes(id)
        );
        CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges(from_node);
        CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges(to_node);
        CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type);
        CREATE TABLE IF NOT EXISTS kg_lessons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          agent TEXT,
          task TEXT,
          lesson TEXT NOT NULL,
          quality_score REAL DEFAULT 0.5,
          created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
        );
      `);

      await this.loadFromDb();
      this.initialized = true;
      logInfo('GraphRAG', `Initialized: ${this.kg.getStats().nodes} nodes, ${this.kg.getStats().edges} edges`);
    } catch (err) {
      logError('GraphRAG', `Init failed: ${err instanceof Error ? err.message : String(err)}`);
      this.initialized = true; // still usable in-memory
    }
  }

  /** Load persisted graph from SQLite into KnowledgeGraph */
  private async loadFromDb(): Promise<void> {
    try {
      const db = getGlobalDb();
      const nodes = db.prepare('SELECT * FROM kg_nodes').all() as Array<{
        id: string; type: string; label: string; properties: string;
        created_at: number; updated_at: number;
      }>;

      for (const row of nodes) {
        this.kg.upsertNode({
          id: row.id,
          type: row.type as KGNode['type'],
          label: row.label,
          properties: JSON.parse(row.properties || '{}'),
        });
      }

      const edges = db.prepare('SELECT * FROM kg_edges').all() as Array<{
        id: string; from_node: string; to_node: string; relation: string;
        weight: number; properties: string; created_at: number;
      }>;

      for (const row of edges) {
        this.kg.addEdge(
          row.from_node,
          row.to_node,
          row.relation,
          row.weight,
          JSON.parse(row.properties || '{}'),
        );
      }
    } catch (err) {
      logWarn('GraphRAG', `DB load failed (starting empty): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Persist a node to SQLite */
  private persistNode(node: KGNode): void {
    try {
      const db = getGlobalDb();
      db.prepare(`
        INSERT OR REPLACE INTO kg_nodes (id, type, label, properties, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(node.id, node.type, node.label, JSON.stringify(node.properties), node.createdAt, node.updatedAt);
    } catch (err) {
      logWarn('GraphRAG', `Node persist failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Persist an edge to SQLite */
  private persistEdge(edge: KGEdge): void {
    try {
      const db = getGlobalDb();
      db.prepare(`
        INSERT OR REPLACE INTO kg_edges (id, from_node, to_node, relation, weight, properties, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(edge.id, edge.from, edge.to, edge.relation, edge.weight, JSON.stringify(edge.properties), edge.createdAt);
    } catch (err) {
      logWarn('GraphRAG', `Edge persist failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Extract entities and relations from a user message using pattern matching.
   * Falls back to regex-based extraction (no external API call needed).
   */
  extractEntitiesLocal(message: string): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    const relations: ExtractedRelation[] = [];
    const concepts: string[] = [];

    // Agent references
    const agentPattern = /(?:delegál|küld|feladat|kérd|agent|ágens)\s+(?:a|az)?\s*(\w+)/gi;
    let match: RegExpExecArray | null;
    while ((match = agentPattern.exec(message)) !== null) {
      entities.push({ name: match[1], type: 'agent', properties: { source: 'conversation' } });
    }

    // Technology references
    const techKeywords = [
      'typescript', 'javascript', 'python', 'react', 'vite', 'node', 'express',
      'sqlite', 'cloudflare', 'ollama', 'gemini', 'gpt', 'anthropic', 'docker',
      'github', 'mcp', 'fastapi', 'lancedb', 'vectorize', 'r2', 'kv', 'd1',
      'tailwind', 'vitest', 'playwright', 'socket.io', 'websocket',
    ];
    const lowerMsg = message.toLowerCase();
    for (const tech of techKeywords) {
      if (lowerMsg.includes(tech)) {
        entities.push({ name: tech, type: 'technology', properties: {} });
        concepts.push(tech);
      }
    }

    // Task/action detection
    const taskPatterns = [
      /(?:csinál|épít|javít|teszt|deploy|migr|implementál|refaktor)\w*/gi,
      /(?:build|test|fix|deploy|migrate|implement|refactor)\w*/gi,
    ];
    for (const pattern of taskPatterns) {
      while ((match = pattern.exec(message)) !== null) {
        concepts.push(match[0].toLowerCase());
      }
    }

    // Person/company detection (capitalized words, 2+ chars)
    const namePattern = /\b([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]{2,}(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]{2,})?)\b/g;
    while ((match = namePattern.exec(message)) !== null) {
      const name = match[1];
      const skipWords = new Set(['Rendben', 'Kérlek', 'Brunella', 'Sajnos', 'Hiba', 'Igen', 'Nem', 'Delegáltam']);
      if (!skipWords.has(name) && !techKeywords.includes(name.toLowerCase())) {
        entities.push({ name, type: 'concept', properties: { source: 'name_detection' } });
      }
    }

    return { entities, relations, concepts };
  }

  /**
   * Ingest entities and relations from a conversation turn into the graph.
   * Called after each user/assistant exchange.
   */
  async ingestConversation(sessionId: string, userMessage: string, assistantReply: string): Promise<number> {
    await this.init();

    const userExtraction = this.extractEntitiesLocal(userMessage);
    const assistantExtraction = this.extractEntitiesLocal(assistantReply);

    const allEntities = [...userExtraction.entities, ...assistantExtraction.entities];
    const allConcepts = [...new Set([...userExtraction.concepts, ...assistantExtraction.concepts])];

    let ingested = 0;

    // Upsert session node
    const sessionNode = this.kg.upsertNode({
      id: `session:${sessionId}`,
      type: 'session',
      label: `Chat session ${sessionId}`,
      properties: { lastActivity: Date.now(), messageCount: 1 },
    });
    this.persistNode(sessionNode);

    // Upsert extracted entities
    for (const entity of allEntities) {
      const nodeId = `${entity.type}:${entity.name.toLowerCase().replace(/\s+/g, '_')}`;
      const node = this.kg.upsertNode({
        id: nodeId,
        type: entity.type as KGNode['type'],
        label: entity.name,
        properties: { ...entity.properties, lastSeen: Date.now() },
      });
      this.persistNode(node);

      // Link to session
      const edge = this.kg.addEdge(`session:${sessionId}`, nodeId, 'mentioned_in', 0.8);
      if (edge) this.persistEdge(edge);
      ingested++;
    }

    // Link concepts to each other (co-occurrence)
    for (let i = 0; i < allConcepts.length; i++) {
      for (let j = i + 1; j < allConcepts.length; j++) {
        const idA = `concept:${allConcepts[i]}`;
        const idB = `concept:${allConcepts[j]}`;
        // Ensure nodes exist
        const nodeA = this.kg.getNode(idA);
        const nodeB = this.kg.getNode(idB);
        if (nodeA && nodeB) {
          const edge = this.kg.addEdge(idA, idB, 'co_occurs_with', 0.5);
          if (edge) this.persistEdge(edge);
        }
      }
    }

    if (ingested > 0) {
      logInfo('GraphRAG', `Ingested ${ingested} entities from session ${sessionId}`);
    }
    return ingested;
  }

  /**
   * Store a lesson learned (from ReflectionEngine).
   */
  storeLesson(sessionId: string, agent: string, task: string, lesson: string, qualityScore: number): void {
    try {
      const db = getGlobalDb();
      db.prepare(`
        INSERT INTO kg_lessons (session_id, agent, task, lesson, quality_score)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, agent, task, lesson, qualityScore);
      logInfo('GraphRAG', `Lesson stored: [${agent}] ${lesson.slice(0, 60)}...`);
    } catch (err) {
      logWarn('GraphRAG', `Lesson store failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get relevant lessons for a task/agent combination.
   */
  getLessons(agent?: string, limit = 5): Array<{ lesson: string; quality_score: number; agent: string; task: string }> {
    try {
      const db = getGlobalDb();
      if (agent) {
        return db.prepare(
          'SELECT lesson, quality_score, agent, task FROM kg_lessons WHERE agent = ? ORDER BY quality_score DESC, created_at DESC LIMIT ?'
        ).all(agent, limit) as Array<{ lesson: string; quality_score: number; agent: string; task: string }>;
      }
      return db.prepare(
        'SELECT lesson, quality_score, agent, task FROM kg_lessons ORDER BY quality_score DESC, created_at DESC LIMIT ?'
      ).all(limit) as Array<{ lesson: string; quality_score: number; agent: string; task: string }>;
    } catch {
      return [];
    }
  }

  /**
   * Query the knowledge graph for context relevant to a message.
   * Returns a subgraph of related nodes + edges + a text summary for system prompt injection.
   */
  queryContext(message: string, maxNodes = 15): GraphContext {
    const extraction = this.extractEntitiesLocal(message);
    const relevantNodes: KGNode[] = [];
    const relevantEdges: KGEdge[] = [];
    const seenNodeIds = new Set<string>();

    // Search by entity names
    for (const entity of extraction.entities) {
      const found = this.kg.searchNodes(entity.name);
      for (const node of found) {
        if (!seenNodeIds.has(node.id) && relevantNodes.length < maxNodes) {
          relevantNodes.push(node);
          seenNodeIds.add(node.id);

          // Get neighbors (1-hop subgraph)
          const neighbors = this.kg.getNeighbors(node.id);
          for (const neighbor of neighbors.slice(0, 3)) {
            if (!seenNodeIds.has(neighbor.id) && relevantNodes.length < maxNodes) {
              relevantNodes.push(neighbor);
              seenNodeIds.add(neighbor.id);
            }
          }

          // Collect edges
          const edges = this.kg.getEdgesFor(node.id);
          for (const edge of edges) {
            if (seenNodeIds.has(edge.from) && seenNodeIds.has(edge.to)) {
              relevantEdges.push(edge);
            }
          }
        }
      }
    }

    // Search by concepts
    for (const concept of extraction.concepts) {
      const found = this.kg.searchNodes(concept);
      for (const node of found.slice(0, 2)) {
        if (!seenNodeIds.has(node.id) && relevantNodes.length < maxNodes) {
          relevantNodes.push(node);
          seenNodeIds.add(node.id);
        }
      }
    }

    // Build text summary for system prompt
    const summaryParts: string[] = [];
    if (relevantNodes.length > 0) {
      const nodesSummary = relevantNodes
        .slice(0, 10)
        .map(n => `${n.label} (${n.type})`)
        .join(', ');
      summaryParts.push(`Kapcsolódó entitások: ${nodesSummary}`);
    }

    if (relevantEdges.length > 0) {
      const edgesSummary = relevantEdges
        .slice(0, 5)
        .map(e => {
          const fromNode = this.kg.getNode(e.from);
          const toNode = this.kg.getNode(e.to);
          return `${fromNode?.label ?? e.from} —[${e.relation}]→ ${toNode?.label ?? e.to}`;
        })
        .join('; ');
      summaryParts.push(`Kapcsolatok: ${edgesSummary}`);
    }

    // Add recent lessons
    const lessons = this.getLessons(undefined, 3);
    if (lessons.length > 0) {
      const lessonsSummary = lessons.map(l => `[${l.agent}] ${l.lesson}`).join('; ');
      summaryParts.push(`Korábbi tanulságok: ${lessonsSummary}`);
    }

    return {
      relevantNodes,
      relevantEdges,
      summary: summaryParts.length > 0
        ? `\n📊 GraphRAG Kontextus:\n${summaryParts.join('\n')}`
        : '',
      entityCount: relevantNodes.length,
      relationCount: relevantEdges.length,
    };
  }

  /** Get graph statistics */
  getStats(): { nodes: number; edges: number; nodeTypes: Record<string, number>; lessons: number } {
    const kgStats = this.kg.getStats();
    let lessons = 0;
    try {
      const db = getGlobalDb();
      const row = db.prepare('SELECT COUNT(*) as cnt FROM kg_lessons').get() as { cnt: number };
      lessons = row.cnt;
    } catch { /* empty */ }

    return { ...kgStats, lessons };
  }

  /** Get underlying KnowledgeGraph for direct access */
  getKnowledgeGraph(): KnowledgeGraph { return this.kg; }
}
