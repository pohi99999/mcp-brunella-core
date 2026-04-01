import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { promises as fs } from 'node:fs';

const remediationHarness = vi.hoisted(() => ({
  db: null as Database.Database | null,
  captureApprovedRemediationGoldenCandidate: vi.fn(),
  delegate: vi.fn(),
  spawn: vi.fn(),
  terminate: vi.fn(),
  getWorkflowRunLogs: vi.fn(),
  createWorkflowFromPolicy: vi.fn(),
  getWorkflow: vi.fn(),
  refreshWorkflow: vi.fn(),
  saveRemediationRun: vi.fn(),
  loadRemediationRuns: vi.fn(() => []),
  clearRemediationRuns: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => {
    if (!remediationHarness.db) {
      throw new Error('Test database not initialized');
    }
    return remediationHarness.db;
  },
  getD1Adapter: vi.fn(() => null),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/utils/vectorize.js', () => ({
  vectorizeClient: {
    getStatus: vi.fn(() => ({ enabled: false })),
    upsertText: vi.fn(),
  },
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: remediationHarness.delegate,
  },
}));

vi.mock('../src/core/ephemeralAgentManager.js', () => ({
  ephemeralAgentManager: {
    spawn: remediationHarness.spawn,
    terminate: remediationHarness.terminate,
  },
}));

vi.mock('../src/core/githubAPIClient.js', () => ({
  githubAPI: {
    getWorkflowRunLogs: remediationHarness.getWorkflowRunLogs,
  },
}));

vi.mock('../src/core/approvalRouter.js', () => ({
  approvalRouter: {
    createWorkflowFromPolicy: remediationHarness.createWorkflowFromPolicy,
    getWorkflow: remediationHarness.getWorkflow,
    refreshWorkflow: remediationHarness.refreshWorkflow,
  },
}));

vi.mock('../src/core/autonomyRuntimeStore.js', () => ({
  saveRemediationRun: remediationHarness.saveRemediationRun,
  loadRemediationRuns: remediationHarness.loadRemediationRuns,
  clearRemediationRuns: remediationHarness.clearRemediationRuns,
}));

vi.mock('../src/core/eventFabric.js', () => ({
  eventFabric: {
    getHistory: vi.fn(() => []),
  },
}));

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    publish: remediationHarness.publish,
    subscribe: remediationHarness.subscribe,
    unsubscribe: remediationHarness.unsubscribe,
  },
}));

