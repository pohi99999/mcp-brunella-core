import { randomUUID } from 'crypto';

import { goalEngine } from './autonomousInfraRuntime.js';
import type { DecisionAction, RollbackResult, ActionResult } from './decisionTypes.js';
import { PredictiveIntelligence } from './predictiveIntelligence.js';
import { logError, logInfo } from '@packages/utils/logger.js';

function nowIso(): string {
  return new Date().toISOString();
}

export async function executeDecisionAction(action: DecisionAction): Promise<ActionResult> {
  const executedAt = nowIso();
  const actionId = `pdr_${randomUUID()}`;

  try {
    if (action.type === 'create_goal') {
      const result = executeCreateGoal(action);
      return {
        success: true,
        actionId,
        actionType: action.type,
        description: action.description,
        resultData: result.resultData,
        rollbackData: result.rollbackData,
        executedAt,
      };
    }

    if (action.type === 'acknowledge_alert') {
      const result = executeAcknowledgeAlert(action);
      return {
        success: true,
        actionId,
        actionType: action.type,
        description: action.description,
        resultData: result.resultData,
        rollbackData: result.rollbackData,
        executedAt,
      };
    }

    const result = executeEscalation(action);
    return {
      success: true,
      actionId,
      actionType: action.type,
      description: action.description,
      resultData: result.resultData,
      rollbackData: null,
      executedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('DecisionExecutor', `Failed to execute ${action.type}: ${message}`);
    return {
      success: false,
      actionId,
      actionType: action.type,
      description: action.description,
      error: message,
      rollbackData: null,
      executedAt,
    };
  }
}

export async function rollbackDecisionAction(
  actionType: DecisionAction['type'],
  rollbackData: Record<string, unknown>,
): Promise<RollbackResult> {
  const rolledBackAt = nowIso();

  try {
    if (actionType === 'create_goal') {
      const goalId = String(rollbackData.goalId ?? '');
      if (!goalId) {
        throw new Error('Missing goalId for rollback');
      }
      const goal = goalEngine.setGoalStatus(goalId, 'abandoned', 'Predictive decision rollback');
      if (!goal) {
        throw new Error(`Goal not found for rollback: ${goalId}`);
      }
      return {
        success: true,
        actionType,
        rollbackData: {
          goalId: goal.goalId,
          status: goal.status,
        },
        rolledBackAt,
      };
    }

    if (actionType === 'acknowledge_alert') {
      const alertId = String(rollbackData.alertId ?? '');
      if (!alertId) {
        throw new Error('Missing alertId for rollback');
      }
      const intelligence = PredictiveIntelligence.getInstance();
      const reverted = intelligence.unacknowledgeAlert(alertId);
      if (!reverted) {
        throw new Error(`Alert not found for rollback: ${alertId}`);
      }
      return {
        success: true,
        actionType,
        rollbackData: { alertId, acknowledged: false },
        rolledBackAt,
      };
    }

    throw new Error(`Rollback is not supported for ${actionType}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('DecisionExecutor', `Failed to rollback ${actionType}: ${message}`);
    return {
      success: false,
      actionType,
      error: message,
      rolledBackAt,
    };
  }
}

function executeCreateGoal(action: DecisionAction): {
  resultData: Record<string, unknown>;
  rollbackData: Record<string, unknown>;
} {
  const {
    title,
    category,
    metric,
    direction,
    targetValue,
    currentValue,
    priority,
    rationale,
  } = action.payload as {
    title?: string;
    category?: 'resilience' | 'efficiency' | 'autonomy' | 'alignment' | 'growth';
    metric?: string;
    direction?: 'increase' | 'decrease';
    targetValue?: number;
    currentValue?: number;
    priority?: number;
    rationale?: string;
  };

  if (!title || !category || !metric || !direction || typeof targetValue !== 'number' || typeof currentValue !== 'number' || typeof priority !== 'number' || !rationale) {
    throw new Error('Incomplete create_goal payload');
  }

  const goal = goalEngine.createGoal({
    title,
    category,
    metric,
    direction,
    targetValue,
    currentValue,
    priority,
    rationale,
    status: 'proposed',
  });

  logInfo('DecisionExecutor', `Created predictive goal ${goal.goalId}`);
  return {
    resultData: {
      goalId: goal.goalId,
      title: goal.title,
      status: goal.status,
    },
    rollbackData: {
      goalId: goal.goalId,
    },
  };
}

function executeAcknowledgeAlert(action: DecisionAction): {
  resultData: Record<string, unknown>;
  rollbackData: Record<string, unknown>;
} {
  const { alertId } = action.payload as { alertId?: string };
  if (!alertId) {
    throw new Error('Missing alertId');
  }

  const intelligence = PredictiveIntelligence.getInstance();
  const acknowledged = intelligence.acknowledgeAlert(alertId);
  if (!acknowledged) {
    throw new Error(`Alert not found: ${alertId}`);
  }

  logInfo('DecisionExecutor', `Acknowledged predictive alert ${alertId}`);
  return {
    resultData: { alertId, acknowledged: true },
    rollbackData: { alertId },
  };
}

function executeEscalation(action: DecisionAction): {
  resultData: Record<string, unknown>;
} {
  const { sourceId, sourceType, reason } = action.payload as {
    sourceId?: string;
    sourceType?: string;
    reason?: string;
  };

  logInfo(
    'DecisionExecutor',
    `Escalated ${sourceType ?? 'unknown'} ${sourceId ?? 'unknown'} to review: ${reason ?? action.description}`,
  );

  return {
    resultData: {
      sourceId: sourceId ?? null,
      sourceType: sourceType ?? null,
      escalated: true,
      reason: reason ?? action.description,
    },
  };
}

