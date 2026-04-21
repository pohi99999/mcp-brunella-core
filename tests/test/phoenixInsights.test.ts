import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/tools/dataFlywheelMetrics.js', () => ({
  buildDataFlywheelMetricsSnapshot: vi.fn(),
}));

vi.mock('../src/core/checkpoint.js', () => ({
  getCheckpointStats: vi.fn(),
  listActiveCheckpoints: vi.fn(),
}));

vi.mock('../src/core/failoverRegistry.js', () => ({
  failoverRegistry: {
    getStats: vi.fn(),
    getAttempts: vi.fn(),
  },
}));

vi.mock('../src/core/githubRemediationRuntime.js', () => ({
  githubRemediationRuntime: {
    getSummary: vi.fn(),
    listRuns: vi.fn(),
  },
}));

vi.mock('../src/core/gitRecovery.js', () => ({
  getRecoveryLog: vi.fn(),
}));

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    getStats: vi.fn(),
    getHistory: vi.fn(),
  },
}));

vi.mock('../src/utils/heartbeatMonitor.js', () => ({
  heartbeatMonitor: {
    getOverallHealth: vi.fn(),
  },
}));

import {
  buildPhoenixFlywheelObservabilitySnapshot,
  renderPhoenixFlywheelMarkdown,
} from '../src/tools/phoenixInsights.js';
import { buildDataFlywheelMetricsSnapshot } from '../src/tools/dataFlywheelMetrics.js';
import { getCheckpointStats, listActiveCheckpoints } from '../src/core/checkpoint.js';
import { failoverRegistry } from '../src/core/failoverRegistry.js';
import { githubRemediationRuntime } from '../src/core/githubRemediationRuntime.js';
import { getRecoveryLog } from '../src/core/gitRecovery.js';
import { phoenixEventBus } from '../src/core/phoenixEventBus.js';
import { heartbeatMonitor } from '../src/utils/heartbeatMonitor.js';

const mockedBuildDataFlywheelMetricsSnapshot = vi.mocked(buildDataFlywheelMetricsSnapshot);
const mockedGetCheckpointStats = vi.mocked(getCheckpointStats);
const mockedListActiveCheckpoints = vi.mocked(listActiveCheckpoints);
const mockedFailoverRegistry = vi.mocked(failoverRegistry);
const mockedGitHubRemediationRuntime = vi.mocked(githubRemediationRuntime);
const mockedGetRecoveryLog = vi.mocked(getRecoveryLog);
const mockedPhoenixEventBus = vi.mocked(phoenixEventBus);
const mockedHeartbeatMonitor = vi.mocked(heartbeatMonitor);

function buildFlywheelSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    checkedAt: '2026-04-08T12:00:00.000Z',
    golden: {
      totalSamples: 80,
      newSinceLastTraining: 12,
      lastTrainingAt: '2026-04-08T10:00:00.000Z',
      avgQuality: 0.91,
      status: 'healthy',
      sourceBreakdown: [
        { label: 'tasks', value: 40 },
        { label: 'docs', value: 22 },
        { label: 'remediation', value: 18 },
      ],
    },
    curated: {
      totalCandidates: 20,
      approvedCount: 12,
      rejectedCount: 4,
      pendingReview: 4,
      avgQuality: 0.88,
      remediationDerived: {
        totalCandidates: 8,
        approvedCount: 5,
        rejectedCount: 1,
        pendingReview: 2,
        avgQuality: 0.92,
        lastApprovedAt: '2026-04-08T08:45:00.000Z',
      },
    },
    learningLoop: {
      latestSnapshot: {
        snapshotId: 'snapshot_200',
        sampleCount: 18,
        avgQuality: 0.91,
        createdAt: '2026-04-08T10:45:00.000Z',
        minQuality: 0.7,
        sourceFilter: 'github_remediation_runtime',
      },
      latestTrainingRuns: [
        {
          runId: 'train_200',
          status: 'completed',
          completedAt: '2026-04-08T11:00:00.000Z',
          snapshotId: 'snapshot_200',
          avgQuality: 0.91,
          modelName: 'brunella-reflex',
        },
      ],
      activeReflexModel: 'Brunella Reflex v2',
      registrySummary: { totalModels: 4 },
    },
    trend: {
      sampleStateBreakdown: [
        { label: 'approved', value: 12 },
        { label: 'pending', value: 4 },
        { label: 'rejected', value: 4 },
      ],
      trainingRunStatusBreakdown: [{ label: 'completed', value: 1 }],
    },
    summary: {
      score: 90,
      status: 'healthy',
      goldenStatus: 'healthy',
      curatedStatus: 'healthy',
    },
    warnings: [],
    recommendations: [],
    ...overrides,
  };
}

