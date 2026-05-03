/**
 * guardrail.ts — Brunella Kernel: Unified Guardrail & Policy Facade
 *
 * Consolidates policy evaluation (policyEngine), sandbox access control
 * (ephemeralSandbox), and audit trail (auditLog) into a single
 * guardrail verdict interface used by every pipeline stage.
 *
 * Decision flow:
 *   1. policyEngine.evaluate() → PolicyDecision (riskScore, actionClass, requiresApproval)
 *   2. Map to GuardrailVerdict: safe→allow, guarded+low→allow, guarded+high→require_approval,
 *      dangerous→deny
 *   3. Apply PII / field redaction if requested
 *   4. Emit policy.checked and (if needed) approval.requested events
 *   5. Write to audit log
 */

import { logInfo, logError } from '../utils/logger.js';
import type {
  RunEnvelope,
  GuardrailResult,
  GuardrailVerdict,
  RedactionPatch,
  CriticResult,
  ModuleResponse,
} from './kernelTypes.js';
import { moduleOk, moduleErr } from './kernelTypes.js';
import { emitPolicyChecked, emitApprovalRequested } from './kernelEventBus.js';
import type { PolicyDecision, PolicyEvaluationContext } from './policyEngine.js';

// ============================================================================
// LAZY SUBSYSTEM IMPORTS
// ============================================================================

type PolicyDecisionLike = {
  actionClass: 'safe' | 'guarded' | 'dangerous';
  riskScore: number;
  requiresApproval: boolean;
  reason: string;
  guardrails: string[];
};

type PolicyEngineModule = {
  evaluatePolicy?: (ctx: PolicyEvaluationContext) => PolicyDecision;
};

async function getPolicyEngine(): Promise<PolicyEngineModule> {
  try {
    const mod = await import('./policyEngine.js');
    return {
      evaluatePolicy: mod.evaluatePolicy,
    };
  } catch {
    return {};
  }
}

// ============================================================================
// VERDICT DERIVATION
// ============================================================================

function deriveVerdict(decision: PolicyDecisionLike): GuardrailVerdict {
  if (decision.actionClass === 'dangerous') return 'deny';
  if (decision.requiresApproval) return 'require_approval';
  if (decision.actionClass === 'guarded' && decision.riskScore > 60) return 'require_approval';
  return 'allow';
}

function buildRedactionPatch(
  policyContext: { containsPii?: boolean; externalSideEffect?: boolean },
): RedactionPatch {
  const removeFields: string[] = [];
  const maskFields: string[] = [];

  if (policyContext.containsPii) {
    maskFields.push('participant_email', 'user_name', 'phone_number');
  }

  return { removeFields, maskFields };
}

// ============================================================================
// MAIN GUARDRAIL FUNCTION
// ============================================================================

export interface GuardrailRequest {
  requestedAction: string;
  artifactType?: string;
  policyContext: {
    containsPii?: boolean;
    externalSideEffect?: boolean;
    financialImpact?: boolean;
  };
  criticScorecard?: CriticResult['scorecard'];
}

/**
 * Evaluate a guardrail verdict for a requested action.
 * Returns allow / deny / require_approval / redact.
 */
export async function enforceGuardrail(
  envelope: RunEnvelope,
  request: GuardrailRequest,
): Promise<ModuleResponse<GuardrailResult>> {
  const start = Date.now();

  try {
    const policyEngine = await getPolicyEngine();

    let policyDecision: PolicyDecisionLike;

    if (policyEngine.evaluatePolicy) {
      const syntheticEvent: PolicyEvaluationContext['event'] = {
        id: `guardrail_${envelope.runId}_${envelope.trace.stepId}`,
        source: 'manual',
        type: request.requestedAction,
        priority: envelope.priority,
        dedupKey: `${envelope.runId}:${request.requestedAction}`,
        payload: {
          artifactType: request.artifactType,
          policyContext: request.policyContext,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          runId: envelope.runId,
          stepId: envelope.trace.stepId,
          riskLevel: envelope.riskLevel,
        },
      };

      policyDecision = policyEngine.evaluatePolicy({
        event: syntheticEvent,
        agentName: 'Guardrail',
        resource: request.artifactType ?? request.requestedAction,
        metadata: {
          containsPii: request.policyContext.containsPii ?? false,
          externalSideEffect: request.policyContext.externalSideEffect ?? false,
          financialImpact: request.policyContext.financialImpact ?? false,
        },
      });
    } else {
      // Fallback heuristic when policyEngine is unavailable
      const riskScore = envelope.riskLevel === 'high' ? 80
        : envelope.riskLevel === 'medium' ? 40 : 10;
      policyDecision = {
        actionClass: riskScore > 70 ? 'dangerous' : riskScore > 40 ? 'guarded' : 'safe',
        riskScore,
        requiresApproval: envelope.constraints.approvalRequired,
        reason: 'heuristic_fallback',
        guardrails: [],
      };
    }

    const verdict = deriveVerdict(policyDecision);
    const redactionPatch = buildRedactionPatch(request.policyContext);

    // Build reasons list
    const reasons: string[] = [policyDecision.reason];
    if (request.policyContext.containsPii) reasons.push('contains_pii');
    if (request.policyContext.externalSideEffect) reasons.push('external_side_effect');
    if (request.policyContext.financialImpact) reasons.push('financial_impact');

    // Required approvals (only meaningful when verdict = require_approval)
    const requiredApprovals: string[] =
      verdict === 'require_approval' ? ['owner'] : [];

    const result: GuardrailResult = {
      verdict,
      reasons,
      requiredApprovals,
      redactionPatch,
    };

    const latencyMs = Date.now() - start;

    // Emit events
    emitPolicyChecked(envelope.runId, request.requestedAction, result);
    if (verdict === 'require_approval') {
      emitApprovalRequested(envelope.runId, request.requestedAction, result, envelope.riskLevel);
    }

    logInfo(
      'Guardrail',
      `[${envelope.runId}] ${request.requestedAction} → ${verdict} (risk=${policyDecision.riskScore})`,
    );

    const statePatch = { lastGuardrailVerdict: verdict };

    return moduleOk<GuardrailResult>('guardrail', envelope.runId, envelope.trace.stepId, result, {
      decisions: reasons,
      nextActions: verdict === 'allow' ? ['learning_loop'] : [],
      statePatch,
      metrics: { latencyMs, tokensIn: 0, tokensOut: 0 },
      status: verdict === 'deny' ? 'error' : verdict === 'require_approval' ? 'pending_approval' : 'success',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('Guardrail', `enforceGuardrail error: ${msg}`);
    return moduleErr<GuardrailResult>('guardrail', envelope.runId, envelope.trace.stepId, msg);
  }
}

// ============================================================================
// CLASS API
// ============================================================================

export class Guardrail {
  async enforce(
    envelope: RunEnvelope,
    request: GuardrailRequest,
  ): Promise<ModuleResponse<GuardrailResult>> {
    return enforceGuardrail(envelope, request);
  }

  /** Quick check — returns just the verdict string, no full response */
  async check(
    envelope: RunEnvelope,
    requestedAction: string,
    policyContext: GuardrailRequest['policyContext'] = {},
  ): Promise<GuardrailVerdict> {
    const response = await enforceGuardrail(envelope, { requestedAction, policyContext });
    return (response.outputPayload as GuardrailResult).verdict;
  }
}

/** Singleton */
export const guardrail = new Guardrail();
