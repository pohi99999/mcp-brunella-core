/**
 * Tool Run Capture — instruments MCP tool handlers for Golden Dataset collection.
 *
 * Wraps tool handlers to record input/output pairs in the tool_runs table,
 * producing fine-tuning data from successful runs.
 */

import { recordToolRun } from '@packages/utils/globalDb.js';
import { logInfo, logError, logWarn } from '@packages/utils/logger.js';
import { fireHookSafely } from './hookRegistry.js';
import { classifyToolError } from './toolErrorClassifier.js';

function safeSerialize(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, candidate) => {
      if (typeof candidate === 'bigint') {
        return `${candidate.toString()}n`;
      }

      if (typeof candidate === 'object' && candidate !== null) {
        if (seen.has(candidate)) {
          return '[Circular]';
        }
        seen.add(candidate);
      }

      return candidate;
    }) ?? 'null';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ serializationError: message });
  }
}

function recordToolRunSafely(run: Parameters<typeof recordToolRun>[0]): void {
  try {
    recordToolRun(run);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(`[ToolRunCapture] Telemetry persist skipped for ${run.tool_name}: ${message}`);
  }
}

/**
 * Wrap an MCP tool handler so every invocation is recorded in the tool_runs table.
 */
export function wrapToolHandler<TArgs extends unknown[], TResult>(
  toolName: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const start = Date.now();
    const hookPayload = args.length === 0 ? {} : args.length === 1 ? args[0] : args;
    await fireHookSafely('tool:before', {
      toolName,
      args: hookPayload,
    }, {
      source: 'tool-run-capture',
      metadata: { toolName },
      logContext: 'ToolRunCapture',
    });

    try {
      const result = await handler(...args);
      const duration = Date.now() - start;

      const resultObj = (typeof result === 'object' && result !== null)
        ? result as Record<string, unknown>
        : undefined;
      const success = resultObj?.success !== false;
      const serializedInput = safeSerialize(args.length <= 1 ? args[0] : args);
      const classification = !success
        ? classifyToolError(resultObj?.error ?? resultObj?.message ?? 'Tool returned success=false')
        : undefined;

      recordToolRunSafely({
        tool_name: toolName,
        input_params: serializedInput,
        output_data: safeSerialize(classification
          ? { result, errorType: classification.type, retryable: classification.retryable, planRevision: classification.planRevision }
          : result).slice(0, 10_000),
        success: success ? 1 : 0,
        duration_ms: duration,
        quality_score: calculateQuality(result, duration),
      });

      logInfo('ToolRunCapture', `${toolName} completed in ${duration}ms (success=${success}${classification ? `, errorType=${classification.type}` : ''})`);
      await fireHookSafely('tool:after', {
        toolName,
        args: hookPayload,
        result,
        success,
        durationMs: duration,
        errorType: classification?.type,
        retryable: classification?.retryable,
        planRevision: classification?.planRevision,
      }, {
        source: 'tool-run-capture',
        metadata: { toolName, success },
        logContext: 'ToolRunCapture',
      });
      return result;
    } catch (e: unknown) {
      const duration = Date.now() - start;
      const error = e instanceof Error ? e.message : String(e);
      const serializedInput = safeSerialize(args.length <= 1 ? args[0] : args);
      const classification = classifyToolError(e);

      recordToolRunSafely({
        tool_name: toolName,
        input_params: serializedInput,
        output_data: safeSerialize({
          error,
          errorType: classification.type,
          retryable: classification.retryable,
          planRevision: classification.planRevision,
        }),
        success: 0,
        duration_ms: duration,
        quality_score: 0,
      });

      logError('ToolRunCapture', `${toolName} failed after ${duration}ms [${classification.type}]: ${error}`);
      await fireHookSafely('tool:error', {
        toolName,
        args: hookPayload,
        error,
        durationMs: duration,
        errorType: classification.type,
        retryable: classification.retryable,
        planRevision: classification.planRevision,
      }, {
        source: 'tool-run-capture',
        metadata: { toolName, success: false },
        logContext: 'ToolRunCapture',
      });
      throw e;
    }
  };
}

/**
 * Heuristic quality score (0–1) based on result richness and speed.
 */
export function calculateQuality(result: unknown, durationMs: number): number {
  let score = 0.5;

  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;
    if (r.data && typeof r.data === 'string' && r.data.length > 100) score += 0.1;
    if (r.success === true) score += 0.1;
  }

  if (durationMs < 5000) score += 0.1;
  if (durationMs < 1000) score += 0.1;

  return Math.min(score, 1.0);
}

