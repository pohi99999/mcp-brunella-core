/**
 * KnowledgeGraph — Unified multi-source knowledge graph
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * A lightweight in-memory knowledge graph connecting agents, capabilities,
 * tasks, sessions, and external knowledge into a queryable structure.
 */

import { EventEmitter } from 'events';
import { logInfo } from '../utils/logger.js';

export interface KGNode {
  id: string;
  type: 'agent' | 'capability' | 'task' | 'session' | 'concept' | 'resource' | 'user';
  label: string;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface KGEdge {
  id: string;
  from: string;
  to: string;
  relation: string;      // e.g. "has_capability", "assigned_to", "depends_on", "knows_about"
  weight: number;         // 0–1 strength
  properties: Record<string, unknown>;
  createdAt: number;
}

export interface KGQueryResult {
  nodes: KGNode[];
  edges: KGEdge[];
  paths?: string[][];     // node ID paths for path queries
}

export class KnowledgeGraph extends EventEmitter {
  private nodes = new Map<string, KGNode>();
  private edges = new Map<string, KGEdge>();
  private adjacency = new Map<string, Set<string>>();  // nodeId → Set<edgeId>
  private edgeCounter = 0;

  /** Add or update a node */
  upsertNode(node: Omit<KGNode, 'createdAt' | 'updatedAt'>): KGNode {
    const existing = this.nodes.get(node.id);
    const full: KGNode = {
      ...node,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    this.nodes.set(node.id, full);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
    this.emit('node:upserted', full);
    return full;
  }

  /** Remove a node and its connected edges */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) return false;

    // Remove connected edges
    const edgeIds = this.adjacency.get(nodeId);
    if (edgeIds) {
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          const otherId = edge.from === nodeId ? edge.to : edge.from;
          this.adjacency.get(otherId)?.delete(edgeId);
          this.edges.delete(edgeId);
        }
      }
    }
    this.adjacency.delete(nodeId);
    this.nodes.delete(nodeId);
    return true;
  }

  /** Add an edge between two nodes */
  addEdge(from: string, to: string, relation: string, weight = 1, properties: Record<string, unknown> = {}): KGEdge | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null;

    const edge: KGEdge = {
      id: `edge-${++this.edgeCounter}`,
      from,
      to,
      relation,
      weight,
      properties,
      createdAt: Date.now(),
    };

    this.edges.set(edge.id, edge);
    this.adjacency.get(from)!.add(edge.id);
    this.adjacency.get(to)!.add(edge.id);
    this.emit('edge:added', edge);
    return edge;
  }

  /** Remove an edge */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    this.adjacency.get(edge.from)?.delete(edgeId);
    this.adjacency.get(edge.to)?.delete(edgeId);
    this.edges.delete(edgeId);
    return true;
  }

  /** Get a node by ID */
  getNode(nodeId: string): KGNode | undefined {
    return this.nodes.get(nodeId);
  }

  /** Find nodes by type */
  findNodesByType(type: KGNode['type']): KGNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /** Find nodes by label (partial match) */
  searchNodes(query: string): KGNode[] {
    const q = query.toLowerCase();
    return Array.from(this.nodes.values()).filter(n => n.label.toLowerCase().includes(q));
  }

  /** Get edges connected to a node */
  getEdgesFor(nodeId: string): KGEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map(id => this.edges.get(id)).filter((e): e is KGEdge => !!e);
  }

  /** Get neighbors of a node (optional relation filter) */
  getNeighbors(nodeId: string, relation?: string): KGNode[] {
    const edges = this.getEdgesFor(nodeId);
    const filtered = relation ? edges.filter(e => e.relation === relation) : edges;

    const neighborIds = new Set<string>();
    for (const e of filtered) {
      if (e.from === nodeId) neighborIds.add(e.to);
      if (e.to === nodeId) neighborIds.add(e.from);
    }

    return Array.from(neighborIds).map(id => this.nodes.get(id)).filter((n): n is KGNode => !!n);
  }

  /** Find shortest path between two nodes (BFS) */
  findPath(fromId: string, toId: string, maxDepth = 6): string[] | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) return [fromId];

    const visited = new Set<string>([fromId]);
    const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth) continue;

      const neighbors = this.getNeighbors(current.nodeId);
      for (const neighbor of neighbors) {
        if (neighbor.id === toId) return [...current.path, toId];
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ nodeId: neighbor.id, path: [...current.path, neighbor.id] });
        }
      }
    }

    return null;
  }

  /** Get graph stats */
  getStats(): { nodes: number; edges: number; nodeTypes: Record<string, number> } {
    const nodeTypes: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] ?? 0) + 1;
    }
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      nodeTypes,
    };
  }
}
