import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PhoenixFlywheelObservabilityPanel } from '@/components/dashboard/PhoenixFlywheelObservabilityPanel';
import * as api from '@/lib/apiService';

vi.mock('@/lib/apiService', () => ({
  getPhoenixFlywheelObservabilitySnapshot: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getPhoenixFlywheelObservabilitySnapshot: ReturnType<typeof vi.fn>;
};

describe('PhoenixFlywheelObservabilityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedApi.getPhoenixFlywheelObservabilitySnapshot.mockResolvedValue({
      markdown: '# Phoenix / Flywheel Observability',
      snapshot: {
        checkedAt: '2026-04-08T12:00:00.000Z',
        windowHours: 24,
        summary: {
          score: 92,
          status: 'healthy',
          phoenixScore: 95,
          phoenixStatus: 'healthy',
          flywheelScore: 89,
          flywheelStatus: 'healthy',
          failureSignals: 1,
          recoverySignals: 2,
          pendingFinalApproval: 0,
          pendingCuratedReview: 4,
          latestTrainingAt: '2026-04-08T11:00:00.000Z',
        },
        phoenix: {
          eventBus: {
            totalEvents: 2,
            breakdown: [
              { label: 'phoenix:recovery', value: 1 },
              { label: 'phoenix:state_restored', value: 1 },
            ],
            timeline: [
              { hour: '2026-04-08T11', events: 2, failures: 1, failovers: 0, recoveries: 1 },
            ],
            recentSignals: [
              { event: 'phoenix:recovery', timestamp: '2026-04-08T11:40:00.000Z', detail: 'Recovered' },
            ],
          },
          checkpoints: {
            totalCheckpoints: 2,
            activeTasks: 1,
            activeCheckpoints: [
              { taskId: 'task-1', stepIndex: 1, stepName: 'recover', createdAt: '2026-04-08T11:30:00.000Z' },
            ],
          },
          recovery: {
            total: 1,
            breakdown: [{ label: 'git_checkpoint', value: 1 }],
            recent: [
              { type: 'git_checkpoint', agent: 'Developer', details: 'Checkpointed', timestamp: '2026-04-08T11:35:00.000Z' },
            ],
          },
          failover: {
            totalAttempts: 1,
            successCount: 1,
            failureCount: 0,
            successRate: 1,
            byAgent: [
              { agent: 'developer', total: 1, success: 1, failure: 0, successRate: 1 },
            ],
            recentAttempts: [],
          },
          heartbeat: { status: 'healthy', unhealthyServices: [] },
          remediation: {
            total: 1,
            counts: { completed: 1 },
            active: true,
            latestUpdatedAt: '2026-04-08T11:50:00.000Z',
            pendingFinalApproval: 0,
            inFlight: 0,
            latestRunId: 'run-1',
            latestRunStatus: 'completed',
            latestRepositoryName: 'mcp-brunella-core',
            latestFailureReason: undefined,
            recentRuns: [
              {
                id: 'run-1',
                status: 'completed',
                updatedAt: '2026-04-08T11:50:00.000Z',
                repositoryName: 'mcp-brunella-core',
                workflowRunId: '77',
              },
            ],
          },
        },
        flywheel: {
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
            score: 89,
            status: 'healthy',
            goldenStatus: 'healthy',
            curatedStatus: 'healthy',
          },
          warnings: [],
          recommendations: [],
        },
        recommendations: [
          {
            id: 'phoenix-clear-approval-queue',
            target: 'phoenix',
            priority: 'medium',
            title: 'Clear the remediation approval queue',
            rationale: 'Pending final approvals block the self-healing loop from completing.',
            evidence: ['pendingFinalApproval=1'],
            actions: ['Review the most recent remediation runs.'],
          },
        ],
        mitigationTracks: [
          {
            id: 'phoenix-clear-the-remediation-approval-queue',
            title: 'Clear the remediation approval queue',
            priority: 'medium',
            scope: ['pendingFinalApproval=1'],
            rationale: 'Pending final approvals block the self-healing loop from completing.',
            actions: ['Review the most recent remediation runs.'],
          },
        ],
        warnings: [],
      },
    });
  });

  it('renders the combined observability summary', async () => {
    await act(async () => {
      render(<PhoenixFlywheelObservabilityPanel />);
    });

    await screen.findByText('Observability & Self-Healing');
    expect(screen.getByText('Overall score')).toBeInTheDocument();
    expect(screen.getByText('Phoenix score')).toBeInTheDocument();
    expect(screen.getByText('Flywheel score')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('renders mitigation tracks from the snapshot', async () => {
    await act(async () => {
      render(<PhoenixFlywheelObservabilityPanel />);
    });

    await screen.findByText('Mitigation tracks');
    expect(screen.getAllByText('Clear the remediation approval queue')).not.toHaveLength(0);
    expect(screen.getByText('Recent Phoenix signals')).toBeInTheDocument();
  });
});
