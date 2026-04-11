// src/core/strategicGoalEngine.ts
// The system defines its own strategic goals autonomously

import { randomUUID } from 'crypto';
import { logInfo } from '../utils/logger.js';

export interface Goal {
  id: string;
  title: string;
  why: string;
  measurement: string;
  agents: string[];
  createdAt: string;
}

export type OrganizationalContext = Record<string, unknown>;

export class StrategicGoalEngine {
  /**
   * Generates 3 strategic priorities from the provided context.
   * In production this delegates to the OrchestratorAgent via AgentManager;
   * here it returns a deterministic default set so the class is usable
   * without a live LLM.
   */
  async generateGoals(context: OrganizationalContext): Promise<Goal[]> {
    logInfo('StrategicGoalEngine', 'Generating organizational goals from context');

    // Lazy-load AgentManager to avoid circular dependencies
    let goals: Goal[] | null = null;
    try {
      const { agentManager } = await import('../agents/AgentManager.js');
      const orchestrator = agentManager.getAgent('Orchestrator');
      if (orchestrator) {
        const prompt = `Based on the following organizational context, define 3 priority goals.
For each goal provide: title, why it matters, how to measure success, which agents should work on it.
Respond as a JSON array of objects with fields: title, why, measurement, agents (string[]).
Context: ${JSON.stringify(context)}`;
        const result = await orchestrator.execute(prompt) as Record<string, unknown>;
        if (result?.['status'] === 'success' && Array.isArray(result['data'])) {
          goals = (result['data'] as Array<Partial<Goal>>).map(g => ({
            id: randomUUID(),
            title: g.title ?? 'Unnamed goal',
            why: g.why ?? '',
            measurement: g.measurement ?? '',
            agents: g.agents ?? [],
            createdAt: new Date().toISOString(),
          }));
        }
      }
    } catch {
      // AgentManager not available — fall through to defaults
    }

    if (goals) return goals;

    // Default goals when LLM is unavailable
    return [
      {
        id: randomUUID(),
        title: 'Increase task automation coverage',
        why: 'Reduces manual work and operational cost',
        measurement: 'Tasks automated per week',
        agents: ['Orchestrator', 'Developer'],
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        title: 'Improve knowledge base quality',
        why: 'Better RAG retrieval improves agent accuracy',
        measurement: 'Golden dataset size and retrieval precision',
        agents: ['DataScientist', 'Researcher'],
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        title: 'Reduce system operational cost',
        why: 'Keep LLM costs under budget threshold',
        measurement: 'Daily USD spend vs target',
        agents: ['Evaluator'],
        createdAt: new Date().toISOString(),
      },
    ];
  }
}
