import { v4 as uuidv4 } from 'uuid';
import { record as auditRecord } from '../auditLog.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { evaluateAndLogPolicy } from '../policyEngine.js';
import { inspectFederationPublicKey } from '@packages/security/federationPeerProof.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import {
  clearFederationPeers,
  loadFederationPeers,
  saveFederationPeer,
} from '../autonomyRuntimeStore.js';

// ============================================================================
// TYPES
// ============================================================================

export type TrustState = 'trusted' | 'revoked' | 'pending' | 'unknown';

export interface PeerIdentity {
  peerId: string;
  displayName: string;
  endpoint: string;
  publicKey?: string;
  trustState: TrustState;
  trustedAt?: string;
  revokedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PeerRuntimeKeyBinding {
  keyId: string;
  publicKey: string;
  status: 'current' | 'next';
}

interface PeerRuntimeKeyStoredBinding {
  keyId: string;
  publicKey: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildRuntimeKeyBinding(
  publicKey: unknown,
  status: 'current' | 'next',
  explicitKeyId?: unknown,
): PeerRuntimeKeyBinding | null {
  if (typeof publicKey !== 'string' || !publicKey.trim()) {
    return null;
  }

  try {
    const publicKeyInfo = inspectFederationPublicKey(publicKey);
    return {
      keyId:
        typeof explicitKeyId === 'string' && explicitKeyId.trim()
          ? explicitKeyId.trim()
          : publicKeyInfo.publicKeyFingerprint,
      publicKey: publicKeyInfo.normalizedPublicKey,
      status,
    };
  } catch {
    return null;
  }
}

function toStoredRuntimeKeyBinding(binding: PeerRuntimeKeyBinding): PeerRuntimeKeyStoredBinding {
  return {
    keyId: binding.keyId,
    publicKey: binding.publicKey,
  };
}

// ============================================================================
// TRUST REGISTRY
// ============================================================================

class TrustRegistry {
  private readonly peers = new Map<string, PeerIdentity>();
  private hydrated = false;

  private ensureHydrated(): void {
    if (this.hydrated) {
      return;
    }

    const restored = loadFederationPeers();
    for (const peer of restored) {
      this.peers.set(peer.peerId, peer);
    }
    this.hydrated = true;
  }

  hydrateFromStore(): number {
    this.ensureHydrated();
    return this.peers.size;
  }

  /**
   * Register a new remote peer. Runs a policy check first.
   * If the policy requires approval, the peer is set to 'pending' state.
   */
  async register(peer: Omit<PeerIdentity, 'trustState' | 'trustedAt' | 'revokedAt'>): Promise<PeerIdentity> {
    this.ensureHydrated();
    const now = new Date().toISOString();

    const decision = await evaluateAndLogPolicy({
      event: {
        id: uuidv4(),
        source: 'trust_registry',
        type: 'federation.peer.register',
        priority: 'medium',
        dedupKey: `federation:register:${peer.peerId}`,
        payload: { peerId: peer.peerId, endpoint: peer.endpoint },
        timestamp: now,
      },
      agentName: 'TrustRegistry',
      resource: peer.endpoint,
    });

    const trustState: TrustState = decision.requiresApproval ? 'pending' : 'trusted';

    const identity: PeerIdentity = {
      ...peer,
      trustState,
      trustedAt: trustState === 'trusted' ? now : undefined,
    };

    this.peers.set(peer.peerId, identity);
    saveFederationPeer(identity);

    await auditRecord('ALLOWED', 'TrustRegistry', 'federation:register', peer.peerId);

    phoenixEventBus.publish('phoenix:federation_peer_registered', {
      peerId: peer.peerId,
      displayName: peer.displayName,
      endpoint: peer.endpoint,
      trustState,
      timestamp: now,
    });

    logInfo('TrustRegistry', `Registered peer ${peer.peerId} (state: ${trustState})`);
    return identity;
  }

