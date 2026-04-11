import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));

const selfModHarness = vi.hoisted(() => ({
  runWeeklySelfImprovementCycle: vi.fn(),
}));

const hookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => ({
    prepare: mockPrepare,
  })),
}));

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHook: hookHarness.fireHook,
  fireHookSafely: hookHarness.fireHook,
}));

vi.mock('../src/core/eventFabric.js', () => ({
  eventFabric: { publish: vi.fn() },
  createSchedulerTaskOutcomeEnvelope: vi.fn((_task: unknown, outcome: unknown) => outcome),
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn(async () => ({ success: true })),
    delegateTask: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('../src/core/selfModificationEngine.js', () => ({
  runWeeklySelfImprovementCycle: selfModHarness.runWeeklySelfImprovementCycle,
}));

vi.mock('../src/server/services/projectMaintainerService.js', () => ({
  runProjectMaintainerReport: vi.fn(),
  initProjectMaintainerSchema: vi.fn(),
}));

vi.mock('../src/core/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      ingestProjectMaintainerReport: vi.fn(),
      runNightlyCycle: vi.fn(),
    }),
  },
}));

vi.mock('../src/server/services/crmFollowUpExecutionService.js', () => ({
  executeDueCrmFollowUpActions: vi.fn(),
}));

vi.mock('../src/server/services/hrTimesheetService.js', () => ({
  runMonthlyPayrollExport: vi.fn(),
  runDailyCultureAlerts: vi.fn(),
  resolveSchedulerExportMonth: vi.fn(() => '2026-04'),
}));

import { scheduledTasksRunner } from '../src/server/schedulers/scheduledTasksRunner.js';

describe('ScheduledTasksRunner self-modification handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selfModHarness.runWeeklySelfImprovementCycle.mockResolvedValue({
      triggeredAt: '2026-04-11T10:00:00.000Z',
      weakAgents: [],
      createdProposalId: 'proposal-42',
      targetAgent: 'MarketingDirector',
    });
  });

  it('ensures the weekly self-improvement scheduled task', async () => {
    await (scheduledTasksRunner as any).ensureSelfImprovementTask();

    expect(mockPrepare).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(
      'weekly-self-improvement',
      'Weekly Self-Improvement Cycle',
      expect.stringContaining('weekly DynamicAgent self-modification cycle'),
      '0 6 * * 1',
      'self_modification_cycle',
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('executes the self_modification_cycle handler with parsed metadata', async () => {
    const result = await scheduledTasksRunner.executeTask({
      id: 'weekly-self-improvement',
      title: 'Weekly Self-Improvement Cycle',
      prompt: 'Run weekly self-improvement',
      cron_expression: '0 6 * * 1',
      handler: 'self_modification_cycle',
      enabled: true,
      metadata: JSON.stringify({
        successThreshold: 0.82,
        durationThresholdMs: 12_000,
        minRuns: 5,
      }),
    });

    expect(selfModHarness.runWeeklySelfImprovementCycle).toHaveBeenCalledWith({
      successThreshold: 0.82,
      durationThresholdMs: 12_000,
      minRuns: 5,
    });
    expect(result).toEqual(expect.objectContaining({ createdProposalId: 'proposal-42' }));
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'cron:weekly:self-improve',
      expect.objectContaining({ taskId: 'weekly-self-improvement' }),
      expect.anything(),
    );
  });
});
