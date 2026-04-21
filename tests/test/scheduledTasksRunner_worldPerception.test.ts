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

const worldHarness = vi.hoisted(() => ({
  runWorldPerceptionCycle: vi.fn(),
}));

const hookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => ({
    prepare: dbHarness.mockPrepare,
    pragma: vi.fn(),
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
  runWeeklySelfImprovementCycle: vi.fn(),
}));

vi.mock('../src/core/worldPerceptionLayer.js', () => ({
  runWorldPerceptionCycle: worldHarness.runWorldPerceptionCycle,
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

describe('ScheduledTasksRunner world-perception handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    worldHarness.runWorldPerceptionCycle.mockReturnValue({
      triggeredAt: '2026-04-11T10:00:00.000Z',
      scannedCards: 4,
      ingestedSignals: 3,
      createdSignals: 2,
      refreshedSignals: 1,
      topSignals: [],
    });
  });

  it('ensures the world perception scheduled task', async () => {
    await (scheduledTasksRunner as { ensureWorldPerceptionTask: () => Promise<void> }).ensureWorldPerceptionTask();

    expect(dbHarness.mockPrepare).toHaveBeenCalled();
    expect(dbHarness.mockRun).toHaveBeenCalledWith(
      'world-perception-sweep',
      'World Perception Sweep',
      expect.stringContaining('knowledge cards'),
      '0 */6 * * *',
      'world_perception_cycle',
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('executes the world_perception_cycle handler with parsed metadata', async () => {
    const result = await scheduledTasksRunner.executeTask({
      id: 'world-perception-sweep',
      title: 'World Perception Sweep',
      prompt: 'Run world perception',
      cron_expression: '0 */6 * * *',
      handler: 'world_perception_cycle',
      enabled: true,
      metadata: JSON.stringify({ limit: 9 }),
    });

    expect(worldHarness.runWorldPerceptionCycle).toHaveBeenCalledWith(9);
    expect(result).toEqual(expect.objectContaining({ ingestedSignals: 3 }));
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'cron:daily:world-perception',
      expect.objectContaining({ taskId: 'world-perception-sweep' }),
      expect.anything(),
    );
  });
});
