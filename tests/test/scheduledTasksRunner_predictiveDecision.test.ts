import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbHarness = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  const mockPrepare = vi.fn(() => ({
    run: mockRun,
    get: mockGet,
    all: mockAll,
  }));

  return {
    mockRun,
    mockPrepare,
  };
});

const predictiveHarness = vi.hoisted(() => ({
  analyzeDecisionPoint: vi.fn(),
}));

const hookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => ({
    prepare: dbHarness.mockPrepare,
    pragma: vi.fn(),
  })),
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHook: hookHarness.fireHook,
  fireHookSafely: hookHarness.fireHook,
}));

vi.mock('@packages/core-logic/eventFabric.js', () => ({
  eventFabric: { publish: vi.fn() },
  createSchedulerTaskOutcomeEnvelope: vi.fn((_task: unknown, outcome: unknown) => outcome),
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn(async () => ({ success: true })),
    delegateTask: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('@packages/core-logic/selfModificationEngine.js', () => ({
  runWeeklySelfImprovementCycle: vi.fn(),
}));

vi.mock('@packages/core-logic/worldPerceptionLayer.js', () => ({
  runWorldPerceptionCycle: vi.fn(),
}));

vi.mock('@packages/core-logic/predictiveDecisionEngine.js', () => ({
  PredictiveDecisionEngine: vi.fn().mockImplementation(() => ({
    analyzeDecisionPoint: predictiveHarness.analyzeDecisionPoint,
  })),
}));

vi.mock('@apps/mcp-core/server/services/projectMaintainerService.js', () => ({
  runProjectMaintainerReport: vi.fn(),
  initProjectMaintainerSchema: vi.fn(),
}));

vi.mock('@packages/core-logic/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      ingestProjectMaintainerReport: vi.fn(),
      runNightlyCycle: vi.fn(),
    }),
  },
}));

vi.mock('@apps/mcp-core/server/services/crmFollowUpExecutionService.js', () => ({
  executeDueCrmFollowUpActions: vi.fn(),
}));

vi.mock('@apps/mcp-core/server/services/hrTimesheetService.js', () => ({
  runMonthlyPayrollExport: vi.fn(),
  runDailyCultureAlerts: vi.fn(),
  resolveSchedulerExportMonth: vi.fn(() => '2026-04'),
}));

import { scheduledTasksRunner } from '@apps/mcp-core/server/schedulers/scheduledTasksRunner.js';

describe('ScheduledTasksRunner predictive decision handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    predictiveHarness.analyzeDecisionPoint.mockResolvedValue({
      id: 'pdr-1',
      outcome: 'executed',
      triggeredBy: 'scheduler',
      scenarios: [],
      selectedScenario: null,
      executedAction: null,
      rollbackCapability: false,
      createdAt: '2026-04-11T10:00:00.000Z',
      rolledBackAt: null,
      metadata: {
        activeAlerts: 0,
        signalCount: 0,
        reviewQueueCount: 0,
        activeGoals: 0,
        config: {
          scenarioCount: 12,
          riskWeight: 0.3,
          impactWeight: 0.4,
          alignmentWeight: 0.3,
          selectionThreshold: 0.58,
        },
      },
    });
  });

  it('ensures the predictive decision scheduled task', async () => {
    await (scheduledTasksRunner as { ensurePredictiveDecisionTask: () => Promise<void> }).ensurePredictiveDecisionTask();

    expect(dbHarness.mockPrepare).toHaveBeenCalled();
    expect(dbHarness.mockRun).toHaveBeenCalledWith(
      'predictive-decision-l5',
      'L5 Predictive Decision Analysis',
      expect.stringContaining('Monte Carlo simulation'),
      '*/15 * * * *',
      'predictive_decision',
      '{}',
      expect.any(String),
      expect.any(String),
    );
  });

  it('executes the predictive_decision handler through the engine', async () => {
    const result = await scheduledTasksRunner.executeTask({
      id: 'predictive-decision-l5',
      title: 'L5 Predictive Decision Analysis',
      prompt: 'Run predictive decision cycle',
      cron_expression: '*/15 * * * *',
      handler: 'predictive_decision',
      enabled: true,
      metadata: JSON.stringify({}),
    });

    expect(predictiveHarness.analyzeDecisionPoint).toHaveBeenCalledWith('scheduler');
    expect(result).toEqual(expect.objectContaining({ id: 'pdr-1', outcome: 'executed' }));
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'scheduler.task.succeeded',
      expect.objectContaining({ taskId: 'predictive-decision-l5' }),
      expect.anything(),
    );
  });
});
