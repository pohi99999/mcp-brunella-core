/**
 * OfflineSync — Offline queue and delta-based replay engine
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * When a device or node goes offline, commands and state updates
 * are queued. On reconnection, deltas are replayed in order to
 * bring the node back to a consistent state.
 */

import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface SyncDelta {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  operation: 'create' | 'update' | 'delete' | 'command';
  resource: string;         // e.g. "session", "capability", "agent_state"
  resourceId: string;
  payload: Record<string, unknown>;
  version: number;
  timestamp: number;
  applied: boolean;
}

export interface SyncState {
  nodeId: string;
  lastSyncedVersion: number;
  lastSyncedAt: number;
  pendingDeltas: number;
  isOnline: boolean;
}

export class OfflineSync {
  private deltaQueue = new Map<string, SyncDelta[]>();  // nodeId → deltas
  private syncStates = new Map<string, SyncState>();
  private globalVersion = 0;

  /** Enqueue a delta for an offline (or any) target node */
  enqueue(delta: Omit<SyncDelta, 'id' | 'version' | 'timestamp' | 'applied'>): SyncDelta {
    this.globalVersion++;
    const fullDelta: SyncDelta = {
      ...delta,
      id: `delta-${this.globalVersion}-${Date.now()}`,
      version: this.globalVersion,
      timestamp: Date.now(),
      applied: false,
    };

    if (!this.deltaQueue.has(delta.targetNodeId)) {
      this.deltaQueue.set(delta.targetNodeId, []);
    }
    this.deltaQueue.get(delta.targetNodeId)!.push(fullDelta);

    logInfo('OfflineSync', `Delta enqueued for ${delta.targetNodeId}: ${delta.operation} ${delta.resource}/${delta.resourceId} v${fullDelta.version}`);
    return fullDelta;
  }

  /** Get pending (unapplied) deltas for a node, optionally filtered by version */
  getPendingDeltas(targetNodeId: string, sinceVersion?: number): SyncDelta[] {
    const deltas = this.deltaQueue.get(targetNodeId) ?? [];
    return deltas.filter(d =>
      !d.applied && (sinceVersion === undefined || d.version > sinceVersion)
    );
  }

  /** Mark deltas as applied after successful replay */
  markApplied(deltaIds: string[]): void {
    const idSet = new Set(deltaIds);
    for (const [, deltas] of this.deltaQueue.entries()) {
      for (const delta of deltas) {
        if (idSet.has(delta.id)) {
          delta.applied = true;
        }
      }
    }
    logInfo('OfflineSync', `Marked ${deltaIds.length} deltas as applied`);
  }

  /** Replay pending deltas for a reconnecting node */
  replay(targetNodeId: string, applyFn: (delta: SyncDelta) => boolean): { applied: number; failed: number } {
    const pending = this.getPendingDeltas(targetNodeId);
    let applied = 0;
    let failed = 0;

    for (const delta of pending) {
      try {
        const success = applyFn(delta);
        if (success) {
          delta.applied = true;
          applied++;
        } else {
          failed++;
          logWarn('OfflineSync', `Delta ${delta.id} apply returned false`);
        }
      } catch {
        failed++;
        logWarn('OfflineSync', `Delta ${delta.id} apply threw error`);
      }
    }

    // Update sync state
    if (applied > 0) {
      const lastApplied = pending.filter(d => d.applied).pop();
      this.syncStates.set(targetNodeId, {
        nodeId: targetNodeId,
        lastSyncedVersion: lastApplied?.version ?? 0,
        lastSyncedAt: Date.now(),
        pendingDeltas: this.getPendingDeltas(targetNodeId).length,
        isOnline: true,
      });
    }

    logInfo('OfflineSync', `Replay for ${targetNodeId}: ${applied} applied, ${failed} failed`);
    return { applied, failed };
  }

  /** Mark a node as online/offline */
  setNodeOnline(nodeId: string, online: boolean): void {
    const state = this.syncStates.get(nodeId);
    if (state) {
      state.isOnline = online;
    } else {
      this.syncStates.set(nodeId, {
        nodeId,
        lastSyncedVersion: 0,
        lastSyncedAt: 0,
        pendingDeltas: this.getPendingDeltas(nodeId).length,
        isOnline: online,
      });
    }
  }

  /** Get sync state for a node */
  getSyncState(nodeId: string): SyncState | undefined {
    return this.syncStates.get(nodeId);
  }

  /** Purge applied deltas older than maxAgeMs */
  purgeApplied(maxAgeMs: number = 3_600_000): number {
    let purged = 0;
    const cutoff = Date.now() - maxAgeMs;

    for (const [nodeId, deltas] of this.deltaQueue.entries()) {
      const remaining = deltas.filter(d => {
        if (d.applied && d.timestamp <= cutoff) {
          purged++;
          return false;
        }
        return true;
      });
      this.deltaQueue.set(nodeId, remaining);
    }

    if (purged > 0) {
      logInfo('OfflineSync', `Purged ${purged} old deltas`);
    }
    return purged;
  }

  /** Get global stats */
  getStats(): { globalVersion: number; queuedNodes: number; totalPending: number } {
    let totalPending = 0;
    for (const [, deltas] of this.deltaQueue.entries()) {
      totalPending += deltas.filter(d => !d.applied).length;
    }
    return {
      globalVersion: this.globalVersion,
      queuedNodes: this.deltaQueue.size,
      totalPending,
    };
  }
}

/** Singleton */
export const offlineSync = new OfflineSync();

