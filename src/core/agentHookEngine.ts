// src/core/agentHookEngine.ts
// BAS Hook Engine — agent életciklus hook-ok
import { logInfo } from '../utils/logger.js';

export type HookFn = (ctx: HookContext) => Promise<void> | void;

export interface HookContext {
  agentName: string;
  task: string;
  result?: unknown;
  error?: Error | string;
  durationMs?: number;
  [key: string]: any;
}

const registry = new Map<string, HookFn[]>();

/**
 * Hook regisztrálása egy eseményre.
 */
export function registerHook(event: string, fn: HookFn) {
  if (!registry.has(event)) registry.set(event, []);
  registry.get(event)!.push(fn);
  logInfo('HookEngine', `Registered lifecycle hook for: ${event}`);
}

/**
 * Esemény kiváltása és a regisztrált függvények futtatása.
 */
export async function fireHook(event: string, ctx: HookContext) {
  const fns = registry.get(event) ?? [];
  for (const fn of fns) {
    try { 
      await fn(ctx); 
    } catch (e) { 
      logInfo('HookEngine', `Hook error [${event}]: ${e instanceof Error ? e.message : String(e)}`); 
    }
  }
}
