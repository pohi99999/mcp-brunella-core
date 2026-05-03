/**
 * kernelTypes.ts — Brunella Kernel: Shared Envelope & Contract Types
 *
 * Every module in the 8-stage pipeline (Conductor → Intent Router → Planner →
 * Context Builder → Tool Executor → Critic → Guardrail → Learning Loop) uses
 * these common types for input, output and state.  Stable handoff, retry,
 * trace-ability and human-approval points are all built on this contract.
 *
 * Reference architecture: supervisor-driven, event-driven, layered pipeline
 */

// ============================================================================
// RUN ENVELOPE  (common input wrapper for every module)
// ============================================================================

export interface RunUserContext {
  userId: string;
  locale: string;                 // e.g. "hu-HU"
  timezone: string;               // e.g. "Europe/Budapest"
  preferences: Record<string, unknown>;
}

export interface RunStateRefs {
  shortTermStateId: string | null;
  memoryProfileId: string | null;
  knowledgeScope: string[];        // e.g. ["email", "calendar", "linear"]
}

export interface RunConstraints {
  budgetTokens: number;
  latencyMs: number;
  approvalRequired: boolean;
}

export interface RunTrace {
  parentStepId: string | null;
  stepId: string;
  attempt: number;
}

export interface RunEnvelope {
  runId: string;
  threadId: string;
  tenantId: string;
  projectId: string;
  goal: string;
  taskType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  riskLevel: 'low' | 'medium' | 'high';
  userContext: RunUserContext;
  stateRefs: RunStateRefs;
  inputPayload: Record<string, unknown>;
  constraints: RunConstraints;
  trace: RunTrace;
}

// ============================================================================
// MODULE RESPONSE  (common output wrapper from every module)
// ============================================================================

export type ModuleStatus = 'success' | 'error' | 'revise' | 'pending_approval' | 'skipped';

export interface ModuleMetrics {
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
}

export interface ModuleResponse<T = Record<string, unknown>> {
  status: ModuleStatus;
  module: KernelModule;
  runId: string;
  stepId: string;
  outputPayload: T;
  artifacts: string[];               // artifact IDs or relative paths
  decisions: string[];               // reasoning / audit trail entries
  warnings: string[];
  errors: string[];
  nextActions: KernelModule[];       // which modules come next
  statePatch: Partial<KernelState>;
  metrics: ModuleMetrics;
}

export type KernelModule =
  | 'conductor'
  | 'intent_router'
  | 'planner'
  | 'context_builder'
  | 'tool_executor'
  | 'critic'
  | 'guardrail'
  | 'learning_loop';

// ============================================================================
// SHARED STATE SCHEMA  (thread state passed between modules)
// ============================================================================

export interface KnownEntities {
  people: string[];
  projects: string[];
  systems: string[];
}

export interface KernelState {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  activePlanId: string | null;
  currentStep: string | null;
  knownEntities: KnownEntities;
  assumptions: string[];
  openLoops: string[];
  pendingApprovals: string[];
  preferences: Record<string, unknown>;
  lastCriticScore: number | null;
  lastGuardrailVerdict: GuardrailVerdict | null;
}

// ============================================================================
// MODULE-SPECIFIC OUTPUT TYPES
// ============================================================================

// --- Intent Router ---
export interface TaskContract {
  definitionOfDone: string[];
  approvalRequired: boolean;
  requiredCapabilities: string[];
}

export interface IntentResult {
  intent: string;
  domain: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiredCapabilities: string[];
  taskContract: TaskContract;
}

// --- Planner ---
export interface PlanStep {
  stepId: string;
  name: string;
  owner: KernelModule | string;
  dependsOn: string[];
  successCriteria: string[];
  args?: Record<string, unknown>;
}

export interface PlanResult {
  planId: string;
  steps: PlanStep[];
  fallbackPlan: string[];
}

// --- Context Builder ---
export interface ContextPacket {
  conversationSummary: string;
  userPreferences: Record<string, unknown>;
  episodicMemories: string[];
  retrievedDocuments: string[];
  openQuestions: string[];
}

export interface ContextResult {
  contextPacket: ContextPacket;
  retrievalQuality: {
    coverage: number;      // 0–1
    confidence: number;    // 0–1
  };
}

