import { logInfo, logError } from '../utils/logger.js';
import { eventStore } from './eventStore.js';

export type HookPriority = 'critical' | 'standard';

export interface HookOptions {
  priority?: HookPriority;
  maxRetries?: number;
}

export type HookCallback = (payload: any) => Promise<void> | void;

interface RegisteredHook {
  callback: HookCallback;
  priority: HookPriority;
  failureCount: number;
  blockedUntil?: number;
}

interface DLQEntry {
  event: string;
  payload: any;
  error: string;
  timestamp: number;
}

/**
 * AgentHookEngine - A BAS rendszer "idegrendszere".
 * Kezeli az eseményvezérelt munkafolyamatokat hookok segítségével.
 * Támogatja a prioritást, a perzisztenciát (EventStore), a DLQ-t és a Circuit Breaker-t.
 */
export class AgentHookEngine {
  private static instance: AgentHookEngine;
  private hooks: Map<string, RegisteredHook[]> = new Map();
  private dlq: DLQEntry[] = [];
  private readonly FAILURE_THRESHOLD = 3;
  private readonly BLOCK_DURATION_MS = 1000 * 60 * 30; // 30 minutes

  private constructor() {
    logInfo('AgentHookEngine', 'Initializing Hook Engine with Persistence and Circuit Breaker...');
  }

  public static getInstance(): AgentHookEngine {
    if (!AgentHookEngine.instance) {
      AgentHookEngine.instance = new AgentHookEngine();
    }
    return AgentHookEngine.instance;
  }

  /**
   * Hook regisztrálása egy eseményre.
   */
  public register(event: string, callback: HookCallback, options: HookOptions = {}): void {
    const priority = options.priority || 'standard';
    const eventHooks = this.hooks.get(event) || [];
    eventHooks.push({ 
      callback, 
      priority, 
      failureCount: 0 
    });
    this.hooks.set(event, eventHooks);
    logInfo('AgentHookEngine', `Registered ${priority} hook for event: ${event}`);
  }

  /**
   * Esemény kiváltása és a kapcsolódó hookok futtatása.
   */
  public async fire(event: string, payload: any): Promise<void> {
    const eventHooks = this.hooks.get(event) || [];
    if (eventHooks.length === 0) return;

    // Prioritás szerinti sorrend: Critical előbb
    const sortedHooks = [...eventHooks].sort((a, b) => {
      if (a.priority === 'critical' && b.priority === 'standard') return -1;
      if (a.priority === 'standard' && b.priority === 'critical') return 1;
      return 0;
    });

    logInfo('AgentHookEngine', `Firing event '${event}' with ${sortedHooks.length} hooks.`);

    // Audit az EventStore-ba
    try {
      const now = Date.now();
      await eventStore.append({
        id: `hook-${now}-${Math.random().toString(36).substr(2, 9)}`,
        type: `hook.fired:${event}`,
        aggregateId: 'system',
        payload,
        metadata: {
          agentName: 'AgentHookEngine',
          sessionId: process.env.BRUNELLA_SESSION_ID || 'local',
          correlationId: (payload as any)?.correlationId || 'none',
          causationId: 'hook-engine',
          timestamp: now,
          version: 1
        }
      });
    } catch (e) {
      logError('AgentHookEngine', `Failed to audit event to EventStore: ${e}`);
    }

    for (const hook of sortedHooks) {
      // Circuit Breaker csekk
      if (this.isHookBlocked(event, hook)) {
        logInfo('AgentHookEngine', `Hook for '${event}' is currently blocked due to previous failures.`);
        continue;
      }

      try {
        if (hook.priority === 'critical') {
          await hook.callback(payload);
          hook.failureCount = 0; // Siker esetén reset
        } else {
          Promise.resolve(hook.callback(payload))
            .then(() => { hook.failureCount = 0; })
            .catch(err => this.handleHookError(event, payload, hook, err));
        }
      } catch (err) {
        this.handleHookError(event, payload, hook, err);
      }
    }
  }

  /**
   * Hibakezelés, DLQ és Circuit Breaker logika.
   */
  private handleHookError(event: string, payload: any, hook: RegisteredHook, error: any): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError('AgentHookEngine', `Hook error for event '${event}': ${errorMsg}`);

    hook.failureCount++;
    
    // DLQ rögzítés
    this.dlq.push({
      event,
      payload,
      error: errorMsg,
      timestamp: Date.now()
    });

    // Circuit Breaker aktiválás
    if (hook.failureCount >= this.FAILURE_THRESHOLD) {
      hook.blockedUntil = Date.now() + this.BLOCK_DURATION_MS;
      logError('AgentHookEngine', `Circuit Breaker triggered for hook on event '${event}'. Blocked for 30m.`);
    }
  }

  private isHookBlocked(event: string, hook: RegisteredHook): boolean {
    if (hook.blockedUntil && Date.now() < hook.blockedUntil) {
      return true;
    }
    // Ha lejárt a blokkolás, feloldjuk
    if (hook.blockedUntil && Date.now() >= hook.blockedUntil) {
      hook.blockedUntil = undefined;
      hook.failureCount = 0;
    }
    return false;
  }

  /**
   * Külső lekérdezés a Circuit Breaker állapotára (teszteléshez).
   */
  public isHookBlockedExternally(event: string): boolean {
    const eventHooks = this.hooks.get(event) || [];
    return eventHooks.some(h => h.blockedUntil !== undefined && Date.now() < h.blockedUntil);
  }

  /**
   * DLQ lekérése (teszteléshez és adminisztrációhoz).
   */
  public getDLQ(): DLQEntry[] {
    return [...this.dlq];
  }
}

export const agentHookEngine = AgentHookEngine.getInstance();
