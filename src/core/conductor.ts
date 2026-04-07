/**
 * conductor.ts — Brunella Kernel: Conductor / Supervisor
 *
 * The Conductor is the top-level supervisor that orchestrates the full
 * 8-stage kernel pipeline for a single run.  It does NOT generate content;
 * its only job is:
 *   - Routing:   decide which modules run in what order
 *   - State:     maintain KernelState across module calls
 *   - Retry:     re-run a stage if it returns 'error' (up to MAX_RETRIES)
 *   - Events:    emit run.created and run.completed
 *   - Tracing:   collect every ModuleResponse into a run ledger
 *
 * Pipeline order (default sequential):
 *   intent_router → planner → context_builder → tool_executor →
 *   critic → guardrail → learning_loop
 *
 * Integration with GitHub Copilot CLI Orchestrator:
 *   After each significant module step the Conductor calls
 *   `copilotOrchestratorBridge.addStep()` so the Copilot dashboard panel
 *   can show real-time progress.
 */

import { logInfo, logError } from '../utils/logger.js';
import {
  createKernelState,
  moduleOk,
  moduleErr,
  type RunEnvelope,
  type KernelState,
  type KernelModule,
  type ModuleResponse,
  type ConductorResult,
  type IntentResult,
  type PlanResult,
  type ContextResult,
  type ToolExecutorResult,
  type CriticResult,
  type GuardrailResult,
  type LearningLoopResult,
} from './kernelTypes.js';
import {
  emitRunCreated,
  emitRunCompleted,
} from './kernelEventBus.js';

// ============================================================================
// LAZY MODULE IMPORTS  (avoid circular deps + keep startup fast)
// ============================================================================

async function getIntentRouter() {
  const mod = await import('./intentRouter.js');
  return mod.routeIntent ?? mod.IntentRouter?.prototype.route;
}

async function getPlanner() {
  const mod = await import('./planner.js');
  return mod.planTask ?? mod.Planner?.prototype.plan;
}

async function getToolExecutor() {
  const mod = await import('./toolExecutor.js');
  return mod.toolExecutor;
}

async function getGuardrail() {
  const mod = await import('./guardrail.js');
  return mod.guardrail;
}

// context_builder, critic, learning_loop are existing agents
async function getContextBuilder() {
  try {
    const mod = await import('../agents/contextBuilder.js') as {
      gatherContext?: (file: string, opts?: unknown) => Promise<unknown>;
      ContextBuilder?: new () => { gatherContext: (file: string, opts?: unknown) => Promise<unknown> };
    };
    if (mod.ContextBuilder) return new mod.ContextBuilder();
    return { gatherContext: mod.gatherContext ?? null };
  } catch {
    return null;
  }
}

async function getCriticAgent() {
  try {
    const mod = await import('../agents/CriticAgent.js') as {
      CriticAgent?: new () => { execute: (task: string, ctx?: unknown) => Promise<unknown> };
    };
    if (mod.CriticAgent) return new mod.CriticAgent();
    return null;
  } catch {
    return null;
  }
}

async function getLearningLoop() {
  try {
    const mod = await import('./learningLoopService.js') as {
      learningLoopService?: { triggerLearningCycle?: () => Promise<unknown> };
      LearningLoopService?: new () => { triggerLearningCycle: () => Promise<unknown> };
    };
    return mod.learningLoopService ?? (mod.LearningLoopService ? new mod.LearningLoopService() : null);
  } catch {
    return null;
  }
}

