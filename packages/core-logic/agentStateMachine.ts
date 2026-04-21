/**
 * AgentStateMachine — LangGraph-inspired finite state machine for Brunella agents.
 *
 * Integrates with Phoenix Protocol (checkpoint save on every transition)
 * and PhoenixEventBus (state_restored events for observability).
 *
 * @version 1.0.0
 */

import { saveCheckpoint, loadCheckpoint } from './checkpoint.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo, logError } from '@packages/utils/logger.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface MachineContext {
  task: string;
  agentName?: string;
  result?: unknown;
  error?: string;
  retryCount: number;
}

export interface StateNode<S extends string> {
  name: S;
  onEnter?: (ctx: MachineContext) => Promise<void>;
  onExit?: (ctx: MachineContext) => Promise<void>;
}

export interface Transition<S extends string> {
  from: S;
  to: S;
  event: string;
  guard?: (ctx: MachineContext) => boolean;
}

// ---------------------------------------------------------------------------
// STATE MACHINE
// ---------------------------------------------------------------------------

export class AgentStateMachine<S extends string> {
  private current: S;
  private context: MachineContext;
  private stepIndex = 0;

  constructor(
    private readonly states: StateNode<S>[],
    private readonly transitions: Transition<S>[],
    initialState: S,
    private readonly taskId: string,
  ) {
    this.current = initialState;
    this.context = { task: '', retryCount: 0 };
  }

  getState(): S {
    return this.current;
  }

  getContext(): Readonly<MachineContext> {
    return { ...this.context };
  }

  updateContext(patch: Partial<MachineContext>): void {
    this.context = { ...this.context, ...patch };
  }

  async transition(event: string): Promise<S> {
    const tx = this.transitions.find(
      (t) => t.from === this.current && t.event === event,
    );
    if (!tx) {
      throw new Error(
        `[StateMachine] Invalid transition: ${this.current} + event '${event}'`,
      );
    }
    if (tx.guard && !tx.guard(this.context)) {
      throw new Error(
        `[StateMachine] Guard blocked transition: ${this.current} → ${tx.to} (event: ${event})`,
      );
    }

    // onExit callback for the current state
    const fromNode = this.states.find((s) => s.name === this.current);
    if (fromNode?.onExit) await fromNode.onExit(this.context);

    const prev = this.current;
    this.current = tx.to;
    this.stepIndex++;

    // onEnter callback for the new state
    const toNode = this.states.find((s) => s.name === this.current);
    if (toNode?.onEnter) await toNode.onEnter(this.context);

    logInfo('StateMachine', `${prev} --[${event}]--> ${this.current}`);

    // Checkpoint save on every transition (Phoenix Protocol RULE-PH1)
    await saveCheckpoint(this.taskId, this.stepIndex, this.current, {
      machineState: this.current,
      context: this.context,
    });

    // Phoenix Protocol observability event
    phoenixEventBus.publish('phoenix:state_restored', {
      agentName: this.context.agentName ?? 'OrchestratorAgent',
      taskId: this.taskId,
      stepIndex: this.stepIndex,
      stepName: `${prev}->${this.current}`,
      timestamp: new Date().toISOString(),
    });

    return this.current;
  }

  async restoreFromCheckpoint(): Promise<boolean> {
    try {
      const cp = await loadCheckpoint(this.taskId);
      if (!cp) return false;
      const state = JSON.parse(cp.stateJson) as {
        machineState?: S;
        context?: MachineContext;
      };
      if (state.machineState) {
        this.current = state.machineState;
        if (state.context) this.context = state.context;
        this.stepIndex = cp.stepIndex;
        logInfo(
          'StateMachine',
          `Restored from checkpoint: state=${this.current} step=${this.stepIndex}`,
        );
        return true;
      }
      return false;
    } catch (e) {
      logError('StateMachine', `Checkpoint restore failed: ${e}`);
      return false;
    }
  }
}

