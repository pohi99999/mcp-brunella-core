import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/goldenDatasetBridge.js', () => ({
  getGoldenStats: vi.fn(),
  getCuratedGoldenStats: vi.fn(),
}));

vi.mock('../src/core/learningLoopService.js', () => ({
  getLearningLoopOverview: vi.fn(),
}));

import {
  buildDataFlywheelMetricsSnapshot,
  renderDataFlywheelMetricsMarkdown,
} from '../src/tools/dataFlywheelMetrics.js';
import { getCuratedGoldenStats, getGoldenStats } from '../src/core/goldenDatasetBridge.js';
import { getLearningLoopOverview } from '../src/core/learningLoopService.js';

const mockedGetGoldenStats = vi.mocked(getGoldenStats);
const mockedGetCuratedGoldenStats = vi.mocked(getCuratedGoldenStats);
const mockedGetLearningLoopOverview = vi.mocked(getLearningLoopOverview);

describe('buildDataFlywheelMetricsSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a healthy snapshot when the dataset is balanced', async () => {
    mockedGetGoldenStats.mockResolvedValue({
      totalSamples: 80,
      newSinceLastTraining: 12,
      lastTrainingAt: '2026-04-08T10:00:00.000Z',
      sources: { remediation: 18, docs: 22, tasks: 40 },
      avgQuality: 0.91,
      status: 'healthy',
      fileSizeMb: 1.2,
    });
    mockedGetCuratedGoldenStats.mockReturnValue({
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
    });
    mockedGetLearningLoopOverview.mockResolvedValue({
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
      latestSnapshot: {
        snapshotId: 'snapshot_200',
        sampleCount: 18,
        avgQuality: 0.91,
        createdAt: '2026-04-08T10:45:00.000Z',
        minQuality: 0.7,
        sourceFilter: 'github_remediation_runtime',
      },
      activeReflexModel: { displayName: 'Brunella Reflex v2' },
      registry: { totalModels: 4 },
    });

    const snapshot = await buildDataFlywheelMetricsSnapshot();

    expect(snapshot.summary.status).toBe('healthy');
    expect(snapshot.summary.score).toBeGreaterThanOrEqual(85);
    expect(snapshot.learningLoop.activeReflexModel).toBe('Brunella Reflex v2');
    expect(snapshot.trend.sampleStateBreakdown).toEqual([
      { label: 'approved', value: 12 },
      { label: 'pending', value: 4 },
      { label: 'rejected', value: 4 },
    ]);
    expect(snapshot.trend.trainingRunStatusBreakdown).toEqual([
      { label: 'completed', value: 1 },
    ]);
  });

  it('flags missing model and empty training history', async () => {
    mockedGetGoldenStats.mockResolvedValue({
      totalSamples: 0,
      newSinceLastTraining: 0,
      sources: {},
      avgQuality: 0,
      status: 'critical',
    });
    mockedGetCuratedGoldenStats.mockReturnValue({
      totalCandidates: 3,
      approvedCount: 0,
      rejectedCount: 1,
      pendingReview: 2,
      avgQuality: 0.42,
      remediationDerived: {
        totalCandidates: 1,
        approvedCount: 0,
        rejectedCount: 1,
        pendingReview: 0,
        avgQuality: 0.42,
      },
    });
    mockedGetLearningLoopOverview.mockResolvedValue({
      latestTrainingRuns: [],
      latestSnapshot: null,
      activeReflexModel: null,
      registry: { totalModels: 0 },
    });

    const snapshot = await buildDataFlywheelMetricsSnapshot();

    expect(snapshot.summary.status).toBe('critical');
    expect(snapshot.warnings).toContain('Nincs még golden dataset minta.');
    expect(snapshot.warnings).toContain('Még nincs learning-loop tréning futás.');
    expect(snapshot.recommendations.map((item) => item.id)).toEqual([
      'flywheel-capture-golden-samples',
      'flywheel-raise-quality-floor',
      'flywheel-clear-review-queue',
      'flywheel-promote-reflex-model',
      'flywheel-schedule-training-cycle',
    ]);
  });

  it('sorts source breakdown from highest to lowest', async () => {
    mockedGetGoldenStats.mockResolvedValue({
      totalSamples: 12,
      newSinceLastTraining: 1,
      sources: { docs: 2, remediation: 5, tasks: 3 },
      avgQuality: 0.8,
      status: 'warning',
    });
    mockedGetCuratedGoldenStats.mockReturnValue({
      totalCandidates: 5,
      approvedCount: 3,
      rejectedCount: 1,
      pendingReview: 1,
      avgQuality: 0.81,
      remediationDerived: {
        totalCandidates: 2,
        approvedCount: 1,
        rejectedCount: 0,
        pendingReview: 1,
        avgQuality: 0.84,
      },
    });
    mockedGetLearningLoopOverview.mockResolvedValue({
      latestTrainingRuns: [],
      latestSnapshot: null,
      activeReflexModel: null,
      registry: null,
    });

    const snapshot = await buildDataFlywheelMetricsSnapshot();

    expect(snapshot.golden.sourceBreakdown).toEqual([
      { label: 'remediation', value: 5 },
      { label: 'tasks', value: 3 },
      { label: 'docs', value: 2 },
    ]);
  });

  it('aggregates recent training run statuses', async () => {
    mockedGetGoldenStats.mockResolvedValue({
      totalSamples: 60,
      newSinceLastTraining: 4,
      sources: { tasks: 10 },
      avgQuality: 0.87,
      status: 'healthy',
    });
    mockedGetCuratedGoldenStats.mockReturnValue({
      totalCandidates: 10,
      approvedCount: 8,
      rejectedCount: 1,
      pendingReview: 1,
      avgQuality: 0.87,
      remediationDerived: {
        totalCandidates: 4,
        approvedCount: 3,
        rejectedCount: 0,
        pendingReview: 1,
        avgQuality: 0.9,
      },
    });
    mockedGetLearningLoopOverview.mockResolvedValue({
      latestTrainingRuns: [
        { runId: 'train-1', status: 'completed', completedAt: '2026-04-08T12:00:00.000Z' },
        { runId: 'train-2', status: 'failed', completedAt: '2026-04-08T11:00:00.000Z' },
        { runId: 'train-3', status: 'completed', completedAt: '2026-04-08T10:00:00.000Z' },
      ],
      latestSnapshot: null,
      activeReflexModel: 'Reflex v3',
      registry: { totalModels: 3 },
    });

    const snapshot = await buildDataFlywheelMetricsSnapshot();

    expect(snapshot.trend.trainingRunStatusBreakdown).toEqual([
      { label: 'completed', value: 2 },
      { label: 'failed', value: 1 },
    ]);
  });

  it('renders markdown with the main summary sections', async () => {
    mockedGetGoldenStats.mockResolvedValue({
      totalSamples: 10,
      newSinceLastTraining: 2,
      sources: { tasks: 10 },
      avgQuality: 0.84,
      status: 'warning',
    });
    mockedGetCuratedGoldenStats.mockReturnValue({
      totalCandidates: 4,
      approvedCount: 2,
      rejectedCount: 1,
      pendingReview: 1,
      avgQuality: 0.84,
      remediationDerived: {
        totalCandidates: 2,
        approvedCount: 1,
        rejectedCount: 0,
        pendingReview: 1,
        avgQuality: 0.86,
      },
    });
    mockedGetLearningLoopOverview.mockResolvedValue({
      latestTrainingRuns: [],
      latestSnapshot: null,
      activeReflexModel: null,
      registry: null,
    });

    const snapshot = await buildDataFlywheelMetricsSnapshot();
    const markdown = renderDataFlywheelMetricsMarkdown(snapshot);

    expect(markdown).toContain('# Data Flywheel');
    expect(markdown).toContain('## Recommendations');
    expect(markdown).toContain('Golden samples: 10');
  });
});
