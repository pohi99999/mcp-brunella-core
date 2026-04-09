/**
 * Hook Circuit Breaker — in-memory circuit breaker per hook name.
 *
 * Thresholds:
 *   - 3 consecutive failures → OPEN
 *   - 60s in OPEN state → HALF-OPEN on next access attempt
 *   - First success in HALF-OPEN → CLOSED; further failure → OPEN again
 *
 * State transitions are emitted to phoenixEventBus as 'phoenix:circuit_breaker' events.
 *
 * @version 1.0.0
 */

import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitStatus {
  key: string;
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  openedAt: number | null;
}

interface Circuit {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
  openedAt: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FAILURE_THRESHOLD = 3;
const OPEN_WINDOW_MS = 60_000;

// ============================================================================
// INTERNAL STATE
// ============================================================================

const circuits = new Map<string, Circuit>();

function getOrCreate(key: string): Circuit {
  const existing = circuits.get(key);
  if (existing) return existing;
  const circuit: Circuit = {
    state: 'closed',
    failures: 0,
    lastFailureAt: null,
    openedAt: null,
  };
  circuits.set(key, circuit);
  return circuit;
}

function emitStateChange(
  key: string,
  newState: CircuitState,
  previousState: CircuitState,
  failures: number
): void {
  try {
    phoenixEventBus.emit('phoenix:circuit_breaker', {
      agentName: key,
      state: newState,
      previousState,
      failures,
      timestamp: new Date().toISOString(),
    });
    logInfo('HookCircuitBreaker', `${key}: ${previousState} → ${newState} (failures=${failures})`);
  } catch {
    /* Event bus errors must not propagate */
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Execute a function guarded by the circuit breaker for the given key.
 * Returns null (without executing fn) if the circuit is OPEN and the
 * cool-down window has not expired.
 *
 * @param key - Circuit identifier (typically a HookName)
 * @param fn  - Async function to execute
 * @returns Result of fn, or null if the circuit is open
 */
export async function guardWithCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const circuit = getOrCreate(key);
  const now = Date.now();

  // OPEN: check if cool-down window has elapsed
  if (circuit.state === 'open') {
    if (circuit.openedAt !== null && now - circuit.openedAt >= OPEN_WINDOW_MS) {
      const prev = circuit.state;
      circuit.state = 'half-open';
      emitStateChange(key, 'half-open', prev, circuit.failures);
    } else {
      // Still open — skip execution
      return null;
    }
  }

  try {
    const result = await fn();

    // Success: reset failures
    if (circuit.state === 'half-open') {
      const prev = circuit.state;
      circuit.state = 'closed';
      circuit.failures = 0;
      circuit.openedAt = null;
      circuit.lastFailureAt = null;
      emitStateChange(key, 'closed', prev, 0);
    } else {
      circuit.failures = 0;
    }

    return result;
  } catch (err: unknown) {
    circuit.failures++;
    circuit.lastFailureAt = now;

    if (circuit.state === 'half-open' || circuit.failures >= FAILURE_THRESHOLD) {
      const prev = circuit.state;
      circuit.state = 'open';
      circuit.openedAt = now;
      emitStateChange(key, 'open', prev, circuit.failures);
    }

    throw err;
  }
}

/**
 * Get the current state of a single circuit.
 *
 * @param key - Circuit identifier
 * @returns CircuitStatus
 */
export function getCircuitState(key: string): CircuitStatus {
  const circuit = circuits.get(key) ?? {
    state: 'closed' as CircuitState,
    failures: 0,
    lastFailureAt: null,
    openedAt: null,
  };

  return {
    key,
    state: circuit.state,
    failures: circuit.failures,
    lastFailureAt: circuit.lastFailureAt,
    openedAt: circuit.openedAt,
  };
}

/**
 * Get status of all known circuits.
 *
 * @returns Array of CircuitStatus
 */
export function getAllCircuitStates(): CircuitStatus[] {
  const result: CircuitStatus[] = [];
  for (const [key, circuit] of circuits.entries()) {
    result.push({
      key,
      state: circuit.state,
      failures: circuit.failures,
      lastFailureAt: circuit.lastFailureAt,
      openedAt: circuit.openedAt,
    });
  }
  return result;
}

/**
 * Manually reset a circuit to CLOSED state.
 * Useful for operator-triggered recovery.
 *
 * @param key - Circuit identifier to reset
 */
export function resetCircuit(key: string): void {
  const circuit = circuits.get(key);
  if (!circuit) return;

  const prev = circuit.state;
  circuit.state = 'closed';
  circuit.failures = 0;
  circuit.openedAt = null;
  circuit.lastFailureAt = null;

  if (prev !== 'closed') {
    emitStateChange(key, 'closed', prev, 0);
  }
}

/**
 * Reset all circuits.
 */
export function resetAllCircuits(): void {
  for (const key of circuits.keys()) {
    resetCircuit(key);
  }
}