  /**
   * Revoke a previously trusted peer.
   */
  async revoke(peerId: string, reason?: string): Promise<PeerIdentity | null> {
    this.ensureHydrated();
    const peer = this.peers.get(peerId);
    if (!peer) return null;

    const now = new Date().toISOString();
    peer.trustState = 'revoked';
    peer.revokedAt = now;
    saveFederationPeer(peer);

    await auditRecord('DENIED', 'TrustRegistry', 'federation:revoke', peerId, reason);

    phoenixEventBus.publish('phoenix:federation_peer_revoked', {
      peerId,
      displayName: peer.displayName,
      reason: reason ?? 'manual revocation',
      timestamp: now,
    });

    logWarn('TrustRegistry', `Revoked peer ${peerId}: ${reason ?? 'no reason'}`);
    return peer;
  }

  /**
   * Check the trust state of a peer by ID.
   * Returns 'unknown' if peer is not registered.
   */
  checkTrust(peerId: string): TrustState {
    this.ensureHydrated();
    return this.peers.get(peerId)?.trustState ?? 'unknown';
  }

  getPeer(peerId: string): PeerIdentity | undefined {
    this.ensureHydrated();
    return this.peers.get(peerId);
  }

  private getMutablePeerMetadata(peer: PeerIdentity): Record<string, unknown> {
    return isObjectRecord(peer.metadata) ? { ...peer.metadata } : {};
  }

  private getMutableRuntimeKeys(metadata: Record<string, unknown>): Record<string, unknown> {
    return isObjectRecord(metadata.runtimeKeys) ? { ...metadata.runtimeKeys } : {};
  }

  async stageNextRuntimeKey(
    peerId: string,
    publicKey: string,
    keyId?: string,
  ): Promise<PeerIdentity | null> {
    this.ensureHydrated();
    const peer = this.peers.get(peerId);
    if (!peer) {
      return null;
    }

    const nextKey = buildRuntimeKeyBinding(publicKey, 'next', keyId);
    if (!nextKey) {
      throw new Error('Érvénytelen federation runtime public key.');
    }

    const currentKey = this.getPeerRuntimeKeys(peerId).find((binding) => binding.status === 'current');
    if (currentKey?.keyId === nextKey.keyId) {
      throw new Error('A következő runtime kulcs nem egyezhet meg a jelenlegi current kulccsal.');
    }

    const metadata = this.getMutablePeerMetadata(peer);
    const runtimeKeys = this.getMutableRuntimeKeys(metadata);
    if (currentKey) {
      runtimeKeys.current = toStoredRuntimeKeyBinding(currentKey);
    }
    runtimeKeys.next = toStoredRuntimeKeyBinding(nextKey);

    metadata.runtimeKeys = runtimeKeys;
    metadata.nextPublicKey = nextKey.publicKey;
    metadata.nextKeyId = nextKey.keyId;
    peer.metadata = metadata;
    saveFederationPeer(peer);

    const timestamp = new Date().toISOString();
    await auditRecord(
      'ALLOWED',
      'TrustRegistry',
      'federation:runtime-key:stage',
      `${peerId}/${nextKey.keyId}`,
    );

    phoenixEventBus.publish('phoenix:federation_runtime_key_staged', {
      peerId,
      keyId: nextKey.keyId,
      previousCurrentKeyId: currentKey?.keyId ?? null,
      timestamp,
    });

    logInfo('TrustRegistry', `Staged next runtime key ${nextKey.keyId} for ${peerId}`);
    return peer;
  }

