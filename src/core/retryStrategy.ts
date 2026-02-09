/**
 * Retry Strategy — Gold Protocol Phoenix (RULE-PH2)
 *
 * Exponential backoff retry wrapper.
 * Default delays: 1s → 3s → 10s (backoffMultiplier = 3, maxDelay = 10000ms)
 *
 * @version 1.0.0
 */

import { logInfo, logWarn } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries: number;
  /** Initial delay in ms (default: 1000) */
  baseDelay: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay: number;
  /** Multiplier per attempt (default: 3) */
  backoffMultiplier: number;
  /** Optional callback on each retry attempt */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 3
};

// ---------------------------------------------------------------------------
// CORE
// ---------------------------------------------------------------------------

/**
 * Calculate delay for the given attempt (1-based).
 * Formula: min(baseDelay * backoffMultiplier^(attempt-1), maxDelay)
 *
 * With defaults: attempt 1 = 1000ms, attempt 2 = 3000ms, attempt 3 = 9000ms → capped 10000ms
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const raw = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(raw, config.maxDelay);
}

/**
 * Execute a function with exponential backoff retries (RULE-PH2).
 *
 * @param fn        Async function to execute
 * @param label     Human-readable label for logging
 * @param config    Retry configuration (defaults to RULE-PH2 spec: 1s→3s→10s)
 * @returns         Result of fn()
 * @throws          Last error after all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateDelay(attempt, cfg);
        logInfo('RetryStrategy', `Retry ${attempt}/${cfg.maxRetries} [${label}] — waiting ${delay}ms`);
        cfg.onRetry?.(attempt, delay, lastError!);
        await sleep(delay);
      }

      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logWarn('RetryStrategy', `Attempt ${attempt + 1} failed [${label}]: ${lastError.message}`);
    }
  }

  throw lastError!;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
