import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  createGoal: vi.fn(),
  setGoalStatus: vi.fn(),
  acknowledgeAlert: vi.fn(),
  unacknowledgeAlert: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'action-uuid'),
}));

vi.mock('../src/core/autonomousInfraRuntime.js', () => ({
  goalEngine: {
    createGoal: harness.createGoal,
    setGoalStatus: harness.setGoalStatus,
  },
}));

vi.mock('../src/core/predictiveIntelligence.js', () => ({
  PredictiveIntelligence: {
    getInstance: () => ({
      acknowledgeAlert: harness.acknowledgeAlert,
      unacknowledgeAlert: harness.unacknowledgeAlert,
    }),
  },
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: harness.logInfo,
  logError: harness.logError,
}));

import { executeDecisionAction, rollbackDecisionAction } from '../src/core/decisionExecutor.js';

describe('decisionExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T10:00:00.000Z'));
    vi.clearAllMocks();

    harness.createGoal.mockReturnValue({
      goalId: 'goal-1',
      title: 'Respond to latency spike',
      status: 'proposed',
    });
    harness.setGoalStatus.mockReturnValue({
      goalId: 'goal-1',
      status: 'abandoned',
    });
    harness.acknowledgeAlert.mockReturnValue(true);
    harness.unacknowledgeAlert.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should_create_goal_when_payload_is_complete_and_include_rollback_data', async () => {
    const result = await executeDecisionAction({
      type: 'create_goal',
      description: 'Create a follow-up goal',
      reversible: true,
      payload: {
        title: 'Respond to latency spike',
        category: 'efficiency',
        metric: 'predictive:latency-spike',
        direction: 'decrease',
        targetValue: 0,
        currentValue: 1,
        priority: 88,
        rationale: 'Latency is trending upward.',
      },
    });

    expect(harness.createGoal).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Respond to latency spike',
      status: 'proposed',
    }));
    expect(result).toEqual(expect.objectContaining({
      success: true,
      actionId: 'pdr_action-uuid',
      actionType: 'create_goal',
      rollbackData: { goalId: 'goal-1' },
    }));
  });

  it('should_return_failed_result_when_create_goal_payload_is_incomplete_and_error_is_reported', async () => {
    const result = await executeDecisionAction({
      type: 'create_goal',
      description: 'Create a follow-up goal',
      reversible: true,
      payload: {
        title: 'Respond to latency spike',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Incomplete create_goal payload');
    expect(harness.logError).toHaveBeenCalledWith(
      'DecisionExecutor',
      expect.stringContaining('Incomplete create_goal payload'),
    );
  });

  it('should_acknowledge_alert_when_alert_exists_and_unacknowledge_it_when_rollback_is_requested', async () => {
    const actionResult = await executeDecisionAction({
      type: 'acknowledge_alert',
      description: 'Acknowledge the alert',
      reversible: true,
      payload: {
        alertId: 'alert-7',
      },
    });
    const rollbackResult = await rollbackDecisionAction('acknowledge_alert', {
      alertId: 'alert-7',
    });

    expect(harness.acknowledgeAlert).toHaveBeenCalledWith('alert-7');
    expect(actionResult).toEqual(expect.objectContaining({
      success: true,
      rollbackData: { alertId: 'alert-7' },
    }));
    expect(harness.unacknowledgeAlert).toHaveBeenCalledWith('alert-7');
    expect(rollbackResult).toEqual(expect.objectContaining({
      success: true,
      rollbackData: { alertId: 'alert-7', acknowledged: false },
    }));
  });

  it('should_return_failed_rollback_when_action_type_is_not_supported_and_error_is_logged', async () => {
    const rollbackResult = await rollbackDecisionAction('escalate_review', {
      sourceId: 'review-1',
    });

    expect(rollbackResult.success).toBe(false);
    expect(rollbackResult.error).toContain('Rollback is not supported');
    expect(harness.logError).toHaveBeenCalledWith(
      'DecisionExecutor',
      expect.stringContaining('Rollback is not supported'),
    );
  });
});
