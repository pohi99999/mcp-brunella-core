/**
 * Hook Engine — Production orchestrator for the BAS hook pipeline.
 *
 * Wires together:
 *   - hookRegistry (runHooks from utils/hooks.ts)
 *   - hookCircuitBreaker (per-hook circuit protection)
 *   - hookAuditTrail (SQLite execution log)
 *   - hookDlq (failed handler retry queue)
 *
 * This is the single entry point all callers (BaseAgent, tools, etc.)
 * should use instead of calling runHooks() directly.
 *
 * @version 1.0.0
 */

import { runHooks, type HookName } from '../utils/hooks.js';
import { logError } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FireHooksOptions {
  /** Hook names to skip */
  disabled?: string[];
  /** Master on/off switch — false skips all handlers */
  enabled?: boolean;
  /** If true, bypasses the circuit breaker */
  skipCircuitBreaker?: boolean;
  /** If true, skips writing to the audit trail */
  skipAudit?: boolean;
}

/**
 * Fire all registered, enabled handlers for a hook name.
 *
 * Orchestrates the shared hook pipeline and swallows any unexpected errors.
 * This function NEVER throws; errors are swallowed so callers are unaffected.
 *
 * @param name    - Hook name to fire (e.g. 'BeforeAgent', 'AfterTool')
 * @param context - Payload passed to all handlers
 * @param opts    - Options for circuit breaker, audit, disabled list
 */
export async function fireHooks(
  name: HookName,
  context: unknown,
  opts: FireHooksOptions = {}
): Promise<void> {
  try {
    if (opts.enabled === false) {
      return;
    }

    if (opts.disabled?.includes(name)) {
      return;
    }

    await runHooks(name, context, {
      disabled: opts.disabled,
      enabled: opts.enabled,
      force: opts.skipCircuitBreaker,
    });
  } catch (err: unknown) {
    // Circuit is open or an unexpected error occurred — log and swallow
    const msg = err instanceof Error ? err.message : String(err);
    logError('HookEngine', `fireHooks(${name}) swallowed error: ${msg}`);
  }
}
