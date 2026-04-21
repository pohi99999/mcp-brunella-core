// src/core/agentHookEngine.ts
// BAS Hook Engine — agent életciklus hook-ok
import { logInfo, logError } from '@packages/utils/logger.js';
import { eventStore } from './eventStore.js';

export type HookFn = (ctx: HookContext) => Promise<void> | void;

export interface HookContext {
  agentName: string;
  task: string;
  result?: unknown;
  error?: Error | string;
  durationMs?: number;
  [key: string]: any;
}

interface RegisteredHook {
  callback: HookFn;
  priority: 'critical' | 'standard';
  failureCount: number;
  blockedUntil?: number;
}

interface DLQEntry {
  event: string;
  payload: any;
  error: string;
  timestamp: number;
}

const registry = new Map<string, RegisteredHook[]>();
const dlq: DLQEntry[] = [];
const FAILURE_THRESHOLD = 3;
const BLOCK_DURATION_MS = 1000 * 60 * 30; // 30 minutes

/**
 * Hook regisztrálása egy eseményre.
 */
export function registerHook(event: string, fn: HookFn, options: { priority?: 'critical' | 'standard' } = {}) {
  if (!registry.has(event)) registry.set(event, []);
  registry.get(event)!.push({
    callback: fn,
    priority: options.priority || 'standard',
    failureCount: 0
  });
  logInfo('HookEngine', `Registered lifecycle hook for: ${event} (${options.priority || 'standard'})`);
}

/**
 * Esemény kiváltása és a regisztrált függvények futtatása.
 */
export async function fireHook(event: string, ctx: HookContext): Promise<Error[]> {
  const eventHooks = registry.get(event) ?? [];
  const errors: Error[] = [];

  if (eventHooks.length === 0) return [];

  // Prioritás szerinti sorrend: Critical előbb
  const sortedHooks = [...eventHooks].sort((a, b) => {
    if (a.priority === 'critical' && b.priority === 'standard') return -1;
    if (a.priority === 'standard' && b.priority === 'critical') return 1;
    return 0;
  });

  // Audit az EventStore-ba
  try {
    const now = Date.now();
    await eventStore.append({
      id: `hook-${now}-${Math.random().toString(36).substr(2, 9)}`,
      type: `hook.fired:${event}`,
      aggregateId: 'system',
      payload: ctx,
      metadata: {
        agentName: 'AgentHookEngine',
        sessionId: process.env.BRUNELLA_SESSION_ID || 'local',
        correlationId: ctx.correlationId || 'none',
        causationId: 'hook-engine',
        timestamp: now,
        version: 1
      }
    });
  } catch (e) {
    logError('HookEngine', `Failed to audit event to EventStore: ${e}`);
  }

  for (const hook of sortedHooks) {
    // Circuit Breaker csekk
    if (hook.blockedUntil && Date.now() < hook.blockedUntil) {
      logInfo('HookEngine', `Hook for '${event}' is currently blocked.`);
      continue;
    }

    try { 
      if (hook.priority === 'critical') {
        await hook.callback(ctx);
      } else {
        Promise.resolve(hook.callback(ctx)).catch(err => handleHookError(event, ctx, hook, err));
      }
      hook.failureCount = 0; // Siker esetén reset
    } catch (e) { 
      const err = e instanceof Error ? e : new Error(String(e));
      handleHookError(event, ctx, hook, err);
      errors.push(err);
    }
  }
  return errors;
}

function handleHookError(event: string, payload: any, hook: RegisteredHook, error: any) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  logError('HookEngine', `Hook error [${event}]: ${errorMsg}`);

  hook.failureCount++;
  dlq.push({ event, payload, error: errorMsg, timestamp: Date.now() });

  if (hook.failureCount >= FAILURE_THRESHOLD) {
    hook.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    logError('HookEngine', `Circuit Breaker triggered for '${event}'. Blocked for 30m.`);
  }
}

/**
 * Összes hook törlése (főleg teszteléshez).
 */
export function clearHooks() {
  registry.clear();
}

/**
 * DLQ lekérése.
 */
export function getDLQ() {
  return [...dlq];
}

/**
 * Circuit Breaker állapot csekk.
 */
export function isHookBlockedExternally(event: string): boolean {
  const eventHooks = registry.get(event) || [];
  return eventHooks.some(h => h.blockedUntil !== undefined && Date.now() < h.blockedUntil);
}