// Copilot orchestrator bridge (may or may not be available)
async function getCopilotBridge() {
  try {
    const mod = await import('./copilotOrchestratorBridge.js') as {
      copilotOrchestratorBridge?: {
        startSession(id: string, goal: string): void;
        addStep(opts: Record<string, unknown>): void;
        completeSession(id: string, summary?: string): void;
        failSession(id: string, reason?: string): void;
      };
    };
    return mod.copilotOrchestratorBridge ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// RUN LEDGER  (in-memory, per-run trace)
// ============================================================================

export interface RunLedgerEntry {
  module: KernelModule;
  status: string;
  latencyMs: number;
  stepId: string;
  errors: string[];
}

export interface RunRecord {
  runId: string;
  goal: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'error' | 'cancelled';
  entries: RunLedgerEntry[];
  finalState: KernelState;
}

const MAX_RUNS_IN_LEDGER = 50;
const MAX_RETRIES = 2;

class RunLedger {
  private runs = new Map<string, RunRecord>();

  start(runId: string, goal: string): void {
    this.runs.set(runId, {
      runId,
      goal,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      entries: [],
      finalState: createKernelState(),
    });
    // Prune oldest if over limit
    if (this.runs.size > MAX_RUNS_IN_LEDGER) {
      const oldest = this.runs.keys().next().value;
      if (oldest) this.runs.delete(oldest);
    }
  }

  addEntry(runId: string, entry: RunLedgerEntry): void {
    this.runs.get(runId)?.entries.push(entry);
  }

  complete(runId: string, status: RunRecord['status'], finalState: KernelState): void {
    const record = this.runs.get(runId);
    if (record) {
      record.status = status;
      record.completedAt = new Date().toISOString();
      record.finalState = finalState;
    }
  }

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  getAll(): RunRecord[] {
    return [...this.runs.values()];
  }
}

export const runLedger = new RunLedger();

// ============================================================================
// CONDUCTOR CORE
// ============================================================================

async function runModule<T>(
  moduleName: KernelModule,
  fn: () => Promise<ModuleResponse<T>>,
  runId: string,
  state: KernelState,
): Promise<ModuleResponse<T>> {
  let lastErr: string = 'unknown';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();

      // Merge state patch
      if (result.statePatch) {
        Object.assign(state, result.statePatch);
      }

      runLedger.addEntry(runId, {
        module: moduleName,
        status: result.status,
        latencyMs: result.metrics.latencyMs,
        stepId: result.stepId,
        errors: result.errors,
      });

      if (result.status !== 'error') return result;
      lastErr = result.errors[0] ?? 'module_error';
      logInfo('Conductor', `${moduleName} attempt ${attempt + 1} failed: ${lastErr}`);
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
      logError('Conductor', `${moduleName} threw on attempt ${attempt + 1}: ${lastErr}`);
    }
  }

  // All retries exhausted
  return moduleErr<T>(moduleName, runId, `${moduleName}_step`, `retries_exhausted: ${lastErr}`);
}

// ============================================================================
// MAIN EXECUTE FUNCTION
// ============================================================================

export interface ConductorRunOptions {
  /** Override which modules run (default: full pipeline) */
  moduleOverride?: KernelModule[];
  /** Termination condition expression (informational, not evaluated in code) */
  terminationCondition?: string;
}

/**
 * Execute the full Brunella kernel pipeline for the given envelope.
 * Returns the ConductorResult describing what was executed.
 */