  async promoteNextRuntimeKey(peerId: string, reason?: string): Promise<PeerIdentity | null> {
    this.ensureHydrated();
    const peer = this.peers.get(peerId);
    if (!peer) {
      return null;
    }

    const runtimeKeyBindings = this.getPeerRuntimeKeys(peerId);
    const currentKey = runtimeKeyBindings.find((binding) => binding.status === 'current');
    const nextKey = runtimeKeyBindings.find((binding) => binding.status === 'next');
    if (!nextKey) {
      throw new Error(`Nincs stage-elt next runtime kulcs ehhez a peerhez: ${peerId}`);
    }

    const metadata = this.getMutablePeerMetadata(peer);
    const runtimeKeys = this.getMutableRuntimeKeys(metadata);
    peer.publicKey = nextKey.publicKey;
    runtimeKeys.current = toStoredRuntimeKeyBinding({
      ...nextKey,
      status: 'current',
    });
    delete runtimeKeys.next;

    metadata.runtimeKeys = runtimeKeys;
    delete metadata.nextPublicKey;
    delete metadata.nextKeyId;
    peer.metadata = metadata;
    saveFederationPeer(peer);

    const timestamp = new Date().toISOString();
    await auditRecord(
      'ALLOWED',
      'TrustRegistry',
      'federation:runtime-key:promote',
      `${peerId}/${nextKey.keyId}`,
      reason,
    );

    phoenixEventBus.publish('phoenix:federation_runtime_key_promoted', {
      peerId,
      keyId: nextKey.keyId,
      previousCurrentKeyId: currentKey?.keyId ?? null,
      reason: reason ?? null,
      timestamp,
    });

    logInfo('TrustRegistry', `Promoted runtime key ${nextKey.keyId} to current for ${peerId}`);
    return peer;
  }

  getPeerRuntimeKeys(peerId: string): PeerRuntimeKeyBinding[] {
    this.ensureHydrated();
    const peer = this.peers.get(peerId);
    if (!peer) {
      return [];
    }

    const metadata = isObjectRecord(peer.metadata) ? peer.metadata : undefined;
    const runtimeKeys = metadata && isObjectRecord(metadata.runtimeKeys)
      ? metadata.runtimeKeys
      : undefined;
    const currentRuntimeKey = isObjectRecord(runtimeKeys?.current)
      ? runtimeKeys.current
      : undefined;
    const nextRuntimeKey = isObjectRecord(runtimeKeys?.next)
      ? runtimeKeys.next
      : undefined;

    const keys = [
      buildRuntimeKeyBinding(
        currentRuntimeKey?.publicKey ?? peer.publicKey,
        'current',
        currentRuntimeKey?.keyId,
      ),
      buildRuntimeKeyBinding(
        nextRuntimeKey?.publicKey ?? metadata?.nextPublicKey,
        'next',
        nextRuntimeKey?.keyId ?? metadata?.nextKeyId,
      ),
    ].filter((key): key is PeerRuntimeKeyBinding => key !== null);

    return Array.from(
      new Map(keys.map((key) => [key.keyId, key])).values(),
    );
  }

  getPeerRuntimeKeyId(peerId: string): string | undefined {
    const keys = this.getPeerRuntimeKeys(peerId);
    return keys.find((key) => key.status === 'current')?.keyId ?? keys[0]?.keyId;
  }

  findPeerByEndpoint(endpoint: string): PeerIdentity | undefined {
    this.ensureHydrated();
    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    return Array.from(this.peers.values()).find(
      (peer) => peer.endpoint.replace(/\/+$/, '') === normalizedEndpoint,
    );
  }

  listPeers(trustState?: TrustState): PeerIdentity[] {
    this.ensureHydrated();
    const all = Array.from(this.peers.values());
    return trustState ? all.filter((p) => p.trustState === trustState) : all;
  }

  /**
   * Policy hook: check if a remote routing action to this peer is allowed.
   * Denies unknown, pending, and revoked peers — only 'trusted' passes.
   */
  async isPeerAllowedForRouting(peerId: string): Promise<boolean> {
    this.ensureHydrated();
    const state = this.checkTrust(peerId);

    if (state === 'trusted') return true;

    await auditRecord(
      'DENIED',
      'TrustRegistry',
      'federation:route',
      peerId,
      `Peer not trusted (state: ${state})`,
    );
    return false;
  }

  /** Clear all peers (for testing). */
  clear(): void {
    this.peers.clear();
    this.hydrated = true;
    clearFederationPeers();
  }
}

export const trustRegistry = new TrustRegistry();
export default trustRegistry;
