// FILE: src/utils/agentTracer.ts
// PURPOSE: G5.1 — Agent Delegation Tracer (RULE-OB1→OB4)
// Glass Box Observability: full trace chain for Orchestrator → Agent → LLM calls

import { randomUUID } from 'crypto';
import { logInfo, logError } from './logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  agentName: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'error';
  metadata: Record<string, unknown>;
  tokenUsage?: { input: number; output: number };
  error?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export type SpanStatus = 'running' | 'success' | 'error';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ACTIVE_SPANS = 500;
const MAX_COMPLETED_SPANS = 2000;
const LANGSMITH_BATCH_SIZE = 10;

// ============================================================================
// STATE (module-level, singleton pattern)
// ============================================================================

/** Active (running) spans indexed by spanId */
const activeSpans = new Map<string, TraceSpan>();

/** Completed spans (ring buffer for querying) */
const completedSpans: TraceSpan[] = [];

/** LangSmith upload queue */
const langsmithQueue: TraceSpan[] = [];

/** Flush timer for LangSmith batch upload */
let langsmithFlushTimer: ReturnType<typeof setInterval> | undefined;

// ============================================================================
// CORE — Span Lifecycle (< 2ms target per operation)
// ============================================================================

/**
 * Generate a short unique span ID (faster than full UUID).
 * Uses first 16 chars of UUID v4 — collision risk negligible for in-process spans.
 */
function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * RULE-OB1: Start a new trace span for an agent execution.
 * RULE-OB2: If parentContext is provided, creates a child span (delegation chain).
 */
export function startSpan(
  agentName: string,
  operation: string,
  parentContext?: TraceContext,
  metadata: Record<string, unknown> = {}
): TraceSpan {
  const span: TraceSpan = {
    traceId: parentContext?.traceId ?? randomUUID(),
    spanId: generateSpanId(),
    parentSpanId: parentContext?.spanId,
    agentName,
    operation,
    startTime: Date.now(),
    status: 'running',
    metadata,
  };

  // Enforce max active spans (evict oldest if overflow)
  if (activeSpans.size >= MAX_ACTIVE_SPANS) {
    const oldest = activeSpans.keys().next().value;
    if (oldest) activeSpans.delete(oldest);
  }

  activeSpans.set(span.spanId, span);

  logInfo('AgentTracer', `[SPAN START] ${agentName}::${operation} (trace=${span.traceId.slice(0, 8)}, span=${span.spanId.slice(0, 8)})`);

  return span;
}

/**
 * End a trace span — marks duration, status, and archives to completed buffer.
 * RULE-OB4: Queues for LangSmith upload if API key available.
 */
export function endSpan(
  span: TraceSpan,
  status: SpanStatus,
  metadata?: Record<string, unknown>,
  tokenUsage?: { input: number; output: number },
  error?: string
): TraceSpan {
  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;

  if (metadata) {
    span.metadata = { ...span.metadata, ...metadata };
  }
  if (tokenUsage) {
    span.tokenUsage = tokenUsage;
  }
  if (error) {
    span.error = error;
  }

  // Move from active → completed
  activeSpans.delete(span.spanId);
  completedSpans.push(span);

  // Ring buffer: evict oldest if over limit
  if (completedSpans.length > MAX_COMPLETED_SPANS) {
    completedSpans.splice(0, completedSpans.length - MAX_COMPLETED_SPANS);
  }

  // RULE-OB4: Queue for LangSmith if key present
  if (process.env.LANGCHAIN_API_KEY) {
    langsmithQueue.push(span);
    if (langsmithQueue.length >= LANGSMITH_BATCH_SIZE) {
      flushToLangSmith().catch(() => { /* non-critical */ });
    }
  }

  const durStr = span.duration < 1000
    ? `${span.duration}ms`
    : `${(span.duration / 1000).toFixed(1)}s`;

  logInfo('AgentTracer', `[SPAN END] ${span.agentName}::${span.operation} ${status} (${durStr})`);

  return span;
}

// ============================================================================
// CONVENIENCE — Agent & LLM span helpers
// ============================================================================

/**
 * RULE-OB1: Wrap an agent execution in a trace span.
 * Returns a helper object to end the span with success or error.
 */
export function traceAgentExecution(
  agentName: string,
  task: string,
  parentContext?: TraceContext
): { span: TraceSpan; context: TraceContext; end: (status: SpanStatus, error?: string) => TraceSpan } {
  const span = startSpan(agentName, 'execute', parentContext, { task: task.slice(0, 200) });
  const context: TraceContext = { traceId: span.traceId, spanId: span.spanId };

  return {
    span,
    context,
    end: (status: SpanStatus, error?: string) => endSpan(span, status, undefined, undefined, error),
  };
}

/**
 * RULE-OB3: Create a child span for an LLM call with token usage tracking.
 */
export function traceLLMCall(
  agentName: string,
  model: string,
  provider: string,
  parentContext?: TraceContext
): { span: TraceSpan; context: TraceContext; end: (status: SpanStatus, tokenUsage?: { input: number; output: number }, error?: string) => TraceSpan } {
  const span = startSpan(agentName, 'llm_call', parentContext, { model, provider });
  const context: TraceContext = { traceId: span.traceId, spanId: span.spanId };

  return {
    span,
    context,
    end: (status: SpanStatus, tokenUsage?: { input: number; output: number }, error?: string) =>
      endSpan(span, status, { model, provider }, tokenUsage, error),
  };
}

