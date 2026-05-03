/**
 * PAIOS Remote Integration — Phase 3
 * Bridges PAIOS sessions, streams, and actions into the Remote Event Bridge.
 *
 * In PAIOS, "actions" are high-level goals dispatched to AI workers.
 * This module translates them into remote commands that the session manager
 * can track and execute, and publishes lifecycle events via the bridge.
 */

import { agentManager } from '@packages/agents/AgentManager.js';
import { logError, logInfo } from '@packages/utils/logger.js';
import { remoteEventBridge } from './remoteEventBridge.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaiosAction {
  actionId: string;
  type: string;
  description: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export interface PaiosActionResult {
  actionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

// ─── Action Queue ────────────────────────────────────────────────────────────

const queue: PaiosAction[] = [];
const SUPPORTED_ACTION_TYPES = ['agent_run', 'agent_delegate', 'agent_status', 'orchestrator_message', 'remote_help'] as const;

/**
 * Enqueue a PAIOS action for execution.
 * Publishes a bridge event so all subscribers are notified.
 */
export function enqueuePaiosAction(sessionId: string, action: PaiosAction): PaiosActionResult {
  queue.push(action);

  logInfo('PaiosIntegration', `Enqueued actionId=${action.actionId} type=${action.type}`);

  remoteEventBridge.publish({
    type: 'paios:action:queued',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: action.actionId, type: action.type },
  });

  return { actionId: action.actionId, status: 'queued' };
}

/**
 * Process the next action in the queue through a real runtime dispatch path.
 */
export async function processNextPaiosAction(sessionId: string): Promise<PaiosActionResult | null> {
  const action = queue.shift();
  if (!action) {
    return null;
  }

  logInfo('PaiosIntegration', `Processing actionId=${action.actionId} type=${action.type}`);

  remoteEventBridge.publish({
    type: 'paios:action:running',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: action.actionId },
  });

  let result: PaiosActionResult;
  try {
    result = {
      actionId: action.actionId,
      status: 'completed',
      result: await dispatchPaiosAction(sessionId, action),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('PaiosIntegration', `Action failed actionId=${action.actionId}: ${message}`);
    result = {
      actionId: action.actionId,
      status: 'failed',
      error: message,
    };
  }

  remoteEventBridge.publish({
    type: result.status === 'failed' ? 'paios:action:failed' : 'paios:action:completed',
    source: 'PaiosIntegration',
    sessionId,
    payload: { actionId: result.actionId, status: result.status, result: result.result, error: result.error },
  });

  return result;
}

/**
 * Return the current queue length and action IDs for status inspection.
 */
export function getPaiosQueueStatus(): { length: number; actionIds: string[] } {
  return { length: queue.length, actionIds: queue.map(a => a.actionId) };
}

async function dispatchPaiosAction(sessionId: string, action: PaiosAction): Promise<unknown> {
  switch (action.type) {
    case 'agent_run':
    case 'agent_delegate':
      return queueAgentAction(sessionId, action);
    case 'agent_status':
      return getAgentStatus(action);
    case 'orchestrator_message':
      return runOrchestratorMessage(sessionId, action);
    case 'remote_help':
      return {
        supportedActionTypes: [...SUPPORTED_ACTION_TYPES],
        payloadHints: {
          agent_run: ['agentId or agentName', 'task or instruction'],
          orchestrator_message: ['message', 'provider?', 'model?'],
        },
      };
    default:
      throw new Error(`Unsupported PAIOS action type: ${action.type}. Supported: ${SUPPORTED_ACTION_TYPES.join(', ')}`);
  }
}

async function queueAgentAction(sessionId: string, action: PaiosAction): Promise<unknown> {
  const agentName = getString(action.payload.agentId) ?? getString(action.payload.agentName);
  if (!agentName) {
    throw new Error('agent_run requires payload.agentId or payload.agentName');
  }

  const task = getString(action.payload.task)
    ?? getString(action.payload.instruction)
    ?? action.description;
  const taskId = await agentManager.queueTask(task, agentName, {
    source: 'paios_remote_action',
    sessionId,
    actionId: action.actionId,
    actionType: action.type,
    payload: action.payload,
  });

  return {
    dispatched: true,
    dispatch: 'agent_queue',
    agentName,
    task,
    taskId,
  };
}

function getAgentStatus(action: PaiosAction): unknown {
  const agentName = getString(action.payload.agentId) ?? getString(action.payload.agentName);
  if (!agentName) {
    throw new Error('agent_status requires payload.agentId or payload.agentName');
  }

  const statuses = agentManager.listAgentStatuses();
  const status = statuses.find((agent) => agent.name.toLowerCase() === agentName.toLowerCase());
  if (!status) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  return {
    agentName: status.name,
    status: status.status,
    lastTask: status.lastTask,
    errorCount: status.errorCount,
  };
}

async function runOrchestratorMessage(sessionId: string, action: PaiosAction): Promise<unknown> {
  const message = getString(action.payload.message) ?? action.description;
  const provider = getString(action.payload.provider) ?? 'github';
  const model = getString(action.payload.model);
  const { getUniversalOrchestratorService } = await import('./universalOrchestratorService.js');
  const response = await getUniversalOrchestratorService().process({
    message,
    provider,
    model,
    conversationHistory: [],
    sessionId,
  });

  return {
    dispatched: true,
    dispatch: 'universal_orchestrator',
    reply: response.reply,
    actionsTriggered: response.actionsTriggered,
    provider: response.provider,
    model: response.model,
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

