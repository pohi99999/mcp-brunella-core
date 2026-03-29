import { v4 as uuidv4 } from 'uuid';
import { record as auditRecord } from '../auditLog.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { evaluateAndLogPolicy } from '../policyEngine.js';
import { logInfo, logWarn } from '../../utils/logger.js';

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

// ============================================================================
// TRUST REGISTRY
// ============================================================================

class TrustRegistry {
  private readonly peers = new Map<string, PeerIdentity>();

  /**
   * Register a new remote peer. Runs a policy check first.
   * If the policy requires approval, the peer is set to 'pending' state.
   */
  async register(peer: Omit<PeerIdentity, 'trustState' | 'trustedAt' | 'revokedAt'>): Promise<PeerIdentity> {
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
    const peer = this.peers.get(peerId);
    if (!peer) return null;

    const now = new Date().toISOString();
    peer.trustState = 'revoked';
    peer.revokedAt = now;

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
    return this.peers.get(peerId)?.trustState ?? 'unknown';
  }

  getPeer(peerId: string): PeerIdentity | undefined {
    return this.peers.get(peerId);
  }

  listPeers(trustState?: TrustState): PeerIdentity[] {
    const all = Array.from(this.peers.values());
    return trustState ? all.filter((p) => p.trustState === trustState) : all;
  }

  /**
   * Policy hook: check if a remote routing action to this peer is allowed.
   * Denies unknown, pending, and revoked peers — only 'trusted' passes.
   */
  async isPeerAllowedForRouting(peerId: string): Promise<boolean> {
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
  }
}

export const trustRegistry = new TrustRegistry();
export default trustRegistry;