// ============================================================================
// QUERY — Retrieve trace data
// ============================================================================

/**
 * Get all spans for a specific trace (both active and completed).
 */
export function getTraceSpans(traceId: string): TraceSpan[] {
  const spans: TraceSpan[] = [];

  for (const span of activeSpans.values()) {
    if (span.traceId === traceId) spans.push(span);
  }

  for (const span of completedSpans) {
    if (span.traceId === traceId) spans.push(span);
  }

  // Sort by startTime for hierarchical display
  return spans.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Get recent completed spans (for dashboard list).
 */
export function getRecentSpans(limit = 50): TraceSpan[] {
  return completedSpans.slice(-limit).reverse();
}

/**
 * Get all currently active (running) spans.
 */
export function getActiveSpans(): TraceSpan[] {
  return Array.from(activeSpans.values());
}

/**
 * Aggregate token usage from completed spans.
 */
export function getTokenUsageSummary(): {
  totalInput: number;
  totalOutput: number;
  byAgent: Record<string, { input: number; output: number }>;
  byModel: Record<string, { input: number; output: number }>;
} {
  const summary = {
    totalInput: 0,
    totalOutput: 0,
    byAgent: {} as Record<string, { input: number; output: number }>,
    byModel: {} as Record<string, { input: number; output: number }>,
  };

  for (const span of completedSpans) {
    if (!span.tokenUsage) continue;

    summary.totalInput += span.tokenUsage.input;
    summary.totalOutput += span.tokenUsage.output;

    // By agent
    if (!summary.byAgent[span.agentName]) {
      summary.byAgent[span.agentName] = { input: 0, output: 0 };
    }
    summary.byAgent[span.agentName].input += span.tokenUsage.input;
    summary.byAgent[span.agentName].output += span.tokenUsage.output;

    // By model (if available in metadata)
    const model = span.metadata.model as string;
    if (model) {
      if (!summary.byModel[model]) {
        summary.byModel[model] = { input: 0, output: 0 };
      }
      summary.byModel[model].input += span.tokenUsage.input;
      summary.byModel[model].output += span.tokenUsage.output;
    }
  }

  return summary;
}

/**
 * Get unique trace IDs from recent spans (for trace list view).
 */
export function getRecentTraceIds(limit = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = completedSpans.length - 1; i >= 0 && result.length < limit; i--) {
    const traceId = completedSpans[i].traceId;
    if (!seen.has(traceId)) {
      seen.add(traceId);
      result.push(traceId);
    }
  }

  return result;
}

// ============================================================================
// LANGSMITH UPLOAD (RULE-OB4)
// ============================================================================

/**
 * Flush queued spans to LangSmith.
 * Non-blocking, best-effort — failures are logged and silently swallowed.
 */
async function flushToLangSmith(): Promise<void> {
  if (langsmithQueue.length === 0) return;
  if (!process.env.LANGCHAIN_API_KEY) return;

  const batch = langsmithQueue.splice(0, LANGSMITH_BATCH_SIZE);

  try {
    // Dynamic import to avoid hard dependency
    const { Client } = await import('langsmith');
    const client = new Client({ apiKey: process.env.LANGCHAIN_API_KEY });

    for (const span of batch) {
      await client.createRun({
        name: `${span.agentName}::${span.operation}`,
        run_type: span.operation === 'llm_call' ? 'llm' : 'chain',
        inputs: { task: span.metadata.task || '', model: span.metadata.model || '' },
        outputs: span.status === 'success' ? { status: 'success' } : { error: span.error || 'unknown' },
        start_time: span.startTime,
        end_time: span.endTime,
        extra: {
          metadata: span.metadata,
          tokenUsage: span.tokenUsage,
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
        },
      });
    }

    logInfo('AgentTracer', `[LANGSMITH] Uploaded ${batch.length} spans`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('AgentTracer', `[LANGSMITH] Upload failed: ${msg}`);
    // Don't re-queue — best effort
  }
}

/**
 * Start periodic LangSmith flush (call once on server startup).
 */
export function startLangSmithFlush(intervalMs = 10000): void {
  if (langsmithFlushTimer) return;
  if (!process.env.LANGCHAIN_API_KEY) return;

  langsmithFlushTimer = setInterval(() => {
    flushToLangSmith().catch(() => { /* non-critical */ });
  }, intervalMs);

  logInfo('AgentTracer', `LangSmith flush started (${intervalMs}ms interval)`);
}

/**
 * Stop periodic LangSmith flush and drain remaining queue.
 */
export function stopLangSmithFlush(): void {
  if (langsmithFlushTimer) {
    clearInterval(langsmithFlushTimer);
    langsmithFlushTimer = undefined;
  }
  // Drain remaining
  flushToLangSmith().catch(() => { /* non-critical */ });
}

// ============================================================================
// HOUSEKEEPING
// ============================================================================

/**
 * Clear all spans (for testing).
 */
export function clearAllSpans(): void {
  activeSpans.clear();
  completedSpans.length = 0;
  langsmithQueue.length = 0;
}

/**
 * Get tracer statistics (for /api/health or debug).
 */
export function getTracerStats(): {
  activeSpans: number;
  completedSpans: number;
  langsmithQueueSize: number;
} {
  return {
    activeSpans: activeSpans.size,
    completedSpans: completedSpans.length,
    langsmithQueueSize: langsmithQueue.length,
  };
}
