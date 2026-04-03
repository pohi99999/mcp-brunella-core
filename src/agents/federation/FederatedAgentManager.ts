/**
 * FederatedAgentManager — Remote agent discovery and cross-node execution
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Manages a federated registry of agents across mesh nodes.
 * Enables discovering remote agents and delegating execution to them.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn, logError } from '../../utils/logger.js';
import { trustRegistry } from '../../core/federation/trustRegistry.js';
import { phoenixEventBus } from '../../core/phoenixEventBus.js';
import { postSignedFederationJson } from '../../core/federation/remoteRequest.js';
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
  private readonly onPeerJoined: (peer: MeshNodeInfo) => void;
  private readonly onPeerLeft: (peer: MeshNodeInfo) => void;
  private readonly onPeerRevoked: (event: { peerId: string }) => void;

  constructor(meshManager: MeshManager) {
    super();
    this.meshManager = meshManager;
    this.onPeerJoined = (peer: MeshNodeInfo) => {
      void this.syncFromPeer(peer);
    };
    this.onPeerLeft = (peer: MeshNodeInfo) => {
      this.removeAgentsForNode(peer.nodeId, 'departed');
    };
    this.onPeerRevoked = ({ peerId }) => {
      this.removeAgentsForNode(peerId, 'revoked');
    };

    // Auto-update agent registry when peers change
    this.meshManager.on('peer:joined', this.onPeerJoined);
    this.meshManager.on('peer:left', this.onPeerLeft);
    phoenixEventBus.subscribe('phoenix:federation_peer_revoked', this.onPeerRevoked);
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

      const requestPath = '/api/v1/federation/execute';
      const peer = trustRegistry.getPeer(agent.nodeId) ?? trustRegistry.findPeerByEndpoint(agent.host);
      if (!peer) {
        agent.status = 'available';
        return {
          agentId: request.agentId,
          nodeId: agent.nodeId,
          status: 'error',
          error: `Federation peer metadata missing for ${agent.nodeId}`,
          executionTime: Date.now() - startTime,
        };
      }

      if (trustRegistry.checkTrust(peer.peerId) !== 'trusted') {
        agent.status = 'available';
        return {
          agentId: request.agentId,
          nodeId: agent.nodeId,
          status: 'error',
          error: `Federation peer ${peer.peerId} is not trusted`,
          executionTime: Date.now() - startTime,
        };
      }

      const peerRuntimeKeys = trustRegistry.getPeerRuntimeKeys(peer.peerId);
      if (peerRuntimeKeys.length === 0) {
        agent.status = 'available';
        return {
          agentId: request.agentId,
          nodeId: agent.nodeId,
          status: 'error',
          error: `Federation runtime key missing for ${peer.peerId}`,
          executionTime: Date.now() - startTime,
        };
      }

      const requestBody = {
        capabilityName: 'agent_execute',
        payload: {
          agentName: agent.name,
          task: request.taskType,
          context: JSON.stringify({
            ...request.input,
            fromNodeId: request.fromNodeId,
          }),
        },
      };

      const data = await postSignedFederationJson<Record<string, unknown>>({
        endpointBase: agent.host,
        path: requestPath,
        body: requestBody,
        timeoutMs,
        targetKeys: peerRuntimeKeys,
      });
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
      const trustedPeer =
        trustRegistry.getPeer(peer.nodeId) ?? trustRegistry.findPeerByEndpoint(peer.host);
      if (!trustedPeer) {
        logWarn(
          'FederatedAgentManager',
          `Skipping agent sync for ${peer.nodeId}: federation peer metadata missing`,
        );
        return;
      }

      const trustState = trustRegistry.checkTrust(trustedPeer.peerId);
      if (trustState !== 'trusted') {
        logWarn(
          'FederatedAgentManager',
          `Skipping agent sync for ${trustedPeer.peerId}: federation peer is ${trustState}`,
        );
        return;
      }

      const peerRuntimeKeys = trustRegistry.getPeerRuntimeKeys(trustedPeer.peerId);
      if (peerRuntimeKeys.length === 0) {
        logWarn(
          'FederatedAgentManager',
          `Skipping agent sync for ${trustedPeer.peerId}: federation runtime key missing`,
        );
        return;
      }

      const data = await postSignedFederationJson<{ agents?: FederatedAgent[] }>({
        endpointBase: trustedPeer.endpoint,
        path: '/api/v1/federation/agents',
        method: 'GET',
        timeoutMs: 10_000,
        targetKeys: peerRuntimeKeys,
      });

      const agents = Array.isArray(data.agents) ? data.agents : [];
      for (const agent of agents) {
        this.registerAgent({
          ...agent,
          nodeId: peer.nodeId,
          host: trustedPeer.endpoint,
        });
      }

      logInfo(
        'FederatedAgentManager',
        `Synced ${agents.length} agents from peer ${trustedPeer.peerId}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn('FederatedAgentManager', `Agent sync from ${peer.nodeId} failed: ${msg}`);
    }
  }

  dispose(): void {
    this.meshManager.off('peer:joined', this.onPeerJoined);
    this.meshManager.off('peer:left', this.onPeerLeft);
    phoenixEventBus.unsubscribe('phoenix:federation_peer_revoked', this.onPeerRevoked);
  }

  /** Remove all agents belonging to a node that left */
  private removeAgentsForNode(nodeId: string, reason: 'departed' | 'revoked' = 'departed'): void {
    let removed = 0;
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.nodeId === nodeId) {
        this.agents.delete(agentId);
        removed++;
      }
    }
    if (removed > 0) {
      const stateLabel = reason === 'revoked' ? 'revoked peer' : 'departed node';
      logInfo('FederatedAgentManager', `Removed ${removed} agents from ${stateLabel} ${nodeId}`);
    }
  }
}
