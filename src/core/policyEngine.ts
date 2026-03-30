import { record as auditRecord, type AuditResult } from './auditLog.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import type { EventEnvelope, EventFabricRiskHint } from './eventFabric.js';

export type PolicyActionClass = 'safe' | 'guarded' | 'dangerous';
export type PolicyAutonomyLevel = 'low' | 'medium' | 'high';

export interface PolicyDecision {
  actionClass: PolicyActionClass;
  riskScore: number;
  autonomyLevel: PolicyAutonomyLevel;
  requiresApproval: boolean;
  reason: string;
  guardrails: string[];
  auditResult: AuditResult;
}

export interface PolicyEvaluationContext {
  event: EventEnvelope;
  agentName?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

const DANGEROUS_RESOURCE_PATTERNS = [
  'git_force_push',
  '.env',
  'package.json',
  'src/index.ts',
  'src/server/web.ts',
  'src/server/registry.ts',
  'src/agents/registry.json',
];

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isDangerousResource(resource: string | undefined): boolean {
  const normalized = normalizeText(resource);
  if (!normalized) {
    return false;
  }

  return DANGEROUS_RESOURCE_PATTERNS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function clampRiskScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function createDecision(input: {
  actionClass: PolicyActionClass;
  riskScore: number;
  autonomyLevel: PolicyAutonomyLevel;
  requiresApproval: boolean;
  reason: string;
  guardrails?: string[];
  auditResult?: AuditResult;
}): PolicyDecision {
  return {
    actionClass: input.actionClass,
    riskScore: clampRiskScore(input.riskScore),
    autonomyLevel: input.autonomyLevel,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    guardrails: input.guardrails ?? [],
    auditResult: input.auditResult ?? (input.actionClass === 'dangerous' ? 'DENIED' : 'ALLOWED'),
  };
}

function deriveRiskHint(decision: PolicyDecision): EventFabricRiskHint {
  if (decision.actionClass === 'dangerous') {
    return 'dangerous';
  }

  if (decision.actionClass === 'guarded') {
    return 'guarded';
  }

  return 'safe';
}

export function evaluatePolicy(context: PolicyEvaluationContext): PolicyDecision {
  const { event, resource } = context;
  const normalizedType = normalizeText(event.type);

  if (isDangerousResource(resource)) {
    return createDecision({
      actionClass: 'dangerous',
      riskScore: 96,
      autonomyLevel: 'low',
      requiresApproval: true,
      reason: `Védett vagy veszélyes erőforrás érintett: ${resource}`,
      guardrails: ['require_human_review', 'deny_autonomous_execution'],
    });
  }

  if (normalizedType === 'github.workflow_run.failure') {
    return createDecision({
      actionClass: 'guarded',
      riskScore: 68,
      autonomyLevel: 'low',
      requiresApproval: true,
      reason: 'GitHub workflow hiba esetén emberi jóváhagyás szükséges a következő lépéshez.',
      guardrails: ['require_approval', 'log_failure_context'],
    });
  }

  if (normalizedType === 'github.issue.opened' || normalizedType === 'github.issue.updated') {
    return createDecision({
      actionClass: 'safe',
      riskScore: 22,
      autonomyLevel: 'high',
      requiresApproval: false,
      reason: 'Új vagy frissített GitHub issue — triázsügynök autonoman elindítható.',
      guardrails: ['audit_only', 'spawn_triage_agent'],
    });
  }

  if (normalizedType === 'github.issue.closed') {
    return createDecision({
      actionClass: 'safe',
      riskScore: 12,
      autonomyLevel: 'high',
      requiresApproval: false,
      reason: 'Lezárt GitHub issue — naplózás és összefoglaló autonóm készíthető.',
      guardrails: ['audit_only'],
    });
  }

  if (normalizedType === 'github.pr.opened' || normalizedType === 'github.pr.synchronized') {
    return createDecision({
      actionClass: 'guarded',
      riskScore: 48,
      autonomyLevel: 'medium',
      requiresApproval: false,
      reason: 'PR esemény — kódátvizsgáló ügynök autonóm futtatható, de merge nem engedélyezett jóváhagyás nélkül.',
      guardrails: ['allow_code_review', 'deny_merge_without_approval'],
    });
  }

  if (normalizedType === 'github.pr.closed') {
    return createDecision({
      actionClass: 'safe',
      riskScore: 14,
      autonomyLevel: 'high',
      requiresApproval: false,
      reason: 'Lezárt PR — changelog frissítés autonóm készíthető.',
      guardrails: ['audit_only'],
    });
  }

  if (event.source === 'scheduler' && normalizedType === 'scheduler.task.failed') {
    return createDecision({
      actionClass: 'guarded',
      riskScore: 62,
      autonomyLevel: 'low',
      requiresApproval: true,
      reason: 'Ütemezett feladat hiba történt, ezért kontrollált továbblépés kell.',
      guardrails: ['require_approval', 'preserve_failure_artifacts'],
    });
  }

  if (event.source === 'health' || normalizedType.includes('health')) {
    return createDecision({
      actionClass: 'safe',
      riskScore: 24,
      autonomyLevel: 'high',
      requiresApproval: false,
      reason: 'Health jelzés automatikusan továbbküldhető monitorozási vagy diagnosztikai flow-ba.',
      guardrails: ['observe_only'],
    });
  }

  if (normalizedType === 'approval.workflow.approved') {
    return createDecision({
      actionClass: 'safe',
      riskScore: 16,
      autonomyLevel: 'high',
      requiresApproval: false,
      reason: 'A jóváhagyott workflow folytató jel automatikusan továbbengedhető ugyanazzal a kontextussal.',
      guardrails: ['resume_with_audit'],
    });
  }

  if (event.priority === 'critical') {
    return createDecision({
      actionClass: 'guarded',
      riskScore: 74,
      autonomyLevel: 'low',
      requiresApproval: true,
      reason: 'Kritikus prioritású esemény esetén approval gate szükséges.',
      guardrails: ['require_approval'],
    });
  }

  return createDecision({
    actionClass: 'safe',
    riskScore: 18,
    autonomyLevel: 'medium',
    requiresApproval: false,
    reason: 'Alacsony kockázatú esemény, autonóm feldolgozás megengedett.',
    guardrails: ['audit_only'],
  });
}

export async function logPolicyDecision(
  decision: PolicyDecision,
  context: PolicyEvaluationContext,
): Promise<void> {
  const agentName = context.agentName ?? 'PolicyEngine';
  const resource = context.resource ?? context.event.type;
  const reason = [
    `actionClass=${decision.actionClass}`,
    `riskScore=${decision.riskScore}`,
    `autonomyLevel=${decision.autonomyLevel}`,
    `requiresApproval=${decision.requiresApproval}`,
    `reason=${decision.reason}`,
  ].join(' | ');

  await auditRecord(
    decision.auditResult,
    agentName,
    `policy:${context.event.type}`,
    resource,
    reason,
  );

  phoenixEventBus.publish('phoenix:policy_decision', {
    source: context.event.source,
    eventType: context.event.type,
    actionClass: decision.actionClass,
    riskScore: decision.riskScore,
    autonomyLevel: decision.autonomyLevel,
    requiresApproval: decision.requiresApproval,
    guardrails: decision.guardrails,
    reason: decision.reason,
    riskHint: deriveRiskHint(decision),
    timestamp: new Date().toISOString(),
  });
}

export async function evaluateAndLogPolicy(
  context: PolicyEvaluationContext,
): Promise<PolicyDecision> {
  const decision = evaluatePolicy(context);
  await logPolicyDecision(decision, context);
  return decision;
}