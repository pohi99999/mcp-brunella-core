/**
 * PAIOS Orchestrator Core — feladat dekompozíció + agent delegálás
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { agentManager } from '../agents/AgentManager.js';
import { logInfo, logError } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PlanStep {
  phase: string;
  agent: string;
  task: string;
}

export interface TaskRequest {
  agent: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
}

export interface OrchestratorPlan {
  plan: PlanStep[];
  tasks: TaskRequest[];
  summary: string;
}

export interface OrchestratorResponse {
  success: boolean;
  summary: string;
  plan: PlanStep[];
  taskIds: number[];  // AgentManager taskId is number!
  error?: string;
}

/**
 * Fő funkció: magyar nyelvű chat → OrchestratorAgent (ReAct loop)
 */
export async function processChat(
  message: string,
  model?: string,
): Promise<OrchestratorResponse> {
  try {
    logInfo('OrchestratorCore', `Delegating chat to OrchestratorAgent: "${message.slice(0, 100)}..."`);

    // Ahelyett, hogy saját magunk hívjuk meg a BifrostGateway-t és JSON terveket generálnánk,
    // átadjuk az irányítást a frissített "Zero-Mock" OrchestratorAgent-nek, ami valós Tool Callingot használ.
    const result = await agentManager.delegate('orchestrator', message) as any;

    return {
      success: result.success || result.status === 'success',
      summary: result.message || 'Feladat feldolgozva.',
      plan: [], // Nincs több fiktív Markdown terv
      taskIds: result.taskIds || [],
      error: result.error,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('OrchestratorCore', `processChat failed: ${error}`);
    return {
      success: false,
      summary: 'Hiba történt a feladat feldolgozása során.',
      plan: [],
      taskIds: [],
      error,
    };
  }
}

