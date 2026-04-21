/**
 * MeshNode — Represents a single Brunella node in the distributed mesh
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Each node has a unique ID, advertises its capabilities, and communicates
 * with peers via HTTP. Heartbeat keeps the node alive in the mesh.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn, logError } from '@packages/utils/logger.js';

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'joining';

export interface MeshNodeInfo {
  nodeId: string;
  label: string;
  host: string;                // e.g. "https://node2.brunella.dev" or "http://192.168.1.10:3000"
  capabilities: string[];
  status: NodeStatus;
  region?: string;             // e.g. "eu-west", "cf-edge"
  lastHeartbeat: number;
  joinedAt: number;
  metadata?: Record<string, unknown>;
}

export interface PeerMessage {
  from: string;
  to: string;
  type: 'heartbeat' | 'capability_sync' | 'command' | 'command_result' | 'join' | 'leave';
  payload: Record<string, unknown>;
  timestamp: number;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_STALE_MS = 45_000;

export class MeshNode extends EventEmitter {
  readonly nodeId: string;
  readonly label: string;
  readonly host: string;
  readonly region?: string;

  private _status: NodeStatus = 'joining';
  private _capabilities: string[] = [];
  private _joinedAt = 0;
  private _lastHeartbeat = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: { nodeId: string; label: string; host: string; region?: string }) {
    super();
    this.nodeId = opts.nodeId;
    this.label = opts.label;
    this.host = opts.host.replace(/\/$/, '');
    this.region = opts.region;
  }

  get status(): NodeStatus { return this._status; }
  get capabilities(): string[] { return [...this._capabilities]; }
  get joinedAt(): number { return this._joinedAt; }
  get lastHeartbeat(): number { return this._lastHeartbeat; }

  /** Bring the node online and start heartbeat broadcasting */
  start(capabilities: string[]): void {
    this._capabilities = capabilities;
    this._status = 'online';
    this._joinedAt = Date.now();
    this._lastHeartbeat = Date.now();

    this.heartbeatTimer = setInterval(() => {
      this._lastHeartbeat = Date.now();
      this.emit('heartbeat', this.toInfo());
    }, HEARTBEAT_INTERVAL_MS);

    logInfo('MeshNode', `Node ${this.nodeId} (${this.label}) online at ${this.host}`);
    this.emit('status', this._status);
  }

  /** Graceful shutdown */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this._status = 'offline';
    logInfo('MeshNode', `Node ${this.nodeId} stopped`);
    this.emit('status', this._status);
  }

  /** Update capabilities (e.g. after agent registration) */
  updateCapabilities(caps: string[]): void {
    this._capabilities = caps;
    this.emit('capabilities', caps);
  }

  /** Check if this node is considered stale */
  isStale(): boolean {
    return Date.now() - this._lastHeartbeat > HEARTBEAT_STALE_MS;
  }

  /** Send a peer message to a remote node via HTTP */
  async sendToPeer(peerHost: string, message: PeerMessage): Promise<Record<string, unknown> | null> {
    const url = `${peerHost}/api/v1/mesh/message`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        logWarn('MeshNode', `Peer ${peerHost} responded ${res.status}`);
        return null;
      }
      return await res.json() as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('MeshNode', `Failed to reach peer ${peerHost}: ${msg}`);
      return null;
    }
  }

  /** Serialize to transferable info object */
  toInfo(): MeshNodeInfo {
    return {
      nodeId: this.nodeId,
      label: this.label,
      host: this.host,
      capabilities: [...this._capabilities],
      status: this._status,
      region: this.region,
      lastHeartbeat: this._lastHeartbeat,
      joinedAt: this._joinedAt,
    };
  }
}

