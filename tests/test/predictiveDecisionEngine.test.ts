import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PredictiveAlert } from '@packages/core-logic/predictiveIntelligence.js';

const dbHarness = vi.hoisted(() => {
  const decisionRuns: Array<Record<string, unknown>> = [];

  const cloneRow = (row: Record<string, unknown>) => ({ ...row });

  const buildStatement = (sql: string) => ({
    run: (...args: unknown[]) => {
      if (sql.includes('INSERT INTO predictive_decision_runs')) {
        const [
          id,
          triggered_by,
          scenario_count,
          selected_score,
          action_type,
          selected_scenario_json,
          scenarios_json,
          executed_action_json,
          rollback_data_json,
          rollback_capable,
          outcome,
          metadata_json,
          created_at,
          rolled_back_at,
        ] = args;

        decisionRuns.push({
          id,
          triggered_by,
          scenario_count,
          selected_score,
          action_type,
          selected_scenario_json,
          scenarios_json,
          executed_action_json,
          rollback_data_json,
          rollback_capable,
          outcome,
          metadata_json,
          created_at,
          rolled_back_at,
        });

        return { changes: 1 };
      }

      if (sql.includes('UPDATE predictive_decision_runs')) {
        const [rolledBackAt, decisionId] = args;
        const row = decisionRuns.find((entry) => entry.id === decisionId);
        if (row) {
          row.outcome = 'rolled_back';
          row.rolled_back_at = rolledBackAt;
        }
        return { changes: row ? 1 : 0 };
      }

      return { changes: 0 };
    },
    get: (...args: unknown[]) => {
      if (sql.includes('WHERE id = ?')) {
        const row = decisionRuns.find((entry) => entry.id === args[0]);
        return row ? cloneRow(row) : undefined;
      }
      return undefined;
    },
    all: (...args: unknown[]) => {
      if (sql.includes('WHERE created_at >= ?')) {
        const from = String(args[0]);
        return decisionRuns
          .filter((entry) => String(entry.created_at) >= from)
          .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
          .map(cloneRow);
      }

      if (sql.includes('ORDER BY created_at DESC') && sql.includes('LIMIT ?')) {
        const limit = Number(args[0]);
        return decisionRuns
          .slice()
          .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
          .slice(0, limit)
          .map(cloneRow);
      }

      return [];
    },
  });

  const mockPrepare = vi.fn((sql: string) => buildStatement(sql));
  const mockExec = vi.fn();

  return {
    decisionRuns,
    mockPrepare,
    mockExec,
    reset() {
      decisionRuns.length = 0;
      mockPrepare.mockClear();
      mockExec.mockClear();
    },
  };
});

const goalHarness = vi.hoisted(() => ({
  getGoals: vi.fn(),
  createGoal: vi.fn(),
  setGoalStatus: vi.fn(),
}));

const predictiveHarness = vi.hoisted(() => ({
  listAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  unacknowledgeAlert: vi.fn(),
}));

const worldHarness = vi.hoisted(() => ({
  listWorldSignals: vi.fn(),
}));

const reviewHarness = vi.hoisted(() => ({
  listReviewQueue: vi.fn(),
}));

const hookHarness = vi.hoisted(() => ({
  fireHookSafely: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => ({
    exec: dbHarness.mockExec,
    prepare: dbHarness.mockPrepare,
  })),
}));

vi.mock('@packages/core-logic/autonomousInfraRuntime.js', () => ({
  goalEngine: {
    getGoals: goalHarness.getGoals,
    createGoal: goalHarness.createGoal,
    setGoalStatus: goalHarness.setGoalStatus,
  },
}));

vi.mock('@packages/core-logic/predictiveIntelligence.js', () => ({
  PredictiveIntelligence: {
    getInstance: () => ({
      listAlerts: predictiveHarness.listAlerts,
      acknowledgeAlert: predictiveHarness.acknowledgeAlert,
      unacknowledgeAlert: predictiveHarness.unacknowledgeAlert,
    }),
  },
}));

vi.mock('@packages/core-logic/worldPerceptionLayer.js', () => ({
  listWorldSignals: worldHarness.listWorldSignals,
}));

