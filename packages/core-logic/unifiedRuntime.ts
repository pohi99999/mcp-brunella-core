/**
 * UnifiedRuntime — PAIOS + Brunella shared runtime context
 * Phase 6: Evolutionary Collective Intelligence
 *
 * Provides a single shared context layer where PAIOS and Brunella
 * can exchange state, share workflows, access common memory,
 * and coordinate cross-system actions.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface RuntimeContext {
  id: string;
  source: 'brunella' | 'paios';
  key: string;
  value: unknown;
  version: number;
  updatedBy: string;
  updatedAt: number;
}

export interface SharedWorkflow {
  workflowId: string;
  name: string;
  owner: 'brunella' | 'paios' | 'shared';
  steps: Array<{ stepId: string; executor: 'brunella' | 'paios'; action: string }>;
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: number;
  lastRunAt?: number;
}

export interface RuntimeEvent {
  id: string;
  type: 'context_update' | 'workflow_start' | 'workflow_complete' | 'sync_request' | 'sync_response';
  source: 'brunella' | 'paios';
  payload: Record<string, unknown>;
  timestamp: number;
}

export class UnifiedRuntime extends EventEmitter {
  private contexts = new Map<string, RuntimeContext>();
  private workflows = new Map<string, SharedWorkflow>();
  private events: RuntimeEvent[] = [];
  private eventCounter = 0;
  private contextVersions = new Map<string, number>(); // key → version

  /** Set a context value (shared state) */
  setContext(source: 'brunella' | 'paios', key: string, value: unknown, updatedBy: string): RuntimeContext {
    const version = (this.contextVersions.get(key) ?? 0) + 1;
    this.contextVersions.set(key, version);

    const ctx: RuntimeContext = {
      id: `ctx-${key}-v${version}`,
      source,
      key,
      value,
      version,
      updatedBy,
      updatedAt: Date.now(),
    };

    this.contexts.set(key, ctx);
    this.recordEvent('context_update', source, { key, value, version });
    this.emit('context:updated', ctx);
    return ctx;
  }

  /** Get a context value */
  getContext(key: string): RuntimeContext | undefined {
    return this.contexts.get(key);
  }

  /** Get all context entries */
  getAllContexts(): RuntimeContext[] {
    return Array.from(this.contexts.values());
  }

  /** Register a shared workflow */
  registerWorkflow(workflow: Omit<SharedWorkflow, 'createdAt' | 'status'>): SharedWorkflow {
    const full: SharedWorkflow = {
      ...workflow,
      status: 'draft',
      createdAt: Date.now(),
    };
    this.workflows.set(workflow.workflowId, full);
    logInfo('UnifiedRuntime', `Workflow registered: ${workflow.name} (${workflow.workflowId})`);
    this.emit('workflow:registered', full);
    return full;
  }

  /** Start a shared workflow */
  startWorkflow(workflowId: string): boolean {
    const wf = this.workflows.get(workflowId);
    if (!wf || wf.status === 'completed') return false;

    wf.status = 'active';
    wf.lastRunAt = Date.now();
    this.recordEvent('workflow_start', wf.owner === 'shared' ? 'brunella' : wf.owner, { workflowId });
    this.emit('workflow:started', wf);
    logInfo('UnifiedRuntime', `Workflow started: ${wf.name}`);
    return true;
  }

  /** Complete a shared workflow */
  completeWorkflow(workflowId: string): boolean {
    const wf = this.workflows.get(workflowId);
    if (!wf || wf.status !== 'active') return false;

    wf.status = 'completed';
    this.recordEvent('workflow_complete', wf.owner === 'shared' ? 'brunella' : wf.owner, { workflowId });
    this.emit('workflow:completed', wf);
    return true;
  }

  /** Get a workflow */
  getWorkflow(workflowId: string): SharedWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /** List all workflows */
  listWorkflows(status?: SharedWorkflow['status']): SharedWorkflow[] {
    const all = Array.from(this.workflows.values());
    if (!status) return all;
    return all.filter(w => w.status === status);
  }

  /** Request a sync between Brunella and PAIOS */
  requestSync(source: 'brunella' | 'paios', payload: Record<string, unknown> = {}): RuntimeEvent {
    const event = this.recordEvent('sync_request', source, payload);
    this.emit('sync:requested', event);
    logInfo('UnifiedRuntime', `Sync requested by ${source}`);
    return event;
  }

  /** Respond to a sync request */
  respondSync(source: 'brunella' | 'paios', payload: Record<string, unknown> = {}): RuntimeEvent {
    const event = this.recordEvent('sync_response', source, payload);
    this.emit('sync:responded', event);
    return event;
  }

  /** Get recent events */
  getEvents(limit = 50): RuntimeEvent[] {
    return this.events.slice(-limit);
  }

  /** Get stats */
  getStats(): { contexts: number; workflows: number; events: number; activeWorkflows: number } {
    return {
      contexts: this.contexts.size,
      workflows: this.workflows.size,
      events: this.events.length,
      activeWorkflows: Array.from(this.workflows.values()).filter(w => w.status === 'active').length,
    };
  }

  private recordEvent(type: RuntimeEvent['type'], source: RuntimeEvent['source'], payload: Record<string, unknown>): RuntimeEvent {
    const event: RuntimeEvent = {
      id: `re-${++this.eventCounter}-${Date.now()}`,
      type,
      source,
      payload,
      timestamp: Date.now(),
    };
    this.events.push(event);

    // Keep last 200 events
    if (this.events.length > 200) {
      this.events.splice(0, this.events.length - 200);
    }

    return event;
  }
}

