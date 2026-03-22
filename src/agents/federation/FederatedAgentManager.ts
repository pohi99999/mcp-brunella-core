/**
 * FederatedAgentManager — Remote agent discovery and cross-node execution
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Manages a federated registry of agents across mesh nodes.
 * Enables discovering remote agents and delegating execution to them.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn, logError } from '../../utils/logger.js';
import type { MeshNodeInfo } from '../../mesh/meshNode.js';
import type { MeshManager } from '../../mesh/meshManager.js';

export interface FederatedAgent {
  agentId: string;
  name: string;
  nodeId: string;
  host: string;
  capabilities: string[];
  status: 'available' | 'busy' | 'offline';
  lastSeen: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface RemoteExecutionRequest {
  agentId: string;
  taskType: string;
  input: Record<string, unknown>;
  fromNodeId: string;
  timeout?: number;
}

export interface RemoteExecutionResult {
  agentId: string;
  nodeId: string;
  status: 'success' | 'error' | 'timeout';
  result?: Record<string, unknown>;
  error?: string;
  executionTime: number;
}

export class FederatedAgentManager extends EventEmitter {
  private agents = new Map<string, FederatedAgent>();
  private meshManager: MeshManager;

  constructor(meshManager: MeshManager) {
    super();
    this.meshManager = meshManager;

    // Auto-update agent registry when peers change
    this.meshManager.on('peer:joined', (peer: MeshNodeInfo) => this.syncFromPeer(peer));
    this.meshManager.on('peer:left', (peer: MeshNodeInfo) => this.removeAgentsForNode(peer.nodeId));
  }

  /** Register a local or remote agent */
  registerAgent(agent: FederatedAgent): void {
    this.agents.set(agent.agentId, agent);
    logInfo('FederatedAgentManager', `Agent registered: ${agent.agentId} (${agent.name}) on node ${agent.nodeId}`);
    this.emit('agent:registered', agent);
  }

  /** Unregister an agent */
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      logInfo('FederatedAgentManager', `Agent unregistered: ${agentId}`);
      this.emit('agent:unregistered', agent);
    }
  }

  /** Find agents by capability (across all nodes) */
  findAgents(capability: string): FederatedAgent[] {
    return Array.from(this.agents.values()).filter(a =>
      a.status === 'available' && a.capabilities.includes(capability)
    );
  }

  /** Find agent by ID */
  getAgent(agentId: string): FederatedAgent | undefined {
    return this.agents.get(agentId);
  }

  /** List all federated agents */
  listAgents(): FederatedAgent[] {
    return Array.from(this.agents.values());
  }

  /** List agents on a specific node */
  listAgentsOnNode(nodeId: string): FederatedAgent[] {
    return Array.from(this.agents.values()).filter(a => a.nodeId === nodeId);
  }

  /** Execute a task on a remote agent */
  async executeRemote(request: RemoteExecutionRequest): Promise<RemoteExecutionResult> {
    const agent = this.agents.get(request.agentId);
    if (!agent) {
      return {
        agentId: request.agentId,
        nodeId: 'unknown',
        status: 'error',
        error: `Agent ${request.agentId} not found in federation`,
        executionTime: 0,
      };
    }

    if (agent.status !== 'available') {
      return {
        agentId: request.agentId,
        nodeId: agent.nodeId,
        status: 'error',
        error: `Agent ${request.agentId} is ${agent.status}`,
        executionTime: 0,
      };
    }

    const startTime = Date.now();
    const timeoutMs = request.timeout ?? 30_000;

    try {
      agent.status = 'busy';
      this.emit('agent:busy', agent);

      const url = `${agent.host}/api/v1/federation/execute`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Remote execution returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json() as Record<string, unknown>;
      agent.status = 'available';
      this.emit('agent:available', agent);

      return {
        agentId: request.agentId,
        nodeId: agent.nodeId,
        status: 'success',
        result: data,
        executionTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      agent.status = 'available';

      const isTimeout = msg.includes('abort');
      logError('FederatedAgentManager', `Remote execution failed for ${request.agentId}: ${msg}`);

      return {
        agentId: request.agentId,
        nodeId: agent.nodeId,
        status: isTimeout ? 'timeout' : 'error',
        error: msg,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /** Sync agent list from a newly joined peer */
  private async syncFromPeer(peer: MeshNodeInfo): Promise<void> {
    try {
      const url = `${peer.host}/api/v1/federation/agents`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        logWarn('FederatedAgentManager', `Failed to sync agents from ${peer.nodeId}: ${res.status}`);
        return;
      }

      const data = await res.json() as { agents: FederatedAgent[] };
      for (const agent of data.agents) {
        this.registerAgent({ ...agent, nodeId: peer.nodeId, host: peer.host });
      }

      logInfo('FederatedAgentManager', `Synced ${data.agents.length} agents from peer ${peer.nodeId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn('FederatedAgentManager', `Agent sync from ${peer.nodeId} failed: ${msg}`);
    }
  }

  /** Remove all agents belonging to a node that left */
  private removeAgentsForNode(nodeId: string): void {
    let removed = 0;
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.nodeId === nodeId) {
        this.agents.delete(agentId);
        removed++;
      }
    }
    if (removed > 0) {
      logInfo('FederatedAgentManager', `Removed ${removed} agents from departed node ${nodeId}`);
    }
  }
}
