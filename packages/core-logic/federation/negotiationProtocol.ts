import { v4 as uuidv4 } from 'uuid';
import { trustRegistry } from './trustRegistry.js';
import { approvalRouter } from '../approvalRouter.js';
import { evaluateAndLogPolicy } from '../policyEngine.js';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { record as auditRecord } from '../auditLog.js';
import { logInfo, logWarn } from '@packages/utils/logger.js';
import {
  clearNegotiationSessions,
  loadNegotiationSessions,
  saveNegotiationSession,
} from '../autonomyRuntimeStore.js';

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
  approvalWorkflowId?: string;
  approvalRequestId?: string;
  transcript: NegotiationTranscriptEntry[];
}

// ============================================================================
// NEGOTIATION PROTOCOL
// ============================================================================

class NegotiationProtocol {
  private readonly sessions = new Map<string, NegotiationSession>();
  private hydrated = false;

  private ensureHydrated(): void {
    if (this.hydrated) {
      return;
    }

    const restored = loadNegotiationSessions();
    for (const session of restored) {
      this.sessions.set(session.sessionId, session);
    }
    this.hydrated = true;
  }

  private persistSession(session: NegotiationSession): void {
    saveNegotiationSession(session);
  }

  hydrateFromStore(): number {
    this.ensureHydrated();
    return this.sessions.size;
  }

  /**
   * Initiate a negotiation offer from local BAS to a remote peer.
   * Runs a trust check and policy evaluation first.
   */
  async createOffer(
    toPeerId: string,
    capabilities: string[],
    terms: Record<string, unknown> = {},
  ): Promise<NegotiationSession> {
    this.ensureHydrated();
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
    this.persistSession(session);

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
    this.ensureHydrated();
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
    this.persistSession(session);

    logInfo('NegotiationProtocol', `Counter-offer for session ${sessionId} from ${fromPeerId}`);
    return session;
  }

  /**
   * Accept the negotiation (either initial or counter-offer).
   * If requiresApproval is true, creates an approval workflow first.
   */
  async accept(sessionId: string, actor = 'local'): Promise<NegotiationSession | null> {
    this.ensureHydrated();
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.state === 'accepted' || session.state === 'rejected') return session;

    const now = new Date().toISOString();

    if (session.requiresApproval) {
      if (session.approvalWorkflowId && session.approvalRequestId) {
        this.syncApprovalState(sessionId);
        return session;
      }

      const workflow = await approvalRouter.createWorkflowFromPolicy(
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
      if (workflow) {
        session.approvalWorkflowId = workflow.workflowId;
        session.approvalRequestId = workflow.approvalRequestId;
      }

      session.transcript.push({
        timestamp: now,
        action: 'awaiting_approval',
        actor,
        detail: 'Approval gate created',
      });
      this.persistSession(session);

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
    this.persistSession(session);

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
    this.ensureHydrated();
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.state === 'accepted' || session.state === 'rejected') return session;

    const now = new Date().toISOString();
    session.state = 'rejected';
    session.rejectionReason = reason;
    session.resolvedAt = now;
    session.transcript.push({ timestamp: now, action: 'rejected', actor, detail: reason });
    this.persistSession(session);

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
    this.ensureHydrated();
    this.syncApprovalState(sessionId);
    return this.sessions.get(sessionId);
  }

  listSessions(state?: NegotiationState): NegotiationSession[] {
    this.ensureHydrated();
    const all = Array.from(this.sessions.values()).map((session) => this.syncApprovalState(session.sessionId));
    return state ? all.filter((s) => s.state === state) : all;
  }

  /** Clear all sessions (for testing). */
  clear(): void {
    this.sessions.clear();
    this.hydrated = true;
    clearNegotiationSessions();
  }

  private syncApprovalState(sessionId: string): NegotiationSession {
    const session = this.sessions.get(sessionId);
    if (!session || !session.requiresApproval || !session.approvalWorkflowId || session.state === 'accepted' || session.state === 'rejected') {
      return session!;
    }

    const workflow = approvalRouter.getWorkflow(session.approvalWorkflowId);
    if (!workflow || workflow.status === 'pending') {
      return session;
    }

    const now = new Date().toISOString();
    if (workflow.status === 'approved') {
      const agreed = session.counterOffer?.modifiedCapabilities ?? session.initialOffer.capabilities;
      const agreedTerms = session.counterOffer?.modifiedTerms ?? session.initialOffer.terms;
      session.state = 'accepted';
      session.agreedCapabilities = agreed;
      session.agreedTerms = agreedTerms;
      session.resolvedAt = now;
      session.transcript.push({
        timestamp: now,
        action: 'approved_via_workflow',
        actor: 'approval_router',
        detail: workflow.workflowId,
      });
    } else {
      session.state = 'rejected';
      session.rejectionReason = workflow.status;
      session.resolvedAt = now;
      session.transcript.push({
        timestamp: now,
        action: 'rejected_via_workflow',
        actor: 'approval_router',
        detail: workflow.workflowId,
      });
    }

    this.persistSession(session);
    return session;
  }
}

export const negotiationProtocol = new NegotiationProtocol();
export default negotiationProtocol;
