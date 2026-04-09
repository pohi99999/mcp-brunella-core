import { logInfo, logError } from '../utils/logger.js';

export interface SagaStep {
  name: string;
  execute: (context: Record<string, unknown>) => Promise<void>;
  compensate?: (context: Record<string, unknown>) => Promise<void>;
}

export interface SagaDefinition {
  id: string;
  steps: SagaStep[];
}

export interface SagaState {
  completedSteps: string[];
  context: Record<string, unknown>;
}

export class SagaOrchestrator {
  private states = new Map<string, SagaState>();

  private async loadOrCreate(id: string): Promise<SagaState> {
    if (!this.states.has(id)) {
      this.states.set(id, { completedSteps: [], context: {} });
    }
    return this.states.get(id)!;
  }

  private async saveState(id: string, state: SagaState) {
    this.states.set(id, state);
  }

  async execute(saga: SagaDefinition, initialContext: Record<string, unknown> = {}) {
    const state = await this.loadOrCreate(saga.id);
    state.context = { ...state.context, ...initialContext };
    
    for (const step of saga.steps) {
      if (state.completedSteps.includes(step.name)) continue;
      
      try {
        logInfo('SagaOrchestrator', `Executing step: ${step.name}`);
        await step.execute(state.context);
        state.completedSteps.push(step.name);
        await this.saveState(saga.id, state);
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('SagaOrchestrator', `Error in step ${step.name}: ${msg}. Starting compensation.`);
        
        for (const done of [...state.completedSteps].reverse()) {
          const completedStep = saga.steps.find(s => s.name === done);
          if (completedStep?.compensate) {
            try {
              logInfo('SagaOrchestrator', `Compensating step: ${done}`);
              await completedStep.compensate(state.context);
            } catch (compError) {
              const compMsg = compError instanceof Error ? compError.message : String(compError);
              logError('SagaOrchestrator', `Compensation failed for ${done}: ${compMsg}`);
            }
          }
        }
        throw error;
      }
    }
  }
}

export const sagaOrchestrator = new SagaOrchestrator();