// --- Tool Executor ---
export interface ToolCallRequest {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolObservation {
  toolName: string;
  status: 'success' | 'error' | 'skipped';
  normalizedResult: Record<string, unknown>;
  receiptId: string;
  latencyMs: number;
}

export interface ToolExecutorResult {
  observations: ToolObservation[];
  missingData: string[];
  executionSummary: string;
}

// --- Critic ---
export type CriticDecision = 'approve' | 'revise' | 'reject';

export interface CriticDefect {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface CriticScorecard {
  correctness: number;      // 0–1
  completeness: number;     // 0–1
  groundedness: number;     // 0–1
  policySafety: number;     // 0–1
}

export interface CriticResult {
  scorecard: CriticScorecard;
  defects: CriticDefect[];
  decision: CriticDecision;
  revisionInstructions: string[];
}

// --- Guardrail ---
export type GuardrailVerdict = 'allow' | 'deny' | 'require_approval' | 'redact';

export interface RedactionPatch {
  removeFields: string[];
  maskFields: string[];
}

export interface GuardrailResult {
  verdict: GuardrailVerdict;
  reasons: string[];
  requiredApprovals: string[];
  redactionPatch: RedactionPatch;
}

// --- Conductor ---
export type ExecutionMode = 'sequential' | 'parallel' | 'dag';

export interface ConductorResult {
  route: KernelModule[];
  executionMode: ExecutionMode;
  checkpointAfter: boolean;
  terminationCondition: string;
}

// --- Learning Loop ---
export interface Lesson {
  scope: string;
  condition: string;
  action: string;
}

export interface MemoryWriteback {
  memoryType: 'preference' | 'pattern' | 'routing' | 'fact';
  key: string;
  value: unknown;
}

export interface RoutingUpdate {
  intent: string;
  preferredExecutorPath: KernelModule[];
  confidence: number;
}

export interface LearningLoopResult {
  lessons: Lesson[];
  memoryWriteback: MemoryWriteback[];
  routingUpdates: RoutingUpdate[];
}

// ============================================================================
// KERNEL EVENT NAMES  (typed event bus contract)
// ============================================================================

export type KernelEventName =
  | 'run.created'
  | 'intent.resolved'
  | 'plan.created'
  | 'context.built'
  | 'tool.executed'
  | 'artifact.scored'
  | 'policy.checked'
  | 'approval.requested'
  | 'run.completed'
  | 'lesson.saved';

// ============================================================================
// HELPER: create a new KernelState with defaults
// ============================================================================

export function createKernelState(overrides: Partial<KernelState> = {}): KernelState {
  return {
    messages: [],
    activePlanId: null,
    currentStep: null,
    knownEntities: { people: [], projects: [], systems: [] },
    assumptions: [],
    openLoops: [],
    pendingApprovals: [],
    preferences: {},
    lastCriticScore: null,
    lastGuardrailVerdict: null,
    ...overrides,
  };
}

// ============================================================================
// HELPER: create a new RunEnvelope
// ============================================================================

let _runCounter = 0;
export function createRunEnvelope(
  goal: string,
  overrides: Partial<RunEnvelope> = {},
): RunEnvelope {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15);
  _runCounter += 1;
  return {
    runId: `run_${ts}_${String(_runCounter).padStart(3, '0')}`,
    threadId: `thr_${Date.now()}`,
    tenantId: 'tenant_brunella',
    projectId: 'proj_default',
    goal,
    taskType: 'general',
    priority: 'medium',
    riskLevel: 'low',
    userContext: {
      userId: 'u_default',
      locale: 'hu-HU',
      timezone: 'Europe/Budapest',
      preferences: {},
    },
    stateRefs: {
      shortTermStateId: null,
      memoryProfileId: null,
      knowledgeScope: [],
    },
    inputPayload: {},
    constraints: {
      budgetTokens: 12000,
      latencyMs: 15000,
      approvalRequired: false,
    },
    trace: {
      parentStepId: null,
      stepId: `step_${String(_runCounter).padStart(3, '0')}`,
      attempt: 1,
    },
    ...overrides,
  };
}

// ============================================================================
// HELPER: create a successful ModuleResponse
// ============================================================================

export function moduleOk<T>(
  module: KernelModule,
  runId: string,
  stepId: string,
  outputPayload: T,
  extras: Partial<ModuleResponse<T>> = {},
): ModuleResponse<T> {
  return {
    status: 'success',
    module,
    runId,
    stepId,
    outputPayload,
    artifacts: [],
    decisions: [],
    warnings: [],
    errors: [],
    nextActions: [],
    statePatch: {},
    metrics: { latencyMs: 0, tokensIn: 0, tokensOut: 0 },
    ...extras,
  };
}

export function moduleErr<T>(
  module: KernelModule,
  runId: string,
  stepId: string,
  error: string,
  extras: Partial<ModuleResponse<T>> = {},
): ModuleResponse<T> {
  return {
    status: 'error',
    module,
    runId,
    stepId,
    outputPayload: {} as T,
    artifacts: [],
    decisions: [],
    warnings: [],
    errors: [error],
    nextActions: [],
    statePatch: {},
    metrics: { latencyMs: 0, tokensIn: 0, tokensOut: 0 },
    ...extras,
  };
}
