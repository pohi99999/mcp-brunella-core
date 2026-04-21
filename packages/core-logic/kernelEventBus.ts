/**
 * kernelEventBus.ts — Brunella Kernel: Typed Event Bus
 *
 * Extends the Phoenix event bus pattern with the 10 kernel-level events
 * required for the supervisor-driven pipeline.  All pipeline stages emit
 * and subscribe to events through this bus, giving full observability,
 * replay and retry capability.
 *
 * Kernel events:   run.created · intent.resolved · plan.created ·
 *                  context.built · tool.executed · artifact.scored ·
 *                  policy.checked · approval.requested ·
 *                  run.completed · lesson.saved
 */

import { EventEmitter } from 'events';
import { logInfo, logError } from '@packages/utils/logger.js';
import type {
  KernelEventName,
  RunEnvelope,
  IntentResult,
  PlanResult,
  ContextResult,
  ToolExecutorResult,
  CriticResult,
  GuardrailResult,
  LearningLoopResult,
  KernelModule,
} from './kernelTypes.js';

// ============================================================================
// EVENT PAYLOAD TYPES
// ============================================================================

export interface KernelRunCreatedEvent {
  runId: string;
  goal: string;
  taskType: string;
  priority: string;
  riskLevel: string;
  tenantId: string;
  timestamp: string;
}

export interface KernelIntentResolvedEvent {
  runId: string;
  intent: IntentResult;
  latencyMs: number;
  timestamp: string;
}

export interface KernelPlanCreatedEvent {
  runId: string;
  planId: string;
  stepCount: number;
  latencyMs: number;
  timestamp: string;
}

export interface KernelContextBuiltEvent {
  runId: string;
  planStepId: string;
  coverage: number;
  confidence: number;
  documentCount: number;
  timestamp: string;
}

export interface KernelToolExecutedEvent {
  runId: string;
  toolName: string;
  status: 'success' | 'error' | 'skipped';
  receiptId: string;
  latencyMs: number;
  timestamp: string;
}

export interface KernelArtifactScoredEvent {
  runId: string;
  artifactType: string;
  scorecard: CriticResult['scorecard'];
  decision: CriticResult['decision'];
  defectCount: number;
  timestamp: string;
}

export interface KernelPolicyCheckedEvent {
  runId: string;
  requestedAction: string;
  verdict: GuardrailResult['verdict'];
  reasons: string[];
  timestamp: string;
}

export interface KernelApprovalRequestedEvent {
  runId: string;
  requestedAction: string;
  requiredApprovals: string[];
  riskLevel: string;
  timestamp: string;
}

export interface KernelRunCompletedEvent {
  runId: string;
  status: 'success' | 'error' | 'cancelled';
  durationMs: number;
  modulesExecuted: KernelModule[];
  finalCriticScore: number | null;
  timestamp: string;
}

export interface KernelLessonSavedEvent {
  runId: string;
  lessonCount: number;
  memoryWritebacks: number;
  routingUpdates: number;
  timestamp: string;
}

// ============================================================================
// EVENT MAP
// ============================================================================

export interface KernelEventMap {
  'run.created': KernelRunCreatedEvent;
  'intent.resolved': KernelIntentResolvedEvent;
  'plan.created': KernelPlanCreatedEvent;
  'context.built': KernelContextBuiltEvent;
  'tool.executed': KernelToolExecutedEvent;
  'artifact.scored': KernelArtifactScoredEvent;
  'policy.checked': KernelPolicyCheckedEvent;
  'approval.requested': KernelApprovalRequestedEvent;
  'run.completed': KernelRunCompletedEvent;
  'lesson.saved': KernelLessonSavedEvent;
}

// ============================================================================
// TYPED EVENT BUS
// ============================================================================

class KernelEventBus extends EventEmitter {
  private static _instance: KernelEventBus | null = null;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  static getInstance(): KernelEventBus {
    if (!KernelEventBus._instance) {
      KernelEventBus._instance = new KernelEventBus();
    }
    return KernelEventBus._instance;
  }

  /** Emit a kernel event with full type safety */
  emit<E extends KernelEventName>(
    event: E,
    payload: KernelEventMap[E],
  ): boolean {
    logInfo('KernelEventBus', `[${event}] run=${(payload as { runId?: string }).runId ?? '?'}`);
    return super.emit(event, payload);
  }

