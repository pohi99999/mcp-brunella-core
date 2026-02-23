/**
 * PAIOS Orchestrator Core — feladat dekompozíció + agent delegálás
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BifrostGateway, type ProviderType } from '../core/bifrost_gateway.js';
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
 * Főf unkció: magyar nyelvű chat → LLM → task delegálás
 */
export async function processChat(
  message: string,
  model?: string,
): Promise<OrchestratorResponse> {
  try {
    logInfo('OrchestratorCore', `Processing chat: "${message.slice(0, 100)}..."`);

    // 1. Rendszerprompt betöltése
    const systemPromptPath = join(__dirname, 'systemPrompt', 'paios_orchestrator_prompt.md');
    const systemPrompt = await readFile(systemPromptPath, 'utf-8');

    // 2. LLM hívás (BifrostGateway használata)
    const fullPrompt = `${systemPrompt}\n\n---\n\n**Felhasználó kérése:**\n${message}`;
    
    logInfo('OrchestratorCore', `Routing task to LLM (model: ${model || 'auto'})`);
    
    const gateway = new BifrostGateway();
    const llmResult = await gateway.generate({
      prompt: fullPrompt,
      taskType: 'reasoning',
      provider: model as ProviderType | undefined,
      temperature: 0.7,
    });

    if (!llmResult.success || !llmResult.content) {
      logError('OrchestratorCore', `LLM generation failed: ${llmResult.error}`);
      return {
        success: false,
        summary: 'Hiba történt az LLM válasz generálása során.',
        plan: [],
        taskIds: [],
        error: llmResult.error,
      };
    }

    // 3. JSON parsing
    const parsed = parsePlan(llmResult.content);

    if (!parsed.summary) {
      logError('OrchestratorCore', 'LLM did not return valid JSON');
      return {
        success: false,
        summary: 'Hiba történt az LLM válasz feldolgozása során.',
        plan: [],
        taskIds: [],
        error: 'Invalid LLM response format',
      };
    }

    logInfo('OrchestratorCore', `Plan parsed: ${parsed.tasks.length} tasks identified`);

    // 4. AgentManager delegálás
    const taskIds: number[] = [];

    for (const taskReq of parsed.tasks) {
      try {
        // queueTask(description, agentName, context?)
        const taskId = await agentManager.queueTask(
          taskReq.task,  // description
          taskReq.agent, // agentName
          { priority: taskReq.priority }, // context
        );
        taskIds.push(taskId);
        logInfo('OrchestratorCore', `Task queued: ${taskReq.agent} → ${taskId}`);
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        logError('OrchestratorCore', `Failed to queue task for ${taskReq.agent}: ${error}`);
      }
    }

    return {
      success: true,
      summary: parsed.summary,
      plan: parsed.plan,
      taskIds,
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

/**
 * LLM válasz parsing (JSON extraction + fallback)
 */
function parsePlan(raw: string): OrchestratorPlan {
  try {
    // 1. Próbáljuk JSON-ként parse-olni az egész választ
    const parsed = JSON.parse(raw);
    if (parsed.plan && parsed.tasks && parsed.summary) {
      return parsed as OrchestratorPlan;
    }
  } catch {
    // Ignore, try regex extraction
  }

  try {
    // 2. Keressünk JSON blokkot a válaszban
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.plan && parsed.tasks && parsed.summary) {
        return parsed as OrchestratorPlan;
      }
    }
  } catch {
    // Ignore, fallback
  }

  // 3. Fallback: az egész választ adjuk vissza mint summary
  logError('OrchestratorCore', 'Failed to parse JSON from LLM response');
  return {
    plan: [],
    tasks: [],
    summary: raw.slice(0, 500) + (raw.length > 500 ? '...' : ''),
  };
}
