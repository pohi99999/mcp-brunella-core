/**
 * MeshManager — Peer discovery, registration, and health monitoring
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Manages the set of known peers, handles join/leave, syncs capabilities,
 * and exposes the full mesh topology.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '../utils/logger.js';
import { MeshNode, type MeshNodeInfo, type PeerMessage } from './meshNode.js';

const PRUNE_INTERVAL_MS = 30_000;

export class MeshManager extends EventEmitter {
  private localNode: MeshNode;
  private peers = new Map<string, MeshNodeInfo>();
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(localNode: MeshNode) {
    super();
    this.localNode = localNode;

    // Forward local heartbeat to peers
    this.localNode.on('heartbeat', (info: MeshNodeInfo) => {
      this.broadcastToPeers({
        from: this.localNode.nodeId,
        to: '*',
        type: 'heartbeat',
        payload: info as unknown as Record<string, unknown>,
        timestamp: Date.now(),
      });
    });
  }

  /** Start the manager (prune stale peers periodically) */
  start(): void {
    this.pruneTimer = setInterval(() => this.pruneStalePeers(), PRUNE_INTERVAL_MS);
    logInfo('MeshManager', `Started with local node ${this.localNode.nodeId}`);
  }

  /** Graceful shutdown */
  stop(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    // Notify peers we're leaving
    this.broadcastToPeers({
      from: this.localNode.nodeId,
      to: '*',
      type: 'leave',
      payload: { nodeId: this.localNode.nodeId },
      timestamp: Date.now(),
    });
    logInfo('MeshManager', 'MeshManager stopped');
  }

  /** Register or update a remote peer */
  registerPeer(info: MeshNodeInfo): void {
    const existing = this.peers.get(info.nodeId);
    this.peers.set(info.nodeId, { ...info, lastHeartbeat: Date.now() });

    if (!existing) {
      logInfo('MeshManager', `New peer joined: ${info.nodeId} (${info.label}) at ${info.host}`);
      this.emit('peer:joined', info);
    } else {
      this.emit('peer:updated', info);
    }
  }

  /** Remove a peer */
  removePeer(nodeId: string): void {
    const peer = this.peers.get(nodeId);
    if (peer) {
      this.peers.delete(nodeId);
      logInfo('MeshManager', `Peer left: ${nodeId}`);
      this.emit('peer:left', peer);
    }
  }

  /** Handle incoming peer message */
  handleMessage(message: PeerMessage): void {
    switch (message.type) {
      case 'heartbeat': {
        const info = message.payload as unknown as MeshNodeInfo;
        if (info.nodeId && info.nodeId !== this.localNode.nodeId) {
          this.registerPeer(info);
        }
        break;
      }
      case 'join': {
        const info = message.payload as unknown as MeshNodeInfo;
        if (info.nodeId) {
          this.registerPeer(info);
        }
        break;
      }
      case 'leave': {
        const nodeId = message.payload.nodeId as string;
        if (nodeId) {
          this.removePeer(nodeId);
        }
        break;
      }
      case 'capability_sync': {
        const info = message.payload as unknown as MeshNodeInfo;
        if (info.nodeId && info.nodeId !== this.localNode.nodeId) {
          this.registerPeer(info);
        }
        break;
      }
      case 'command':
      case 'command_result':
        this.emit(`message:${message.type}`, message);
        break;
    }
  }

  /** Get all known peers (excluding local) */
  listPeers(): MeshNodeInfo[] {
    return Array.from(this.peers.values());
  }

  /** Get a specific peer */
  getPeer(nodeId: string): MeshNodeInfo | undefined {
    return this.peers.get(nodeId);
  }

  /** Find peers that have a specific capability */
  findPeersWithCapability(capability: string): MeshNodeInfo[] {
    return this.listPeers().filter(p =>
      p.status === 'online' && p.capabilities.includes(capability)
    );
  }

  /** Get full mesh topology (local + peers) */
  getTopology(): { local: MeshNodeInfo; peers: MeshNodeInfo[] } {
    return {
      local: this.localNode.toInfo(),
      peers: this.listPeers(),
    };
  }

  /** Remove peers that haven't sent a heartbeat recently */
  private pruneStalePeers(): void {
    const now = Date.now();
    const staleThreshold = 45_000;
    for (const [nodeId, peer] of this.peers.entries()) {
      if (now - peer.lastHeartbeat > staleThreshold) {
        logWarn('MeshManager', `Pruning stale peer: ${nodeId} (last heartbeat ${Math.round((now - peer.lastHeartbeat) / 1000)}s ago)`);
        this.peers.delete(nodeId);
        this.emit('peer:left', peer);
      }
    }
  }

  /** Broadcast a message to all known peers */
  private async broadcastToPeers(message: PeerMessage): Promise<void> {
    const peers = this.listPeers();
    const promises = peers.map(p =>
      this.localNode.sendToPeer(p.host, { ...message, to: p.nodeId })
    );
    await Promise.allSettled(promises);
  }
}
