/**
 * planner.ts — Kernel Planner
 * Facade over TaskDecomposerAgent + dagEngine.
 * Produces a PlanResult from a RunEnvelope + IntentResult.
 */

import type {
  RunEnvelope,
  IntentResult,
  PlanResult,
  PlanStep,
  ModuleResponse,
} from './kernelTypes.js';
import { moduleOk, moduleErr } from './kernelTypes.js';
import { emitPlanCreated } from './kernelEventBus.js';
import { logInfo, logError } from '../utils/logger.js';

// ── Lazy decomposer import (avoids circular deps) ────────────────────────────

let _decomposer: {
  decomposePreview: (task: string, context?: unknown) => Promise<unknown>;
} | null = null;

async function getDecomposer(): Promise<typeof _decomposer> {
  if (!_decomposer) {
    try {
      const mod = await import('../agents/TaskDecomposerAgent.js');
      _decomposer = new (mod as any).TaskDecomposerAgent();
    } catch {
      _decomposer = null;
    }
  }
  return _decomposer;
}

// ── Static fallback step definitions ─────────────────────────────────────────

const FALLBACK_STEPS: Record<string, string[]> = {
  daily_briefing:      ['calendar_fetch', 'task_fetch', 'email_digest', 'prioritize', 'draft_report'],
  code_task:           ['understand_requirements', 'implement', 'test', 'review'],
  research_task:       ['search_sources', 'summarize_findings', 'extract_key_points'],
  communication_task:  ['draft_message', 'review_tone', 'guardrail_check', 'send_or_queue'],
};

const DEFAULT_STEPS = ['analyze_goal', 'execute_primary_action', 'review_output'];

function buildSteps(names: string[]): PlanStep[] {
  return names.map((name, idx) => ({
    stepId:          `s${idx + 1}`,
    name,
    owner:           'tool_executor' as const,
    dependsOn:       idx === 0 ? [] : [`s${idx}`],
    successCriteria: [`${name} completed without error`],
  }));
}

function isDecomposedArray(value: unknown): value is Array<{ name?: unknown }> {
  return Array.isArray(value) && value.length > 0;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function planTask(
  envelope: RunEnvelope,
  intent: IntentResult,
): Promise<ModuleResponse<PlanResult>> {
  const startMs = Date.now();
  const planId  = `plan_${envelope.runId}`;

  try {
    let stepNames: string[]   = FALLBACK_STEPS[intent.intent] ?? DEFAULT_STEPS;
    let usedDecomposer = false;

    // Attempt LLM-based decomposition
    const decomposer = await getDecomposer();
    if (decomposer) {
      try {
        const raw = await decomposer.decomposePreview(envelope.goal, { intent });
        if (isDecomposedArray(raw)) {
          const extracted = raw.map((s) =>
            typeof s.name === 'string' ? s.name : JSON.stringify(s),
          );
          if (extracted.length > 0) {
            stepNames      = extracted;
            usedDecomposer = true;
          }
        }
      } catch (decompErr: unknown) {
        const msg = decompErr instanceof Error ? decompErr.message : String(decompErr);
        logInfo('Planner', `Decomposer unavailable, using static fallback: ${msg}`);
      }
    }

    const steps: PlanStep[] = buildSteps(stepNames);

    const result: PlanResult = {
      planId,
      steps,
      fallbackPlan: ['human_approval_if_missing_data'],
    };

    const latencyMs = Date.now() - startMs;
    emitPlanCreated(envelope.runId, result, latencyMs);
    logInfo(
      'Planner',
      `${envelope.runId} → planId=${planId} steps=${steps.length} ` +
      `decomposer=${usedDecomposer} (${latencyMs}ms)`,
    );

    return moduleOk<PlanResult>('planner', envelope.runId, planId, result, {
      nextActions:  ['context_builder', 'tool_executor'],
      decisions:    [
        `Plan '${planId}' built with ${steps.length} steps`,
        usedDecomposer
          ? 'LLM decomposition used'
          : `Static fallback for intent '${intent.intent}'`,
      ],
      statePatch:   { activePlanId: planId, currentStep: steps[0]?.stepId ?? null },
      metrics:      { latencyMs, tokensIn: 0, tokensOut: 0 },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('Planner', msg);
    return moduleErr<PlanResult>('planner', envelope.runId, planId, msg);
  }
}

export class Planner {
  async plan(
    envelope: RunEnvelope,
    intent: IntentResult,
  ): Promise<ModuleResponse<PlanResult>> {
    return planTask(envelope, intent);
  }
}
