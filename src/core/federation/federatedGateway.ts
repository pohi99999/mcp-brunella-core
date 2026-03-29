import { v4 as uuidv4 } from 'uuid';
import { trustRegistry } from './trustRegistry.js';
import { capabilityManifestManager } from './capabilityManifest.js';
import { record as auditRecord } from '../auditLog.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { logInfo, logError } from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RoutingCandidate {
  peerId: string;
  capabilityName: string;
  trustScore: number;
  latencyMs?: number;
  costScore?: number;
}

export interface RoutingDecision {
  requestId: string;
  selectedPeer: string | null;
  capabilityName: string;
  candidates: RoutingCandidate[];
  reason: string;
  fallbackUsed: boolean;
  timestamp: string;
}

export interface RemoteCapabilityRequest {
  capabilityName: string;
  payload: unknown;
  preferredPeerId?: string;
  timeoutMs?: number;
}

export interface RemoteCapabilityResult {
  requestId: string;
  peerId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_TRUST_SCORE = 80;
const DEFAULT_MAX_ATTEMPTS_PER_PEER = 2;

// ============================================================================
// FEDERATED GATEWAY
// ============================================================================

class FederatedGateway {
  /**
   * Discover which trusted peers provide a given capability.
   * Only peers with a valid (signed, non-expired) manifest are returned.
   */
  discoverCapability(capabilityName: string): RoutingCandidate[] {
    const trustedPeers = trustRegistry.listPeers('trusted');
    const candidates: RoutingCandidate[] = [];

    for (const peer of trustedPeers) {
      const manifest = capabilityManifestManager.getValidManifestForPeer(peer.peerId);
      if (!manifest) continue;

      const hasCapability = manifest.capabilities.some((c) => c.name === capabilityName);
      if (!hasCapability) continue;

      candidates.push({
        peerId: peer.peerId,
        capabilityName,
        trustScore: DEFAULT_TRUST_SCORE,
        costScore: 50,
      });
    }

    return candidates;
  }

  /**
   * Make a routing decision: pick the best peer by trust score.
   * If a preferredPeerId is given and available, it is used.
   */
  route(capabilityName: string, preferredPeerId?: string): RoutingDecision {
    const requestId = uuidv4();
    const now = new Date().toISOString();
    const candidates = this.discoverCapability(capabilityName);

    if (candidates.length === 0) {
      const decision: RoutingDecision = {
        requestId,
        selectedPeer: null,
        capabilityName,
        candidates: [],
        reason: `No trusted peers offer capability: ${capabilityName}`,
        fallbackUsed: false,
        timestamp: now,
      };

      phoenixEventBus.publish('phoenix:federation_route_resolved', {
        requestId,
        capabilityName,
        selectedPeer: null,
        candidateCount: 0,
        fallbackUsed: false,
        timestamp: now,
      });

      return decision;
    }

    // Prefer the requested peer if it is in the candidate list
    let selected = preferredPeerId
      ? candidates.find((c) => c.peerId === preferredPeerId)
      : undefined;

    const usedFallback = preferredPeerId !== undefined && selected === undefined;

    if (!selected) {
      // Sort by descending trustScore, then ascending costScore
      selected = [...candidates].sort((a, b) => {
        const trustDiff = b.trustScore - a.trustScore;
        if (trustDiff !== 0) return trustDiff;
        return (a.costScore ?? 50) - (b.costScore ?? 50);
      })[0];
    }

    const decision: RoutingDecision = {
      requestId,
      selectedPeer: selected?.peerId ?? null,
      capabilityName,
      candidates,
      reason: selected
        ? `Selected peer ${selected.peerId} (trustScore: ${selected.trustScore})`
        : 'No valid peer found',
      fallbackUsed: usedFallback,
      timestamp: now,
    };

    phoenixEventBus.publish('phoenix:federation_route_resolved', {
      requestId,
      capabilityName,
      selectedPeer: decision.selectedPeer,
      candidateCount: candidates.length,
      fallbackUsed: decision.fallbackUsed,
      timestamp: now,
    });

    logInfo('FederatedGateway', `Route: ${capabilityName} → ${decision.selectedPeer ?? 'none'}`);
    return decision;
  }

  /**
   * Execute a remote capability request:
   * 1. Emit route_requested event
   * 2. Route decision (trust + manifest checks)
   * 3. Trust policy hook
   * 4. Audit + call remote peer over HTTP
   */
  async execute(request: RemoteCapabilityRequest): Promise<RemoteCapabilityResult> {
    const requestId = uuidv4();
    const startMs = Date.now();

    phoenixEventBus.publish('phoenix:federation_route_requested', {
      requestId,
      capabilityName: request.capabilityName,
      preferredPeerId: request.preferredPeerId ?? null,
      timestamp: new Date().toISOString(),
    });

    const decision = this.route(request.capabilityName, request.preferredPeerId);
    const candidateOrder = [
      ...(decision.selectedPeer ? [decision.selectedPeer] : []),
      ...decision.candidates
        .map((candidate) => candidate.peerId)
        .filter((peerId) => peerId !== decision.selectedPeer),
    ];

    if (!decision.selectedPeer) {
      await auditRecord(
        'DENIED',
        'FederatedGateway',
        'federation:execute',
        request.capabilityName,
        decision.reason,
      );
      return { requestId, peerId: '', success: false, error: decision.reason, durationMs: Date.now() - startMs };
    }

    let lastError = decision.reason;

    for (const peerId of candidateOrder) {
      const isAllowed = await trustRegistry.isPeerAllowedForRouting(peerId);
      if (!isAllowed) {
        lastError = `Peer ${peerId} not allowed for routing`;
        continue;
      }

      const peer = trustRegistry.getPeer(peerId);
      if (!peer) {
        lastError = `Peer record not found for ${peerId}`;
        continue;
      }

      await auditRecord(
        'ALLOWED',
        'FederatedGateway',
        'federation:execute',
        `${peerId}/${request.capabilityName}`,
      );

      for (let attempt = 1; attempt <= DEFAULT_MAX_ATTEMPTS_PER_PEER; attempt += 1) {
        try {
          const data = await this.callRemotePeer(
            peer.endpoint,
            request.capabilityName,
            request.payload,
            request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );

          return {
            requestId,
            peerId,
            success: true,
            data,
            durationMs: Date.now() - startMs,
          };
        } catch (e: unknown) {
          const error = e instanceof Error ? e.message : String(e);
          lastError = error;
          logError('FederatedGateway', `Remote call failed (${peerId}, attempt ${attempt}): ${error}`);

          await auditRecord(
            'DENIED',
            'FederatedGateway',
            'federation:execute:error',
            `${peerId}/${request.capabilityName}`,
            `attempt ${attempt}: ${error}`,
          );

          if (attempt < DEFAULT_MAX_ATTEMPTS_PER_PEER) {
            continue;
          }
        }
      }
    }

    return {
      requestId,
      peerId: candidateOrder[candidateOrder.length - 1] ?? decision.selectedPeer,
      success: false,
      error: lastError,
      durationMs: Date.now() - startMs,
    };
  }

  private async callRemotePeer(
    endpoint: string,
    capabilityName: string,
    payload: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${endpoint}/capability/${encodeURIComponent(capabilityName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as unknown;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const federatedGateway = new FederatedGateway();
export default federatedGateway;