describe('Remediation learning loop integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remediationHarness.db?.close();
    remediationHarness.db = null;
  });

  it('captures approved remediation runs as deterministic curated samples', async () => {
    remediationHarness.db = new Database(':memory:');
    const {
      captureApprovedRemediationGoldenCandidate,
      listCuratedGoldenSamples,
      getCuratedGoldenStats,
      getCuratedGoldenSample,
      reviewCuratedGoldenSample,
    } = await import('../src/core/goldenDatasetBridge.js');

    const run = {
      id: 'run-approved-1',
      sourceEventId: 'evt-1',
      sourceDedupKey: 'github:workflow:failure:1',
      sourceEventType: 'github.workflow_run.failure',
      repositoryName: 'pohi99999/mcp-brunella-core',
      repositoryOwner: 'pohi99999',
      repositoryRepo: 'mcp-brunella-core',
      workflowRunId: '501',
      workflowName: 'CI',
      branch: 'main',
      htmlUrl: 'https://github.com/pohi99999/mcp-brunella-core/actions/runs/501',
      status: 'approved' as const,
      createdAt: '2026-04-01T14:00:00.000Z',
      updatedAt: '2026-04-01T14:10:00.000Z',
      analysis: {
        type: 'lint' as const,
        category: 'lint' as const,
        title: 'Lint Error',
        summary: 'ESLint no-unused-vars failure in src/core/githubRemediationRuntime.ts',
        message: 'ESLint no-unused-vars failure',
        rawError: 'src/core/githubRemediationRuntime.ts:15 error no-unused-vars',
        affectedFiles: ['src/core/githubRemediationRuntime.ts'],
        confidence: 0.92,
        errors: ['src/core/githubRemediationRuntime.ts:15 no-unused-vars'],
        suggestions: ['Remove the unused import'],
        errorCount: 1,
      },
      fixer: {
        agentName: 'lint_fixer',
        task: 'fix src/core/githubRemediationRuntime.ts lint or static-analysis issues from GitHub workflow failure.',
        status: 'succeeded' as const,
        startedAt: '2026-04-01T14:02:00.000Z',
        finishedAt: '2026-04-01T14:04:00.000Z',
        resultSummary: 'lint_category | Removed unused import and simplified branch logic',
        executedBy: 'lint_fixer',
      },
      verification: [
        {
          name: 'lint',
          command: 'npm',
          args: ['run', 'lint'],
          status: 'passed' as const,
          startedAt: '2026-04-01T14:05:00.000Z',
          finishedAt: '2026-04-01T14:06:00.000Z',
          exitCode: 0,
        },
        {
          name: 'fast-test-suite',
          command: 'npm',
          args: ['run', 'test:fast'],
          status: 'passed' as const,
          startedAt: '2026-04-01T14:06:00.000Z',
          finishedAt: '2026-04-01T14:09:00.000Z',
          exitCode: 0,
        },
      ],
      finalApproval: {
        workflowId: 'wf-1',
        approvalRequestId: 'apr-1',
        status: 'approved' as const,
        requestedAt: '2026-04-01T14:09:30.000Z',
        respondedAt: '2026-04-01T14:10:00.000Z',
        response: { by: 'ops-user' },
      },
      failureReason: undefined,
    };

    const first = captureApprovedRemediationGoldenCandidate(run);
    const second = captureApprovedRemediationGoldenCandidate(run);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(first.id).toBe(second.id);

    const samples = listCuratedGoldenSamples({ state: 'approved', limit: 10 });
    expect(samples).toHaveLength(1);
    expect(samples[0]?.source).toBe('github_remediation_runtime');
    expect(samples[0]?.reviewedBy).toBe('ops-user');
    expect(samples[0]?.reviewNotes).toContain('Auto-approved');
    expect(samples[0]?.prompt).toContain('GitHub workflow failure remediation task.');
    expect(samples[0]?.completion).toContain('Selected fixer: lint_fixer');
    expect(samples[0]?.completion).toContain('Final operator approval granted');
    expect(samples[0]?.provenance).toEqual(expect.objectContaining({
      kind: 'approved_remediation',
      remediationRunId: 'run-approved-1',
      repositoryName: 'pohi99999/mcp-brunella-core',
    }));

    const sourceFiltered = listCuratedGoldenSamples({
      state: 'approved',
      source: 'github_remediation_runtime',
      limit: 10,
    });
    expect(sourceFiltered).toHaveLength(1);
    expect(sourceFiltered[0]?.id).toBe(samples[0]?.id);
    expect(getCuratedGoldenSample(samples[0]!.id)?.id).toBe(samples[0]?.id);

    const stats = getCuratedGoldenStats();
    expect(stats.totalCandidates).toBe(1);
    expect(stats.approvedCount).toBe(1);
    expect(stats.pendingReview).toBe(0);
    expect(stats.remediationDerived.totalCandidates).toBe(1);
    expect(stats.remediationDerived.approvedCount).toBe(1);
    expect(stats.remediationDerived.lastApprovedAt).toBe('2026-04-01T14:10:00.000Z');

    const rejected = reviewCuratedGoldenSample(samples[0]!.id, 'rejected', 'ops-reviewer', 'Rejected after per-sample review');
    expect(rejected?.approvalState).toBe('rejected');
    expect(rejected?.reviewedBy).toBe('ops-reviewer');

    const approvedAfterReject = listCuratedGoldenSamples({
      state: 'approved',
      source: 'github_remediation_runtime',
      limit: 10,
    });
    expect(approvedAfterReject).toHaveLength(0);

    const rejectedAfterReview = listCuratedGoldenSamples({
      state: 'rejected',
      source: 'github_remediation_runtime',
      limit: 10,
    });
    expect(rejectedAfterReview).toHaveLength(1);
    expect(rejectedAfterReview[0]?.id).toBe(samples[0]?.id);

    remediationHarness.db?.close();
    remediationHarness.db = null;
  });

  it('triggers curated sample capture when final remediation approval resolves as approved', async () => {
    vi.resetModules();
    vi.doMock('../src/core/goldenDatasetBridge.js', () => ({
      captureApprovedRemediationGoldenCandidate: remediationHarness.captureApprovedRemediationGoldenCandidate,
    }));
    try {
      const runtimeModule = await import('../src/core/githubRemediationRuntime.js');

      remediationHarness.captureApprovedRemediationGoldenCandidate.mockReturnValue({
        success: true,
        id: 'curated_remediation_1',
        duplicate: false,
      });

      const run = {
        id: 'run-rt-1',
        sourceEventId: 'evt-rt-1',
        sourceDedupKey: 'github:rt:1',
        sourceEventType: 'github.workflow_run.failure',
        repositoryName: 'pohi99999/mcp-brunella-core',
        repositoryOwner: 'pohi99999',
        repositoryRepo: 'mcp-brunella-core',
        workflowRunId: '700',
        workflowName: 'CI',
        branch: 'main',
        htmlUrl: 'https://github.com/pohi99999/mcp-brunella-core/actions/runs/700',
        status: 'awaiting_final_approval' as const,
        createdAt: '2026-04-01T15:00:00.000Z',
        updatedAt: '2026-04-01T15:05:00.000Z',
        verification: [],
        finalApproval: {
          workflowId: 'wf-rt-1',
          approvalRequestId: 'apr-rt-1',
          status: 'pending' as const,
          requestedAt: '2026-04-01T15:04:00.000Z',
        },
      };

      remediationHarness.loadRemediationRuns.mockReturnValueOnce([run]);
      remediationHarness.getWorkflow.mockReturnValue({
        workflowId: 'wf-rt-1',
        approvalRequestId: 'apr-rt-1',
        status: 'approved',
        createdAt: '2026-04-01T15:04:00.000Z',
        respondedAt: '2026-04-01T15:06:00.000Z',
        response: { by: 'qa-user' },
        eventMetadata: { remediationRunId: 'run-rt-1' },
        eventPayload: {},
      });

      runtimeModule.githubRemediationRuntime.hydrateFromStore();

      (runtimeModule.githubRemediationRuntime as unknown as {
        syncRunFromApprovalEvent: (event: Record<string, unknown>) => void;
      }).syncRunFromApprovalEvent({
        workflowId: 'wf-rt-1',
        approvalRequestId: 'apr-rt-1',
        status: 'approved',
        action: 'approve',
        response: { by: 'qa-user' },
        resumeEventType: 'approval.workflow.approved',
        timestamp: '2026-04-01T15:06:00.000Z',
      });

      const updated = runtimeModule.githubRemediationRuntime.getRun('run-rt-1');
      expect(updated?.status).toBe('approved');
      expect(remediationHarness.captureApprovedRemediationGoldenCandidate).toHaveBeenCalledTimes(1);
      expect(remediationHarness.captureApprovedRemediationGoldenCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-rt-1',
          status: 'approved',
        }),
      );
    } finally {
      vi.doUnmock('../src/core/goldenDatasetBridge.js');
      vi.resetModules();
    }
  });

  it('creates remediation-only snapshots from remediation-derived approved samples', async () => {
    remediationHarness.db = new Database(':memory:');
    const { captureCuratedGoldenCandidate } = await import('../src/core/goldenDatasetBridge.js');
    const { createCuratedSnapshot } = await import('../src/core/learningLoopService.js');

    captureCuratedGoldenCandidate({
      id: 'sample-general-1',
      prompt: 'General coding sample prompt for testing snapshot filters',
      completion: 'General coding sample completion for testing snapshot filters',
      source: 'developer_agent',
      quality: 0.91,
      autoApprove: true,
      approvedAt: '2026-04-01T16:00:00.000Z',
    });

    captureCuratedGoldenCandidate({
      id: 'sample-remediation-1',
      prompt: 'Remediation sample prompt for snapshot filter testing',
      completion: 'Remediation sample completion for snapshot filter testing',
      source: 'github_remediation_runtime',
      quality: 0.88,
      autoApprove: true,
      approvedAt: '2026-04-01T16:01:00.000Z',
    });

    const snapshot = await createCuratedSnapshot({
      minQuality: 0.8,
      source: 'github_remediation_runtime',
    });

    expect(snapshot.sampleCount).toBe(1);
    expect(snapshot.sourceFilter).toBe('github_remediation_runtime');
    expect(snapshot.minQuality).toBe(0.8);
    expect(snapshot.snapshotId).toContain('snapshot_remediation');

    await fs.unlink(snapshot.snapshotPath).catch(() => undefined);
    await fs.unlink(snapshot.metadataPath).catch(() => undefined);

    remediationHarness.db?.close();
    remediationHarness.db = null;
  });

  it('exposes latest snapshot metadata and training scope in the learning loop overview', async () => {
    remediationHarness.db = new Database(':memory:');
    const { captureCuratedGoldenCandidate } = await import('../src/core/goldenDatasetBridge.js');
    const { createCuratedSnapshot, getLearningLoopOverview } = await import('../src/core/learningLoopService.js');
    const { createTrainingRun } = await import('../src/core/reflexModelRegistry.js');

    captureCuratedGoldenCandidate({
      id: 'sample-remediation-metadata',
      prompt: 'Remediation metadata visibility prompt',
      completion: 'Remediation metadata visibility completion',
      source: 'github_remediation_runtime',
      quality: 0.93,
      autoApprove: true,
      approvedAt: '2026-04-01T16:11:00.000Z',
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-04-01T16:12:00.000Z'));
    try {
      const snapshot = await createCuratedSnapshot({
        minQuality: 0.85,
        source: 'github_remediation_runtime',
      });

      createTrainingRun({
        runId: 'train-meta-1',
        snapshotId: snapshot.snapshotId,
        snapshotPath: snapshot.snapshotPath,
        artifactPath: undefined,
        status: 'dry_run',
        dryRun: true,
        modelName: 'brunella-reflex-remediation',
        sampleCount: snapshot.sampleCount,
        avgQuality: snapshot.avgQuality,
        metadata: {
          snapshotSource: snapshot.sourceFilter,
          minQuality: snapshot.minQuality,
        },
        startedAt: '2030-04-01T16:12:30.000Z',
        completedAt: '2030-04-01T16:13:00.000Z',
      });

      const overview = await getLearningLoopOverview() as {
        latestSnapshot: {
          snapshotId: string;
          sourceFilter?: string;
          minQuality: number;
        } | null;
        latestTrainingRuns: Array<{
          runId: string;
          metadata?: {
            snapshotSource?: string;
            minQuality?: number;
          };
        }>;
      };

      expect(overview.latestSnapshot).not.toBeNull();
      expect(overview.latestSnapshot?.snapshotId).toBe(snapshot.snapshotId);
      expect(overview.latestSnapshot?.sourceFilter).toBe('github_remediation_runtime');
      expect(overview.latestSnapshot?.minQuality).toBe(0.85);
      expect(overview.latestTrainingRuns[0]?.runId).toBe('train-meta-1');
      expect(overview.latestTrainingRuns[0]?.metadata?.snapshotSource).toBe('github_remediation_runtime');
      expect(overview.latestTrainingRuns[0]?.metadata?.minQuality).toBe(0.85);

      await fs.unlink(snapshot.snapshotPath).catch(() => undefined);
      await fs.unlink(snapshot.metadataPath).catch(() => undefined);
    } finally {
      vi.useRealTimers();
    }

    remediationHarness.db?.close();
    remediationHarness.db = null;
  });
});