export async function executeKernelPipeline(
  envelope: RunEnvelope,
  options: ConductorRunOptions = {},
): Promise<ModuleResponse<ConductorResult>> {
  const start = Date.now();
  const { runId, goal, riskLevel } = envelope;

  logInfo('Conductor', `▶ Starting run ${runId}: "${goal.slice(0, 60)}"`);

  // Announce run
  emitRunCreated(envelope);
  runLedger.start(runId, goal);

  // Wire up Copilot bridge if available
  const copilotBridge = await getCopilotBridge();
  copilotBridge?.startSession(runId, goal);

  // Per-run state
  const state = createKernelState({
    preferences: envelope.userContext.preferences,
  });

  const executedModules: KernelModule[] = [];

  // ── 1. Intent Router ──────────────────────────────────────────────────────
  copilotBridge?.addStep({ sessionId: runId, step: 'Intent routing', status: 'running', delegateTo: 'intent_router' });
  const intentResp = await runModule<IntentResult>(
    'intent_router',
    async () => {
      const fn = await getIntentRouter();
      return (typeof fn === 'function') ? fn(envelope) : moduleErr<IntentResult>('intent_router', runId, envelope.trace.stepId, 'module_unavailable');
    },
    runId,
    state,
  );
  executedModules.push('intent_router');
  copilotBridge?.addStep({ sessionId: runId, step: 'Intent routing', status: intentResp.status === 'success' ? 'done' : 'error', delegateTo: 'intent_router' });

  if (intentResp.status === 'error') {
    logError('Conductor', `Intent router failed — aborting run ${runId}`);
    finishRun(runId, 'error', start, state, executedModules, null, copilotBridge);
    return moduleErr('conductor', runId, envelope.trace.stepId, intentResp.errors[0] ?? 'intent_router_failed');
  }
  const intent = intentResp.outputPayload;

  // ── 2. Planner ────────────────────────────────────────────────────────────
  copilotBridge?.addStep({ sessionId: runId, step: 'Planning', status: 'running', delegateTo: 'planner' });
  const planResp = await runModule<PlanResult>(
    'planner',
    async () => {
      const fn = await getPlanner();
      return (typeof fn === 'function') ? fn(envelope, intent) : moduleErr<PlanResult>('planner', runId, envelope.trace.stepId, 'module_unavailable');
    },
    runId,
    state,
  );
  executedModules.push('planner');
  copilotBridge?.addStep({ sessionId: runId, step: 'Planning', status: planResp.status === 'success' ? 'done' : 'error', delegateTo: 'planner' });

  // ── 3. Context Builder ────────────────────────────────────────────────────
  const ctxBuilder = await getContextBuilder();
  let contextResult: ContextResult = {
    contextPacket: {
      conversationSummary: '',
      userPreferences: envelope.userContext.preferences,
      episodicMemories: [],
      retrievedDocuments: [],
      openQuestions: [],
    },
    retrievalQuality: { coverage: 0, confidence: 0 },
  };

  copilotBridge?.addStep({ sessionId: runId, step: 'Context building', status: 'running', delegateTo: 'context_builder' });
  if (ctxBuilder) {
    try {
      // Use context builder to gather relevant files/documents (best-effort)
      const rawCtx = await (ctxBuilder as { gatherContext: (path: string) => Promise<unknown> }).gatherContext(
        envelope.stateRefs.knowledgeScope[0] ?? '.',
      );
      if (rawCtx && typeof rawCtx === 'object') {
        const ctx = rawCtx as Record<string, unknown>;
        Object.assign(contextResult.contextPacket, {
          retrievedDocuments: Array.isArray(ctx['files']) ? ctx['files'] : [],
        });
        contextResult.retrievalQuality = { coverage: 0.7, confidence: 0.7 };
      }
    } catch {
      // Non-fatal — continue without full context
      logInfo('Conductor', 'ContextBuilder unavailable or failed — using minimal context');
    }
  }
  executedModules.push('context_builder');
  copilotBridge?.addStep({ sessionId: runId, step: 'Context building', status: 'done', delegateTo: 'context_builder' });

  // ── 4. Tool Executor ──────────────────────────────────────────────────────
  // Build tool plan from first plan step's required capabilities
  const plan = planResp.outputPayload;
  const firstStepCaps = intent.requiredCapabilities.map((cap) => ({
    toolName: cap,
    args: {},
  }));

  copilotBridge?.addStep({ sessionId: runId, step: 'Tool execution', status: 'running', delegateTo: 'tool_executor', detail: `${firstStepCaps.length} tools` });
  const toolExec = await getToolExecutor();
  const toolResp = await runModule<ToolExecutorResult>(
    'tool_executor',
    () => toolExec.execute(envelope, firstStepCaps),
    runId,
    state,
  );
  executedModules.push('tool_executor');
  copilotBridge?.addStep({ sessionId: runId, step: 'Tool execution', status: toolResp.status === 'success' ? 'done' : 'error', delegateTo: 'tool_executor' });

  // ── 5. Critic ─────────────────────────────────────────────────────────────
  copilotBridge?.addStep({ sessionId: runId, step: 'Critic evaluation', status: 'running', delegateTo: 'critic' });
  const criticAgent = await getCriticAgent();
  let criticScore: number | null = null;
  if (criticAgent) {
    try {
      const rawReview = await (criticAgent as { execute: (t: string, c: unknown) => Promise<unknown> }).execute(
        `Review this run output for goal: ${goal}`,
        { plan, toolResult: toolResp.outputPayload, context: contextResult },
      );
      if (rawReview && typeof rawReview === 'object') {
        const review = rawReview as Record<string, unknown>;
        criticScore = typeof review['qualityScore'] === 'number' ? review['qualityScore'] : null;
      }
    } catch {
      logInfo('Conductor', 'CriticAgent evaluation failed — continuing without critic score');
    }
  }
  executedModules.push('critic');
  copilotBridge?.addStep({ sessionId: runId, step: 'Critic evaluation', status: 'done', delegateTo: 'critic', detail: criticScore !== null ? `score=${criticScore.toFixed(2)}` : 'no_score' });

  // ── 6. Guardrail ──────────────────────────────────────────────────────────
  copilotBridge?.addStep({ sessionId: runId, step: 'Guardrail check', status: 'running', delegateTo: 'guardrail' });
  const guardrailMod = await getGuardrail();
  const guardrailResp = await runModule<GuardrailResult>(
    'guardrail',
    () => guardrailMod.enforce(envelope, {
      requestedAction: intent.intent,
      policyContext: {
        containsPii: false,
        externalSideEffect: riskLevel !== 'low',
        financialImpact: false,
      },
    }),
    runId,
    state,
  );
  executedModules.push('guardrail');
  const guardrailVerdict = guardrailResp.outputPayload?.verdict ?? 'allow';
  copilotBridge?.addStep({ sessionId: runId, step: 'Guardrail check', status: 'done', delegateTo: 'guardrail', detail: guardrailVerdict });

  // If guardrail denies, stop here
  if (guardrailVerdict === 'deny') {
    logInfo('Conductor', `Run ${runId} DENIED by guardrail`);
    finishRun(runId, 'error', start, state, executedModules, criticScore, copilotBridge);
    return moduleErr('conductor', runId, envelope.trace.stepId, 'guardrail_denied');
  }

  // ── 7. Learning Loop ──────────────────────────────────────────────────────
  copilotBridge?.addStep({ sessionId: runId, step: 'Learning loop', status: 'running', delegateTo: 'learning_loop' });
  const ll = await getLearningLoop();
  if (ll) {
    try {
      await (ll as { triggerLearningCycle: () => Promise<void> }).triggerLearningCycle();
    } catch {
      logInfo('Conductor', 'LearningLoop trigger failed — non-fatal');
    }
  }
  executedModules.push('learning_loop');
  copilotBridge?.addStep({ sessionId: runId, step: 'Learning loop', status: 'done', delegateTo: 'learning_loop' });

  // ── Complete run ──────────────────────────────────────────────────────────
  const conductorResult: ConductorResult = {
    route: executedModules,
    executionMode: 'sequential',
    checkpointAfter: true,
    terminationCondition: options.terminationCondition ?? 'all_modules_executed',
  };

  finishRun(runId, 'success', start, state, executedModules, criticScore, copilotBridge);

  return moduleOk<ConductorResult>('conductor', runId, envelope.trace.stepId, conductorResult, {
    decisions: executedModules.map((m) => `executed:${m}`),
    statePatch: state,
    metrics: { latencyMs: Date.now() - start, tokensIn: 0, tokensOut: 0 },
  });
}

