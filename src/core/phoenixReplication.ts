/**
 * PhoenixReplication — Global state replication across mesh nodes
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Extends the Phoenix Protocol (self-healing) with cross-node state replication.
 * Maintains a replicated state log that allows any node to recover from another.
 */

import { EventEmitter } from 'events';
import { logWarn } from '../utils/logger.js';

export interface ReplicationEntry {
  id: string;
  sourceNodeId: string;
  key: string;
  value: unknown;
  version: number;
  timestamp: number;
  checksum: string;
}

export interface ReplicationState {
  nodeId: string;
  lastVersion: number;
  lastReplicatedAt: number;
  entryCount: number;
  healthy: boolean;
}

export class PhoenixReplication extends EventEmitter {
  private store = new Map<string, ReplicationEntry>();   // key → latest entry
  private log: ReplicationEntry[] = [];                   // ordered append-only log
  private nodeStates = new Map<string, ReplicationState>();
  private localNodeId: string;
  private globalVersion = 0;

  constructor(localNodeId: string) {
    super();
    this.localNodeId = localNodeId;
  }

  /** Write a key-value pair and add to replication log */
  put(key: string, value: unknown): ReplicationEntry {
    this.globalVersion++;
    const entry: ReplicationEntry = {
      id: `rep-${this.globalVersion}-${Date.now()}`,
      sourceNodeId: this.localNodeId,
      key,
      value,
      version: this.globalVersion,
      timestamp: Date.now(),
      checksum: this.computeChecksum(key, value, this.globalVersion),
    };

    this.store.set(key, entry);
    this.log.push(entry);
    this.emit('replicate', entry);
    return entry;
  }

  /** Get current value for a key */
  get(key: string): unknown | undefined {
    return this.store.get(key)?.value;
  }

  /** Get full entry for a key */
  getEntry(key: string): ReplicationEntry | undefined {
    return this.store.get(key);
  }

  /** Apply a replicated entry from a remote node */
  applyRemote(entry: ReplicationEntry): boolean {
    const existing = this.store.get(entry.key);

    // Only apply if newer version
    if (existing && existing.version >= entry.version) {
      return false;
    }

    // Validate checksum
    const expected = this.computeChecksum(entry.key, entry.value, entry.version);
    if (entry.checksum !== expected) {
      logWarn('PhoenixReplication', `Checksum mismatch for ${entry.key} from ${entry.sourceNodeId}`);
      return false;
    }

    this.store.set(entry.key, entry);
    this.log.push(entry);

    if (entry.version > this.globalVersion) {
      this.globalVersion = entry.version;
    }

    this.emit('applied', entry);
    return true;
  }

  /** Get all entries since a given version (for sync) */
  getEntriesSince(sinceVersion: number): ReplicationEntry[] {
    return this.log.filter(e => e.version > sinceVersion);
  }

  /** Get snapshot of all current values */
  getSnapshot(): Map<string, ReplicationEntry> {
    return new Map(this.store);
  }

  /** Update replication state for a remote node */
  updateNodeState(nodeId: string, state: Partial<ReplicationState>): void {
    const existing = this.nodeStates.get(nodeId) ?? {
      nodeId,
      lastVersion: 0,
      lastReplicatedAt: 0,
      entryCount: 0,
      healthy: true,
    };
    this.nodeStates.set(nodeId, { ...existing, ...state });
  }

  /** Get replication health for all nodes */
  getReplicationHealth(): ReplicationState[] {
    return Array.from(this.nodeStates.values());
  }

  /** Simple checksum (not cryptographic, just for integrity) */
  private computeChecksum(key: string, value: unknown, version: number): string {
    const str = `${key}:${JSON.stringify(value)}:${version}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `ph-${Math.abs(hash).toString(36)}`;
  }

  /** Get stats */
  getStats(): { version: number; keys: number; logSize: number; nodes: number } {
    return {
      version: this.globalVersion,
      keys: this.store.size,
      logSize: this.log.length,
      nodes: this.nodeStates.size,
    };
  }
}