vi.mock('@packages/core-logic/intelligenceMonitor.js', () => ({
  listReviewQueue: reviewHarness.listReviewQueue,
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHookSafely: hookHarness.fireHookSafely,
}));

import { PredictiveDecisionEngine } from '@packages/core-logic/predictiveDecisionEngine.js';

function makeAlert(overrides: Partial<PredictiveAlert> = {}): PredictiveAlert {
  return {
    id: 'alert-1',
    type: 'performance_drop',
    severity: 'high',
    title: 'Cost spike',
    description: 'Infrastructure cost spiked sharply.',
    suggestedAction: 'Create a follow-up goal and investigate.',
    confidence: 0.94,
    data: {},
    createdAt: Date.now(),
    acknowledged: false,
    ...overrides,
  };
}

describe('PredictiveDecisionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbHarness.reset();
    goalHarness.getGoals.mockReturnValue([]);
    goalHarness.createGoal.mockImplementation((goal) => ({
      goalId: 'goal-42',
      title: goal.title,
      category: goal.category,
      metric: goal.metric,
      direction: goal.direction,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      priority: goal.priority,
      rationale: goal.rationale,
      status: goal.status ?? 'proposed',
      createdAt: Date.now(),
    }));
    goalHarness.setGoalStatus.mockImplementation((goalId, status) => ({
      goalId,
      status,
    }));
    predictiveHarness.listAlerts.mockReturnValue([makeAlert()]);
    predictiveHarness.acknowledgeAlert.mockReturnValue(true);
    predictiveHarness.unacknowledgeAlert.mockReturnValue(true);
    worldHarness.listWorldSignals.mockReturnValue([]);
    reviewHarness.listReviewQueue.mockReturnValue([]);
  });

  it('generates deterministic scenario scores for the same seed and persists history', async () => {
    const engine = new PredictiveDecisionEngine();

    const first = await engine.analyzeDecisionPoint('manual_test', {
      scenarioCount: 8,
      seed: 11,
      selectionThreshold: 0.55,
    });
    const second = await engine.analyzeDecisionPoint('manual_test', {
      scenarioCount: 8,
      seed: 11,
      selectionThreshold: 0.55,
    });

    expect(first.selectedScenario?.action.type).toBe('create_goal');
    expect(second.selectedScenario?.action.type).toBe('create_goal');
    expect(first.scenarios.map((scenario) => scenario.totalScore)).toEqual(
      second.scenarios.map((scenario) => scenario.totalScore),
    );
    expect(goalHarness.createGoal).toHaveBeenCalledTimes(2);

    const history = engine.getDecisionHistory(2);
    expect(history).toHaveLength(2);
    expect(history[0].outcome).toBe('executed');
    expect(engine.getDecisionStats(30)).toEqual(expect.objectContaining({
      totalDecisions: 2,
      actionsExecuted: 2,
      rolledBackActions: 0,
    }));
  });

  it('rolls back acknowledged alerts when create-goal candidates are already open', async () => {
    goalHarness.getGoals.mockReturnValue([
      {
        goalId: 'goal-existing',
        title: 'Existing goal',
        category: 'efficiency',
        metric: 'predictive:performance_drop:cost-spike',
        direction: 'decrease',
        targetValue: 0,
        currentValue: 1,
        priority: 80,
        rationale: 'Already tracking this alert.',
        status: 'active',
        createdAt: Date.now(),
      },
    ]);
    predictiveHarness.listAlerts.mockReturnValue([
      makeAlert({ severity: 'medium', confidence: 0.91 }),
    ]);

    const engine = new PredictiveDecisionEngine();
    const result = await engine.analyzeDecisionPoint('manual_test', {
      scenarioCount: 6,
      seed: 7,
      selectionThreshold: 0.4,
    });

    expect(result.selectedScenario?.action.type).toBe('acknowledge_alert');
    expect(result.rollbackCapability).toBe(true);

    const rolledBack = await engine.rollbackDecision(result.id);

    expect(predictiveHarness.unacknowledgeAlert).toHaveBeenCalledWith('alert-1');
    expect(rolledBack.outcome).toBe('rolled_back');
    expect(engine.getDecisionStats(30)).toEqual(expect.objectContaining({
      totalDecisions: 1,
      actionsExecuted: 0,
      rolledBackActions: 1,
    }));
  });
});