  /** Subscribe to a kernel event with full type safety */
  on<E extends KernelEventName>(
    event: E,
    listener: (payload: KernelEventMap[E]) => void,
  ): this {
    return super.on(event, listener as (payload: unknown) => void);
  }

  /** Subscribe once to a kernel event */
  once<E extends KernelEventName>(
    event: E,
    listener: (payload: KernelEventMap[E]) => void,
  ): this {
    return super.once(event, listener as (payload: unknown) => void);
  }

  /** Remove a listener */
  off<E extends KernelEventName>(
    event: E,
    listener: (payload: KernelEventMap[E]) => void,
  ): this {
    return super.off(event, listener as (payload: unknown) => void);
  }
}

/** Singleton — the one kernel event bus for the whole BAS process */
export const kernelEventBus = KernelEventBus.getInstance();

// ============================================================================
// CONVENIENCE EMIT HELPERS  (used by each module)
// ============================================================================

const ts = () => new Date().toISOString();

export function emitRunCreated(envelope: RunEnvelope): void {
  kernelEventBus.emit('run.created', {
    runId: envelope.runId,
    goal: envelope.goal,
    taskType: envelope.taskType,
    priority: envelope.priority,
    riskLevel: envelope.riskLevel,
    tenantId: envelope.tenantId,
    timestamp: ts(),
  });
}

export function emitIntentResolved(runId: string, intent: IntentResult, latencyMs: number): void {
  kernelEventBus.emit('intent.resolved', { runId, intent, latencyMs, timestamp: ts() });
}

export function emitPlanCreated(runId: string, plan: PlanResult, latencyMs: number): void {
  kernelEventBus.emit('plan.created', {
    runId,
    planId: plan.planId,
    stepCount: plan.steps.length,
    latencyMs,
    timestamp: ts(),
  });
}

export function emitContextBuilt(
  runId: string,
  planStepId: string,
  result: ContextResult,
): void {
  kernelEventBus.emit('context.built', {
    runId,
    planStepId,
    coverage: result.retrievalQuality.coverage,
    confidence: result.retrievalQuality.confidence,
    documentCount: result.contextPacket.retrievedDocuments.length,
    timestamp: ts(),
  });
}

export function emitToolExecuted(
  runId: string,
  toolName: string,
  status: 'success' | 'error' | 'skipped',
  receiptId: string,
  latencyMs: number,
): void {
  kernelEventBus.emit('tool.executed', { runId, toolName, status, receiptId, latencyMs, timestamp: ts() });
}

export function emitArtifactScored(runId: string, artifactType: string, result: CriticResult): void {
  kernelEventBus.emit('artifact.scored', {
    runId,
    artifactType,
    scorecard: result.scorecard,
    decision: result.decision,
    defectCount: result.defects.length,
    timestamp: ts(),
  });
}

export function emitPolicyChecked(
  runId: string,
  requestedAction: string,
  result: GuardrailResult,
): void {
  kernelEventBus.emit('policy.checked', {
    runId,
    requestedAction,
    verdict: result.verdict,
    reasons: result.reasons,
    timestamp: ts(),
  });
}

export function emitApprovalRequested(
  runId: string,
  requestedAction: string,
  result: GuardrailResult,
  riskLevel: string,
): void {
  kernelEventBus.emit('approval.requested', {
    runId,
    requestedAction,
    requiredApprovals: result.requiredApprovals,
    riskLevel,
    timestamp: ts(),
  });
}

export function emitRunCompleted(
  runId: string,
  status: 'success' | 'error' | 'cancelled',
  durationMs: number,
  modulesExecuted: KernelModule[],
  finalCriticScore: number | null,
): void {
  kernelEventBus.emit('run.completed', {
    runId,
    status,
    durationMs,
    modulesExecuted,
    finalCriticScore,
    timestamp: ts(),
  });
}

export function emitLessonSaved(runId: string, result: LearningLoopResult): void {
  kernelEventBus.emit('lesson.saved', {
    runId,
    lessonCount: result.lessons.length,
    memoryWritebacks: result.memoryWriteback.length,
    routingUpdates: result.routingUpdates.length,
    timestamp: ts(),
  });
}