describe('buildPhoenixFlywheelObservabilitySnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a healthy combined snapshot', async () => {
    mockedBuildDataFlywheelMetricsSnapshot.mockResolvedValue(buildFlywheelSnapshot());
    mockedGetCheckpointStats.mockResolvedValue({ totalCheckpoints: 6, activeTasks: 2 });
    mockedListActiveCheckpoints.mockResolvedValue([
      { taskId: 'task-1', stepIndex: 1, stepName: 'recover', createdAt: '2026-04-08T11:30:00.000Z' },
      { taskId: 'task-2', stepIndex: 2, stepName: 'verify', createdAt: '2026-04-08T11:35:00.000Z' },
    ]);
    mockedPhoenixEventBus.getStats.mockReturnValue({
      'phoenix:recovery': 1,
      'phoenix:state_restored': 1,
    });
    mockedPhoenixEventBus.getHistory.mockReturnValue([
      {
        event: 'phoenix:recovery',
        data: { type: 'failover', agent: 'Developer', details: 'Recovered', timestamp: '2026-04-08T11:40:00.000Z' },
        timestamp: '2026-04-08T11:40:00.000Z',
      },
      {
        event: 'phoenix:state_restored',
        data: { agentName: 'Developer', taskId: 'task-1', stepIndex: 1, stepName: 'recover', timestamp: '2026-04-08T11:45:00.000Z' },
        timestamp: '2026-04-08T11:45:00.000Z',
      },
    ]);
    mockedFailoverRegistry.getStats.mockReturnValue({
      totalAttempts: 2,
      successCount: 2,
      failureCount: 0,
      successRate: 1,
      byAgent: {
        developer: { total: 2, success: 2 },
      },
    });
    mockedFailoverRegistry.getAttempts.mockReturnValue([
      {
        primaryAgent: 'Developer',
        fallbackAgent: 'evaluator',
        taskInstruction: 'fix bug',
        success: true,
        attemptIndex: 1,
        timestamp: '2026-04-08T11:20:00.000Z',
      },
    ]);
    mockedGitHubRemediationRuntime.getSummary.mockReturnValue({
      total: 1,
      counts: { completed: 1 },
      active: true,
      latestUpdatedAt: '2026-04-08T11:50:00.000Z',
      pendingFinalApproval: 0,
      inFlight: 0,
      latestRunId: 'run-1',
      latestRunStatus: 'completed',
      latestRepositoryName: 'mcp-brunella-core',
    });
    mockedGitHubRemediationRuntime.listRuns.mockReturnValue([
      {
        id: 'run-1',
        status: 'completed',
        updatedAt: '2026-04-08T11:50:00.000Z',
        repositoryName: 'mcp-brunella-core',
        workflowRunId: '77',
      },
    ] as never);
    mockedGetRecoveryLog.mockReturnValue([
      { type: 'git_checkpoint', agent: 'Developer', details: 'Checkpointed', timestamp: Date.parse('2026-04-08T11:30:00.000Z') },
    ]);
    mockedHeartbeatMonitor.getOverallHealth.mockReturnValue({
      status: 'healthy',
      unhealthyServices: [],
    });

    const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({ windowHours: 24 });

    expect(snapshot.summary.status).toBe('healthy');
    expect(snapshot.summary.score).toBeGreaterThanOrEqual(85);
    expect(snapshot.phoenix.eventBus.totalEvents).toBe(2);
    expect(snapshot.phoenix.checkpoints.activeCheckpoints).toHaveLength(2);
    expect(snapshot.phoenix.failover.successRate).toBe(1);
    expect(snapshot.recommendations).toHaveLength(0);
    expect(snapshot.mitigationTracks).toHaveLength(0);
  });

  it('creates mitigation tracks when Phoenix health degrades', async () => {
    mockedBuildDataFlywheelMetricsSnapshot.mockResolvedValue(buildFlywheelSnapshot({
      summary: {
        score: 62,
        status: 'critical',
        goldenStatus: 'warning',
        curatedStatus: 'critical',
      },
      warnings: ['Flywheel warnings'],
      recommendations: [
        {
          id: 'flywheel-refresh-training-snapshot',
          target: 'flywheel',
          priority: 'high',
          title: 'Refresh the training snapshot',
          rationale: 'Too many samples have accumulated.',
          evidence: ['newSinceLastTraining=42'],
          actions: ['Create a fresh curated snapshot.'],
        },
      ],
    }));
    mockedGetCheckpointStats.mockResolvedValue({ totalCheckpoints: 0, activeTasks: 0 });
    mockedListActiveCheckpoints.mockResolvedValue([]);
    mockedPhoenixEventBus.getStats.mockReturnValue({
      'phoenix:agent_failed': 2,
      'phoenix:failover_result': 1,
    });
    mockedPhoenixEventBus.getHistory.mockReturnValue([
      {
        event: 'phoenix:agent_failed',
        data: { agentName: 'Developer', error: 'boom', timestamp: '2026-04-08T11:10:00.000Z' },
        timestamp: '2026-04-08T11:10:00.000Z',
      },
      {
        event: 'phoenix:failover_result',
        data: { originalAgent: 'Developer', fallbackAgent: 'evaluator', success: false, timestamp: '2026-04-08T11:11:00.000Z' },
        timestamp: '2026-04-08T11:11:00.000Z',
      },
    ]);
    mockedFailoverRegistry.getStats.mockReturnValue({
      totalAttempts: 3,
      successCount: 1,
      failureCount: 2,
      successRate: 1 / 3,
      byAgent: {
        developer: { total: 3, success: 1 },
      },
    });
    mockedFailoverRegistry.getAttempts.mockReturnValue([
      {
        primaryAgent: 'Developer',
        fallbackAgent: 'evaluator',
        taskInstruction: 'fix bug',
        success: false,
        error: 'boom',
        attemptIndex: 2,
        timestamp: '2026-04-08T11:12:00.000Z',
      },
    ]);
    mockedGitHubRemediationRuntime.getSummary.mockReturnValue({
      total: 3,
      counts: { awaiting_final_approval: 2, failed: 1 },
      active: true,
      latestUpdatedAt: '2026-04-08T11:50:00.000Z',
      pendingFinalApproval: 2,
      inFlight: 1,
      latestRunId: 'run-2',
      latestRunStatus: 'awaiting_final_approval',
      latestRepositoryName: 'mcp-brunella-core',
      latestFailureReason: 'boom',
    });
    mockedGitHubRemediationRuntime.listRuns.mockReturnValue([
      {
        id: 'run-2',
        status: 'awaiting_final_approval',
        updatedAt: '2026-04-08T11:50:00.000Z',
        repositoryName: 'mcp-brunella-core',
        workflowRunId: '88',
        failureReason: 'boom',
      },
    ] as never);
    mockedGetRecoveryLog.mockReturnValue([
      { type: 'crash', agent: 'Developer', details: 'Crash detected', timestamp: Date.parse('2026-04-08T11:20:00.000Z') },
    ]);
    mockedHeartbeatMonitor.getOverallHealth.mockReturnValue({
      status: 'unhealthy',
      unhealthyServices: ['ollama', 'fastapi'],
    });

    const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({ windowHours: 24 });

    expect(snapshot.summary.status).toBe('critical');
    expect(snapshot.recommendations.some((item) => item.id === 'phoenix-stabilize-recovery-path')).toBe(true);
    expect(snapshot.recommendations.some((item) => item.id === 'phoenix-tighten-failover-chain')).toBe(true);
    expect(snapshot.mitigationTracks.length).toBeGreaterThan(0);
  });

  it('filters the trend timeline to the selected window', async () => {
    mockedBuildDataFlywheelMetricsSnapshot.mockResolvedValue(buildFlywheelSnapshot());
    mockedGetCheckpointStats.mockResolvedValue({ totalCheckpoints: 1, activeTasks: 1 });
    mockedListActiveCheckpoints.mockResolvedValue([
      { taskId: 'task-1', stepIndex: 1, stepName: 'recover', createdAt: '2026-04-08T11:30:00.000Z' },
    ]);
    mockedPhoenixEventBus.getStats.mockReturnValue({
      'phoenix:recovery': 1,
      'phoenix:agent_failed': 1,
    });
    mockedPhoenixEventBus.getHistory.mockReturnValue([
      {
        event: 'phoenix:agent_failed',
        data: { agentName: 'Developer', error: 'old' },
        timestamp: '2026-04-07T10:00:00.000Z',
      },
      {
        event: 'phoenix:recovery',
        data: { type: 'failover', agent: 'Developer', details: 'recent recovery' },
        timestamp: '2026-04-08T11:40:00.000Z',
      },
    ]);
    mockedFailoverRegistry.getStats.mockReturnValue({
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      byAgent: {},
    });
    mockedFailoverRegistry.getAttempts.mockReturnValue([]);
    mockedGitHubRemediationRuntime.getSummary.mockReturnValue({
      total: 0,
      counts: {},
      active: false,
      pendingFinalApproval: 0,
      inFlight: 0,
      latestRepositoryName: 'mcp-brunella-core',
    });
    mockedGitHubRemediationRuntime.listRuns.mockReturnValue([] as never);
    mockedGetRecoveryLog.mockReturnValue([]);
    mockedHeartbeatMonitor.getOverallHealth.mockReturnValue({
      status: 'healthy',
      unhealthyServices: [],
    });

    const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({ windowHours: 24 });

    expect(snapshot.phoenix.eventBus.timeline).toHaveLength(1);
    expect(snapshot.phoenix.eventBus.timeline[0].recoveries).toBe(1);
    expect(snapshot.phoenix.eventBus.recentSignals[0].event).toBe('phoenix:recovery');
  });

  it('includes recovery and remediation summaries in the markdown output', async () => {
    mockedBuildDataFlywheelMetricsSnapshot.mockResolvedValue(buildFlywheelSnapshot());
    mockedGetCheckpointStats.mockResolvedValue({ totalCheckpoints: 2, activeTasks: 1 });
    mockedListActiveCheckpoints.mockResolvedValue([
      { taskId: 'task-1', stepIndex: 1, stepName: 'recover', createdAt: '2026-04-08T11:30:00.000Z' },
    ]);
    mockedPhoenixEventBus.getStats.mockReturnValue({ 'phoenix:recovery': 1 });
    mockedPhoenixEventBus.getHistory.mockReturnValue([
      {
        event: 'phoenix:recovery',
        data: { type: 'git_checkpoint', agent: 'Developer', details: 'Checkpointed', timestamp: '2026-04-08T11:40:00.000Z' },
        timestamp: '2026-04-08T11:40:00.000Z',
      },
    ]);
    mockedFailoverRegistry.getStats.mockReturnValue({
      totalAttempts: 1,
      successCount: 1,
      failureCount: 0,
      successRate: 1,
      byAgent: {},
    });
    mockedFailoverRegistry.getAttempts.mockReturnValue([]);
    mockedGitHubRemediationRuntime.getSummary.mockReturnValue({
      total: 1,
      counts: { completed: 1 },
      active: true,
      latestUpdatedAt: '2026-04-08T11:50:00.000Z',
      pendingFinalApproval: 0,
      inFlight: 0,
      latestRunId: 'run-3',
      latestRunStatus: 'completed',
      latestRepositoryName: 'mcp-brunella-core',
    });
    mockedGitHubRemediationRuntime.listRuns.mockReturnValue([
      {
        id: 'run-3',
        status: 'completed',
        updatedAt: '2026-04-08T11:50:00.000Z',
        repositoryName: 'mcp-brunella-core',
        workflowRunId: '99',
      },
    ] as never);
    mockedGetRecoveryLog.mockReturnValue([
      { type: 'git_checkpoint', agent: 'Developer', details: 'Checkpointed', timestamp: Date.parse('2026-04-08T11:35:00.000Z') },
    ]);
    mockedHeartbeatMonitor.getOverallHealth.mockReturnValue({
      status: 'healthy',
      unhealthyServices: [],
    });

    const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({ windowHours: 24 });
    const markdown = renderPhoenixFlywheelMarkdown(snapshot);

    expect(markdown).toContain('# Phoenix / Flywheel Observability');
    expect(markdown).toContain('## Phoenix signals');
    expect(markdown).toContain('## Mitigation tracks');
    expect(markdown).toContain('Recent remediation runs');
  });

  it('merges flywheel warnings and recommendations into the combined snapshot', async () => {
    mockedBuildDataFlywheelMetricsSnapshot.mockResolvedValue(buildFlywheelSnapshot({
      warnings: ['Flywheel warning'],
      recommendations: [
        {
          id: 'flywheel-refresh-training-snapshot',
          target: 'flywheel',
          priority: 'high',
          title: 'Refresh the training snapshot',
          rationale: 'Too many samples have accumulated.',
          evidence: ['newSinceLastTraining=42'],
          actions: ['Create a fresh curated snapshot.'],
        },
      ],
    }));
    mockedGetCheckpointStats.mockResolvedValue({ totalCheckpoints: 2, activeTasks: 1 });
    mockedListActiveCheckpoints.mockResolvedValue([]);
    mockedPhoenixEventBus.getStats.mockReturnValue({ 'phoenix:recovery': 1 });
    mockedPhoenixEventBus.getHistory.mockReturnValue([]);
    mockedFailoverRegistry.getStats.mockReturnValue({
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      byAgent: {},
    });
    mockedFailoverRegistry.getAttempts.mockReturnValue([]);
    mockedGitHubRemediationRuntime.getSummary.mockReturnValue({
      total: 0,
      counts: {},
      active: false,
      pendingFinalApproval: 0,
      inFlight: 0,
      latestRepositoryName: 'mcp-brunella-core',
    });
    mockedGitHubRemediationRuntime.listRuns.mockReturnValue([] as never);
    mockedGetRecoveryLog.mockReturnValue([]);
    mockedHeartbeatMonitor.getOverallHealth.mockReturnValue({
      status: 'healthy',
      unhealthyServices: [],
    });

    const snapshot = await buildPhoenixFlywheelObservabilitySnapshot({ windowHours: 24 });

    expect(snapshot.warnings).toContain('Flywheel warning');
    expect(snapshot.recommendations.some((item) => item.id === 'flywheel-refresh-training-snapshot')).toBe(true);
    expect(snapshot.mitigationTracks.some((track) => track.title === 'Refresh the training snapshot')).toBe(true);
  });
});
