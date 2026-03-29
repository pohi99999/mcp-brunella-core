import { v4 as uuidv4 } from 'uuid';
import { trustRegistry } from './trustRegistry.js';
import { approvalRouter } from '../approvalRouter.js';
import { evaluateAndLogPolicy } from '../policyEngine.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { record as auditRecord } from '../auditLog.js';
import { logInfo, logWarn } from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type NegotiationState = 'idle' | 'offering' | 'counter_offered' | 'accepted' | 'rejected';

export interface NegotiationOffer {
  offerId: string;
  fromPeerId: string;
  toPeerId: string;
  capabilities: string[];
  terms: Record<string, unknown>;
  proposedAt: string;
}

export interface NegotiationCounterOffer {
  counterOfferId: string;
  originalOfferId: string;
  fromPeerId: string;
  modifiedCapabilities: string[];
  modifiedTerms: Record<string, unknown>;
  proposedAt: string;
}

export interface NegotiationTranscriptEntry {
  timestamp: string;
  action: string;
  actor: string;
  detail?: string;
}

export interface NegotiationSession {
  sessionId: string;
  state: NegotiationState;
  initialOffer: NegotiationOffer;
  counterOffer?: NegotiationCounterOffer;
  agreedCapabilities?: string[];
  agreedTerms?: Record<string, unknown>;
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
  requiresApproval: boolean;
  transcript: NegotiationTranscriptEntry[];
}

// ============================================================================
// NEGOTIATION PROTOCOL
// ============================================================================

class NegotiationProtocol {
  private readonly sessions = new Map<string, NegotiationSession>();

  /**
   * Initiate a negotiation offer from local BAS to a remote peer.
   * Runs a trust check and policy evaluation first.
   */
  async createOffer(
    toPeerId: string,
    capabilities: string[],
    terms: Record<string, unknown> = {},
  ): Promise<NegotiationSession> {
    const now = new Date().toISOString();

    // Trust check — refuse negotiation with revoked or unknown peers
    const trustState = trustRegistry.checkTrust(toPeerId);
    if (trustState === 'revoked' || trustState === 'unknown') {
      await auditRecord(
        'DENIED',
        'NegotiationProtocol',
        'federation:negotiate',
        toPeerId,
        `Cannot negotiate with peer in state: ${trustState}`,
      );
      throw new Error(`Cannot negotiate with peer in trust state: ${trustState}`);
    }

    // Policy check
    const decision = await evaluateAndLogPolicy({
      event: {
        id: uuidv4(),
        source: 'negotiation_protocol',
        type: 'federation.negotiate.offer',
        priority: 'medium',
        dedupKey: `negotiate:offer:${toPeerId}:${now}`,
        payload: { toPeerId, capabilities },
        timestamp: now,
      },
      agentName: 'NegotiationProtocol',
      resource: toPeerId,
    });

    const sessionId = uuidv4();
    const offer: NegotiationOffer = {
      offerId: uuidv4(),
      fromPeerId: 'local',
      toPeerId,
      capabilities,
      terms,
      proposedAt: now,
    };

    const session: NegotiationSession = {
      sessionId,
      state: 'offering',
      initialOffer: offer,
      createdAt: now,
      requiresApproval: decision.requiresApproval,
      transcript: [
        {
          timestamp: now,
          action: 'offer_created',
          actor: 'local',
          detail: capabilities.join(', '),
        },
      ],
    };

    this.sessions.set(sessionId, session);

    phoenixEventBus.publish('phoenix:federation_negotiation_started', {
      sessionId,
      fromPeerId: 'local',
      toPeerId,
      capabilityCount: capabilities.length,
      requiresApproval: decision.requiresApproval,
      timestamp: now,
    });

    logInfo('NegotiationProtocol', `Offer created: session ${sessionId} → peer ${toPeerId}`);
    return session;
  }

