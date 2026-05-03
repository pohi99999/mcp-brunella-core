/**
 * TopologyAI — AI-driven mesh topology optimization
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Analyzes the mesh graph, detects bottlenecks, single-points-of-failure,
 * and over/under-utilized nodes. Proposes topology changes to improve
 * resilience, latency, and throughput.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';

export interface TopologyNode {
  nodeId: string;
  region: string;
  capabilities: string[];
  connections: string[];          // connected node IDs
  load: number;                   // 0–1
  latencyMs: number;              // avg round-trip
  uptime: number;                 // 0–1 ratio
}

export interface TopologyProposal {
  id: string;
  type: 'add_link' | 'remove_link' | 'rebalance' | 'add_node' | 'isolate_node';
  sourceNodeId?: string;
  targetNodeId?: string;
  reason: string;
  expectedImprovement: string;
  priority: 'low' | 'medium' | 'high';
  status: 'proposed' | 'accepted' | 'applied' | 'rejected';
  createdAt: number;
}

export interface TopologyAnalysis {
  totalNodes: number;
  totalLinks: number;
  avgConnectivity: number;        // avg connections per node
  avgLoad: number;
  bottlenecks: string[];          // node IDs with very high load or critical position
  isolatedNodes: string[];        // nodes with 0 or 1 connections
  proposals: TopologyProposal[];
  timestamp: number;
}

export class TopologyAI extends EventEmitter {
  private nodes = new Map<string, TopologyNode>();
  private proposals: TopologyProposal[] = [];
  private proposalCounter = 0;

  /** Register or update a topology node */
  upsertNode(node: TopologyNode): void {
    this.nodes.set(node.nodeId, node);
  }

  /** Remove a node from topology */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    // Clean connections referencing removed node
    for (const n of this.nodes.values()) {
      n.connections = n.connections.filter(c => c !== nodeId);
    }
  }

  /** Run a full topology analysis and generate proposals */
  analyze(): TopologyAnalysis {
    const allNodes = Array.from(this.nodes.values());
    if (allNodes.length === 0) {
      return {
        totalNodes: 0, totalLinks: 0, avgConnectivity: 0, avgLoad: 0,
        bottlenecks: [], isolatedNodes: [], proposals: [], timestamp: Date.now(),
      };
    }

    const totalLinks = allNodes.reduce((s, n) => s + n.connections.length, 0) / 2;
    const avgConnectivity = allNodes.reduce((s, n) => s + n.connections.length, 0) / allNodes.length;
    const avgLoad = allNodes.reduce((s, n) => s + n.load, 0) / allNodes.length;

    // Detect bottlenecks: high load + many connections (critical hub)
    const bottlenecks = allNodes
      .filter(n => n.load > 0.8 || (n.connections.length > avgConnectivity * 2 && n.load > 0.5))
      .map(n => n.nodeId);

    // Detect isolated nodes
    const isolatedNodes = allNodes
      .filter(n => n.connections.length <= 1)
      .map(n => n.nodeId);

    const newProposals: TopologyProposal[] = [];

    // Propose links for isolated nodes
    for (const nodeId of isolatedNodes) {
      const node = this.nodes.get(nodeId)!;
      const bestPeer = this.findBestPeer(node, allNodes);
      if (bestPeer) {
        newProposals.push(this.createProposal(
          'add_link', nodeId, bestPeer.nodeId,
          `Node ${nodeId} has only ${node.connections.length} connection(s)`,
          'Improved resilience and redundancy',
          'high'
        ));
      }
    }

    // Propose rebalancing for bottlenecks
    for (const nodeId of bottlenecks) {
      newProposals.push(this.createProposal(
        'rebalance', nodeId, undefined,
        `Node ${nodeId} is overloaded (load=${this.nodes.get(nodeId)!.load.toFixed(2)})`,
        'Reduced load and improved latency',
        'medium'
      ));
    }

    // Store proposals
    for (const p of newProposals) {
      this.proposals.push(p);
      this.emit('proposal', p);
    }

    const analysis: TopologyAnalysis = {
      totalNodes: allNodes.length,
      totalLinks,
      avgConnectivity,
      avgLoad,
      bottlenecks,
      isolatedNodes,
      proposals: newProposals,
      timestamp: Date.now(),
    };

    this.emit('analysis:complete', analysis);
    logInfo('TopologyAI', `Analysis: ${allNodes.length} nodes, ${totalLinks} links, ${bottlenecks.length} bottlenecks, ${newProposals.length} proposals`);
    return analysis;
  }

  /** Accept a proposal */
  acceptProposal(proposalId: string): boolean {
    const p = this.proposals.find(p => p.id === proposalId);
    if (!p || p.status !== 'proposed') return false;
    p.status = 'accepted';
    this.emit('proposal:accepted', p);
    return true;
  }

  /** Apply a proposal (simulate topology change) */
  applyProposal(proposalId: string): boolean {
    const p = this.proposals.find(p => p.id === proposalId);
    if (!p || (p.status !== 'accepted' && p.status !== 'proposed')) return false;

    if (p.type === 'add_link' && p.sourceNodeId && p.targetNodeId) {
      const src = this.nodes.get(p.sourceNodeId);
      const tgt = this.nodes.get(p.targetNodeId);
      if (src && tgt) {
        if (!src.connections.includes(p.targetNodeId)) src.connections.push(p.targetNodeId);
        if (!tgt.connections.includes(p.sourceNodeId)) tgt.connections.push(p.sourceNodeId);
      }
    } else if (p.type === 'isolate_node' && p.sourceNodeId) {
      this.removeNode(p.sourceNodeId);
    }

    p.status = 'applied';
    this.emit('proposal:applied', p);
    logInfo('TopologyAI', `Proposal ${proposalId} applied: ${p.type}`);
    return true;
  }

  /** Get all proposals */
  getProposals(status?: TopologyProposal['status']): TopologyProposal[] {
    if (!status) return [...this.proposals];
    return this.proposals.filter(p => p.status === status);
  }

  /** Get a specific node */
  getNode(nodeId: string): TopologyNode | undefined {
    return this.nodes.get(nodeId);
  }

  /** List all nodes */
  listNodes(): TopologyNode[] {
    return Array.from(this.nodes.values());
  }

  /** Find the best peer to connect an isolated node to */
  private findBestPeer(node: TopologyNode, allNodes: TopologyNode[]): TopologyNode | undefined {
    return allNodes
      .filter(n => n.nodeId !== node.nodeId && !node.connections.includes(n.nodeId))
      .sort((a, b) => {
        // Prefer same region, low load, high uptime
        const regionA = a.region === node.region ? 1 : 0;
        const regionB = b.region === node.region ? 1 : 0;
        const scoreA = regionA * 0.4 + (1 - a.load) * 0.3 + a.uptime * 0.3;
        const scoreB = regionB * 0.4 + (1 - b.load) * 0.3 + b.uptime * 0.3;
        return scoreB - scoreA;
      })[0];
  }

  private createProposal(
    type: TopologyProposal['type'],
    sourceNodeId: string,
    targetNodeId: string | undefined,
    reason: string,
    expectedImprovement: string,
    priority: TopologyProposal['priority']
  ): TopologyProposal {
    return {
      id: `tp-${++this.proposalCounter}-${Date.now()}`,
      type,
      sourceNodeId,
      targetNodeId,
      reason,
      expectedImprovement,
      priority,
      status: 'proposed',
      createdAt: Date.now(),
    };
  }
}
