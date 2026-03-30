/**
 * Ephemeral Agent Executor
 *
 * Bridge: EphemeralAgentSpec → DynamicAgent példányosítás → execute()
 * Lehetővé teszi, hogy egy spawn-olt ephemeral agent valóban LLM-et hívjon,
 * budgetet számoljon, és eredményt adjon vissza.
 */
import { DynamicAgent } from '../agents/DynamicAgent.js';
import { ephemeralAgentManager } from './ephemeralAgentManager.js';
import type { EphemeralAgentSpec } from './ephemeralAgentManager.js';
import { logInfo, logError } from '../utils/logger.js';

export interface EphemeralExecutionResult {
  agentId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  tokensUsed?: number;
  terminatedReason?: string;
}

export interface EphemeralExecuteRequest {
  spec: EphemeralAgentSpec & {
    systemPrompt?: string;  // egyedi prompt ehhez az agenthez
    name?: string;          // agent megjelenítési neve
  };
  task: string;             // az elvégzendő feladat szövege
  context?: Record<string, unknown>;
}

/**
 * Spawn + execute + terminate egy ephemeral agent-et.
 * A teljes életciklust kezeli, eredményt ad vissza.
 */
export async function executeEphemeralAgent(
  request: EphemeralExecuteRequest,
): Promise<EphemeralExecutionResult> {
  const { spec, task, context } = request;
  const agentName = spec.name ?? `Ephemeral_${Date.now()}`;

  const record = await ephemeralAgentManager.spawn(spec);
  const agentId = record.id;

  logInfo('EphemeralExecutor', `Executing task for ${agentId} (${agentName}): ${task.slice(0, 60)}`);

  try {
    const dynamicAgent = new DynamicAgent({
      name: agentName,
      description: spec.purpose,
      systemPrompt: spec.systemPrompt ?? `Te egy specializált ügynök vagy. Feladatod: ${spec.purpose}`,
      query: '${task}',
      tags: spec.allowedTools,
    });

    const response = await dynamicAgent.execute(task, context);

    // tokenbecslés a kimenet hossza alapján ha nincs jobb adat
    const estimatedTokens = Math.ceil(
      (task.length + (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data ?? '').length)) / 4
    );

    await ephemeralAgentManager.recordUsage(agentId, estimatedTokens, 0, 1);

    ephemeralAgentManager.terminate(agentId, 'task_complete');
    logInfo('EphemeralExecutor', `Ephemeral agent ${agentId} befejezve`);

    return {
      agentId,
      success: response.status === 'success',
      data: response.data,
      error: response.error,
      tokensUsed: estimatedTokens,
    };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logError('EphemeralExecutor', `Ephemeral agent ${agentId} hiba: ${errMsg}`);
    ephemeralAgentManager.terminate(agentId, `error: ${errMsg}`);

    return {
      agentId,
      success: false,
      error: errMsg,
      terminatedReason: `error: ${errMsg}`,
    };
  }
}