  /**
   * Handle a counter-offer from the remote peer.
   * Session must be in 'offering' state.
   */
  handleCounterOffer(
    sessionId: string,
    modifiedCapabilities: string[],
    modifiedTerms: Record<string, unknown> = {},
    fromPeerId = 'remote',
  ): NegotiationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'offering') return null;

    const now = new Date().toISOString();
    const counter: NegotiationCounterOffer = {
      counterOfferId: uuidv4(),
      originalOfferId: session.initialOffer.offerId,
      fromPeerId,
      modifiedCapabilities,
      modifiedTerms,
      proposedAt: now,
    };

    session.state = 'counter_offered';
    session.counterOffer = counter;
    session.transcript.push({
      timestamp: now,
      action: 'counter_offer_received',
      actor: fromPeerId,
      detail: modifiedCapabilities.join(', '),
    });

    logInfo('NegotiationProtocol', `Counter-offer for session ${sessionId} from ${fromPeerId}`);
    return session;
  }

  /**
   * Accept the negotiation (either initial or counter-offer).
   * If requiresApproval is true, creates an approval workflow first.
   */
  async accept(sessionId: string, actor = 'local'): Promise<NegotiationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.state === 'accepted' || session.state === 'rejected') return session;

    const now = new Date().toISOString();

    if (session.requiresApproval) {
      await approvalRouter.createWorkflowFromPolicy(
        {
          actionClass: 'guarded',
          riskScore: 62,
          autonomyLevel: 'low',
          requiresApproval: true,
          reason: `Federation negotiation acceptance for session ${sessionId}`,
          guardrails: ['require_approval'],
          auditResult: 'ALLOWED',
        },
        {
          event: {
            id: uuidv4(),
            source: 'negotiation_protocol',
            type: 'federation.negotiate.accept',
            priority: 'medium',
            dedupKey: `negotiate:accept:${sessionId}`,
            payload: { sessionId },
            timestamp: now,
          },
          agentName: 'NegotiationProtocol',
          resource: session.initialOffer.toPeerId,
        },
      );

      session.transcript.push({
        timestamp: now,
        action: 'awaiting_approval',
        actor,
        detail: 'Approval gate created',
      });

      logInfo('NegotiationProtocol', `Session ${sessionId} awaiting approval gate`);
      return session;
    }

    // No approval required — finalise immediately
    const agreed = session.counterOffer?.modifiedCapabilities ?? session.initialOffer.capabilities;
    const agreedTerms = session.counterOffer?.modifiedTerms ?? session.initialOffer.terms;

    session.state = 'accepted';
    session.agreedCapabilities = agreed;
    session.agreedTerms = agreedTerms;
    session.resolvedAt = now;
    session.transcript.push({ timestamp: now, action: 'accepted', actor, detail: agreed.join(', ') });

    await auditRecord(
      'ALLOWED',
      'NegotiationProtocol',
      'federation:negotiate:accept',
      session.initialOffer.toPeerId,
    );

    phoenixEventBus.publish('phoenix:federation_negotiation_completed', {
      sessionId,
      outcome: 'accepted',
      agreedCapabilities: agreed,
      timestamp: now,
    });

    logInfo('NegotiationProtocol', `Session ${sessionId} accepted (${agreed.length} capabilities)`);
    return session;
  }

  /**
   * Reject the negotiation with an optional reason.
   */
  async reject(
    sessionId: string,
    reason?: string,
    actor = 'local',
  ): Promise<NegotiationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.state === 'accepted' || session.state === 'rejected') return session;

    const now = new Date().toISOString();
    session.state = 'rejected';
    session.rejectionReason = reason;
    session.resolvedAt = now;
    session.transcript.push({ timestamp: now, action: 'rejected', actor, detail: reason });

    await auditRecord(
      'DENIED',
      'NegotiationProtocol',
      'federation:negotiate:reject',
      session.initialOffer.toPeerId,
      reason,
    );

    phoenixEventBus.publish('phoenix:federation_negotiation_completed', {
      sessionId,
      outcome: 'rejected',
      agreedCapabilities: [],
      timestamp: now,
    });

    logWarn('NegotiationProtocol', `Session ${sessionId} rejected: ${reason ?? 'no reason'}`);
    return session;
  }

  getSession(sessionId: string): NegotiationSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(state?: NegotiationState): NegotiationSession[] {
    const all = Array.from(this.sessions.values());
    return state ? all.filter((s) => s.state === state) : all;
  }

  /** Clear all sessions (for testing). */
  clear(): void {
    this.sessions.clear();
  }
}

export const negotiationProtocol = new NegotiationProtocol();
export default negotiationProtocol;
