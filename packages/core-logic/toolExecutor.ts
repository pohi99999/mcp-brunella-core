/**
 * toolExecutor.ts — Brunella Kernel: Unified Tool Executor
 *
 * Facade over ephemeralSandbox (access control), toolRegistry (discovery),
 * and bifrost_gateway (LLM-side tool call routing).  Provides a single,
 * normalised interface for executing tool calls inside a kernel run.
 *
 * Responsibilities:
 *   1. Validate access via ephemeralSandbox
 *   2. Dispatch to registered tool handlers
 *   3. Normalise results into ToolObservation[]
 *   4. Emit tool.executed events on the kernelEventBus
 *   5. Return a unified ToolExecutorResult
 */

import { logInfo, logError } from '@packages/utils/logger.js';
import type {
  RunEnvelope,
  ToolCallRequest,
  ToolExecutorResult,
  ToolObservation,
  ModuleResponse,
} from './kernelTypes.js';
import { moduleOk, moduleErr } from './kernelTypes.js';
import { emitToolExecuted } from './kernelEventBus.js';

// Lazy imports — avoid pulling in heavy subsystems at module load
type LocalToolRegistryModule = {
  executeLocalTool?: (
    name: string,
    args: unknown,
    context?: {
      agentName?: string;
      requestId?: string;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<unknown>;
};

let _toolRegistry: LocalToolRegistryModule | null = null;

async function getToolRegistry(): Promise<typeof _toolRegistry> {
  if (_toolRegistry !== null) return _toolRegistry;
  try {
    const mod = await import('./toolRegistry.js');
    _toolRegistry = {
      executeLocalTool: (mod as unknown as LocalToolRegistryModule).executeLocalTool,
    };
  } catch {
    _toolRegistry = {};
  }
  return _toolRegistry;
}

// ============================================================================
// ACCESS CHECK  (thin wrapper over ephemeralSandbox)
// ============================================================================

interface SandboxVerdict {
  allowed: boolean;
  reason: string;
}

async function checkAccess(toolName: string, runId: string): Promise<SandboxVerdict> {
  try {
    const mod = await import('./ephemeralSandbox.js') as {
      checkToolAccess?: (name: string, ctx: unknown) => { allowed: boolean; reason?: string };
    };
    if (typeof mod.checkToolAccess === 'function') {
      const result = mod.checkToolAccess(toolName, { runId });
      return { allowed: result.allowed, reason: result.reason ?? 'allowed' };
    }
  } catch {
    // sandbox not available — default allow, log warning
    logInfo('ToolExecutor', `Sandbox unavailable for ${toolName} — defaulting to allow`);
  }
  return { allowed: true, reason: 'sandbox_unavailable' };
}

// ============================================================================
// SINGLE TOOL DISPATCH
// ============================================================================

async function dispatchOne(
  request: ToolCallRequest,
  runId: string,
): Promise<ToolObservation> {
  const start = Date.now();
  const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Access check
  const verdict = await checkAccess(request.toolName, runId);
  if (!verdict.allowed) {
    const latencyMs = Date.now() - start;
    emitToolExecuted(runId, request.toolName, 'skipped', receiptId, latencyMs);
    return {
      toolName: request.toolName,
      status: 'skipped',
      normalizedResult: { denied: true, reason: verdict.reason },
      receiptId,
      latencyMs,
    };
  }

  // 2. Find handler in registry
  try {
    const registry = await getToolRegistry();

    let rawResult: unknown;
    if (registry?.executeLocalTool) {
      try {
        rawResult = await registry.executeLocalTool(request.toolName, request.args, {
          requestId: receiptId,
          metadata: { runId, source: 'kernel' },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Tool handler not registered')) {
          rawResult = { error: `no_handler_for_${request.toolName}` };
        } else {
          throw error;
        }
      }
    } else {
      // No handler — emit a structured "not_found" result so the Critic can flag it
      rawResult = { error: `no_handler_for_${request.toolName}` };
    }

    // 3. Normalise result
    const normalizedResult: Record<string, unknown> =
      rawResult !== null && typeof rawResult === 'object'
        ? (rawResult as Record<string, unknown>)
        : { raw: rawResult };

    const latencyMs = Date.now() - start;
    const status = 'error' in normalizedResult ? 'error' : 'success';

    emitToolExecuted(runId, request.toolName, status, receiptId, latencyMs);
    logInfo('ToolExecutor', `${request.toolName} → ${status} (${latencyMs}ms)`);

    return { toolName: request.toolName, status, normalizedResult, receiptId, latencyMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('ToolExecutor', `${request.toolName} threw: ${msg}`);
    const latencyMs = Date.now() - start;
    emitToolExecuted(runId, request.toolName, 'error', receiptId, latencyMs);
    return {
      toolName: request.toolName,
      status: 'error',
      normalizedResult: { error: msg },
      receiptId,
      latencyMs,
    };
  }
}

// ============================================================================
// BATCH EXECUTION  (main public function)
// ============================================================================

/**
 * Execute a list of tool calls and return normalised observations.
 * Runs calls sequentially (respects policy + order dependencies).
 */
export async function executeTools(
  envelope: RunEnvelope,
  toolPlan: ToolCallRequest[],
  policyHints: { piiRedaction?: boolean } = {},
): Promise<ModuleResponse<ToolExecutorResult>> {
  const start = Date.now();
  const observations: ToolObservation[] = [];
  const missingData: string[] = [];

  for (const request of toolPlan) {
    const obs = await dispatchOne(request, envelope.runId);
    observations.push(obs);

    if (obs.status === 'error' || obs.status === 'skipped') {
      missingData.push(`${request.toolName}: ${obs.normalizedResult['error'] ?? obs.normalizedResult['reason'] ?? 'unknown'}`);
    }
  }

  const executionSummary = observations
    .map((o) => `${o.toolName}:${o.status}`)
    .join(', ');

  const result: ToolExecutorResult = {
    observations,
    missingData,
    executionSummary: executionSummary || 'no tools executed',
  };

  const latencyMs = Date.now() - start;
  const hasErrors = observations.some((o) => o.status === 'error');

  return moduleOk<ToolExecutorResult>('tool_executor', envelope.runId, envelope.trace.stepId, result, {
    decisions: [`executed ${observations.length} tool(s)`],
    warnings: policyHints.piiRedaction ? ['pii_redaction_active'] : [],
    errors: missingData,
    nextActions: ['critic'],
    metrics: { latencyMs, tokensIn: 0, tokensOut: 0 },
    status: hasErrors ? 'error' : 'success',
  });
}

// ============================================================================
// CLASS API  (for DI / agent-style usage)
// ============================================================================

export class ToolExecutor {
  async execute(
    envelope: RunEnvelope,
    toolPlan: ToolCallRequest[],
    policyHints: { piiRedaction?: boolean } = {},
  ): Promise<ModuleResponse<ToolExecutorResult>> {
    return executeTools(envelope, toolPlan, policyHints);
  }

  /** Single-tool convenience method */
  async executeSingle(
    envelope: RunEnvelope,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolObservation> {
    return dispatchOne({ toolName, args }, envelope.runId);
  }
}

/** Singleton */
export const toolExecutor = new ToolExecutor();

