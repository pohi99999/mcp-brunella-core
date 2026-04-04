/**
 * Tool Run Capture — instruments MCP tool handlers for Golden Dataset collection.
 *
 * Wraps tool handlers to record input/output pairs in the tool_runs table,
 * producing fine-tuning data from successful runs.
 */

import { recordToolRun } from '../utils/globalDb.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Wrap an MCP tool handler so every invocation is recorded in the tool_runs table.
 */
export function wrapToolHandler<TArgs extends unknown[], TResult>(
  toolName: string,
  handler: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      const duration = Date.now() - start;

      const resultObj = (typeof result === 'object' && result !== null)
        ? result as Record<string, unknown>
        : undefined;
      const success = resultObj?.success !== false;
      const serializedInput = JSON.stringify(args.length <= 1 ? args[0] : args);

      recordToolRun({
        tool_name: toolName,
        input_params: serializedInput,
        output_data: JSON.stringify(result).slice(0, 10_000),
        success: success ? 1 : 0,
        duration_ms: duration,
        quality_score: calculateQuality(result, duration),
      });

      logInfo('ToolRunCapture', `${toolName} completed in ${duration}ms (success=${success})`);
      return result;
    } catch (e: unknown) {
      const duration = Date.now() - start;
      const error = e instanceof Error ? e.message : String(e);
      const serializedInput = JSON.stringify(args.length <= 1 ? args[0] : args);

      recordToolRun({
        tool_name: toolName,
        input_params: serializedInput,
        output_data: JSON.stringify({ error }),
        success: 0,
        duration_ms: duration,
        quality_score: 0,
      });

      logError('ToolRunCapture', `${toolName} failed after ${duration}ms: ${error}`);
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
