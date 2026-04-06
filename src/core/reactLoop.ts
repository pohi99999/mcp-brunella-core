import { classifyToolError, formatToolObservation, type ToolErrorDescriptor } from './toolErrorClassifier.js';

export interface ReActAction {
  name: string;
  params?: Record<string, unknown>;
  toolCallId?: string;
}

export interface ReActReasoningDecision {
  thought: string;
  actions?: ReActAction[];
  done?: boolean;
  finalMessage?: string;
}

export interface ReActObservation {
  success: boolean;
  summary: string;
  payload?: unknown;
  error?: ToolErrorDescriptor;
  planRevision?: string;
}

export interface ReActStep {
  cycle: number;
  thought: string;
  action: string;
  params?: Record<string, unknown>;
  observation: string;
  success: boolean;
  errorType?: string;
  planRevision?: string;
}

export interface ReActExecutionResult {
  success: boolean;
  finalMessage?: string;
  scratchpad: ReActStep[];
  terminatedReason: 'done' | 'max_cycles' | 'no_actions' | 'reasoning_error';
}

export interface ReActLoopCallbacks {
  reason: (scratchpad: ReActStep[], cycle: number) => Promise<ReActReasoningDecision>;
  act: (action: ReActAction, scratchpad: ReActStep[], cycle: number) => Promise<ReActObservation>;
}

export class ReActExecutor {
  constructor(private readonly maxCycles = 8) {}

  async execute(callbacks: ReActLoopCallbacks): Promise<ReActExecutionResult> {
    const scratchpad: ReActStep[] = [];

    for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
      let decision: ReActReasoningDecision;
      try {
        decision = await callbacks.reason(scratchpad, cycle);
      } catch (error) {
        const descriptor = classifyToolError(error);
        scratchpad.push({
          cycle,
          thought: 'Reasoning hiba',
          action: 'REASON',
          observation: formatToolObservation(descriptor),
          success: false,
          errorType: descriptor.type,
          planRevision: descriptor.planRevision,
        });
        return {
          success: false,
          scratchpad,
          terminatedReason: 'reasoning_error',
          finalMessage: descriptor.planRevision,
        };
      }

      if (decision.done || (decision.actions?.length ?? 0) === 0) {
        const terminalMessage = decision.finalMessage?.trim() ? decision.finalMessage.trim() : undefined;
        const completedAfterSuccessfulAction = scratchpad.at(-1)?.success === true;
        return {
          success: Boolean(terminalMessage) || completedAfterSuccessfulAction,
          finalMessage: terminalMessage,
          scratchpad,
          terminatedReason: decision.done ? 'done' : 'no_actions',
        };
      }

      for (const action of decision.actions ?? []) {
        let observation: ReActObservation;
        try {
          observation = await callbacks.act(action, scratchpad, cycle);
        } catch (error) {
          const descriptor = classifyToolError(error);
          observation = {
            success: false,
            summary: formatToolObservation(descriptor),
            error: descriptor,
            planRevision: descriptor.planRevision,
          };
        }

        scratchpad.push({
          cycle,
          thought: decision.thought,
          action: action.name,
          params: action.params,
          observation: observation.summary,
          success: observation.success,
          errorType: observation.error?.type,
          planRevision: observation.planRevision ?? observation.error?.planRevision,
        });
      }
    }

    return {
      success: false,
      scratchpad,
      terminatedReason: 'max_cycles',
      finalMessage: 'A ReAct ciklus elérte a maximális iterációszámot.',
    };
  }
}