function finishRun(
  runId: string,
  status: 'success' | 'error' | 'cancelled',
  start: number,
  state: KernelState,
  modulesExecuted: KernelModule[],
  criticScore: number | null,
  copilotBridge: Awaited<ReturnType<typeof getCopilotBridge>>,
): void {
  const durationMs = Date.now() - start;
  runLedger.complete(runId, status, state);
  emitRunCompleted(runId, status, durationMs, modulesExecuted, criticScore);

  if (status === 'success') {
    copilotBridge?.completeSession(runId, `Completed ${modulesExecuted.length} modules in ${durationMs}ms`);
  } else {
    copilotBridge?.failSession(runId, `Pipeline ended with status: ${status}`);
  }

  logInfo('Conductor', `✔ Run ${runId} → ${status} (${durationMs}ms, ${modulesExecuted.length} modules)`);
}

// ============================================================================
// CLASS API
// ============================================================================

export class Conductor {
  async execute(
    envelope: RunEnvelope,
    options: ConductorRunOptions = {},
  ): Promise<ModuleResponse<ConductorResult>> {
    return executeKernelPipeline(envelope, options);
  }

  getRunRecord(runId: string): RunRecord | undefined {
    return runLedger.get(runId);
  }

  getAllRuns(): RunRecord[] {
    return runLedger.getAll();
  }
}

/** Singleton Conductor instance */
export const conductor = new Conductor();
