import type { ApprovalWorkflowStatus } from './approvalRouter.js';
import { approvalRouter } from './approvalRouter.js';
import { githubRemediationRuntime } from './githubRemediationRuntime.js';
import type { RemediationRunsSummary } from './remediationRuntime.types.js';
import { getCuratedGoldenStats } from './goldenDatasetBridge.js';
import { listLearningLoopSnapshots } from './learningLoopService.js';
import type { LearningLoopTrainingRunMetadata } from './learningLoopService.js';
import { listTrainingRuns, type TrainingRunRecord } from './reflexModelRegistry.js';

export interface ZeroPromptApprovalEdgeSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  counts: Record<ApprovalWorkflowStatus, number>;
  latestUpdatedAt?: string;
}

export interface ZeroPromptEdgeSummary {
  approvals: ZeroPromptApprovalEdgeSummary;
  remediation: ZeroPromptRemediationEdgeSummary;
  learningLoop: ZeroPromptLearningLoopEdgeSummary;
  timestamp: string;
  source: 'local-runtime';
}

export interface ZeroPromptRemediationEdgeSummary {
  total: RemediationRunsSummary['total'];
  counts: RemediationRunsSummary['counts'];
  active: RemediationRunsSummary['active'];
  latestUpdatedAt?: RemediationRunsSummary['latestUpdatedAt'];
  pendingFinalApproval: RemediationRunsSummary['pendingFinalApproval'];
  inFlight: RemediationRunsSummary['inFlight'];
  latestRunId?: RemediationRunsSummary['latestRunId'];
  latestRunStatus?: RemediationRunsSummary['latestRunStatus'];
  latestRepositoryName?: RemediationRunsSummary['latestRepositoryName'];
  latestFailureReason?: RemediationRunsSummary['latestFailureReason'];
}

export interface ZeroPromptLearningLoopEdgeTrainingSummary {
  runId: string;
  snapshotId: string;
  status: TrainingRunRecord['status'];
  modelName: string;
  dryRun: boolean;
  sampleCount: number;
  avgQuality: number;
  startedAt: string;
  completedAt?: string;
  snapshotSource?: string;
  minQuality?: number;
  routineCategories?: string[];
}

export interface ZeroPromptLearningLoopEdgeSnapshotSummary {
  snapshotId: string;
  sampleCount: number;
  avgQuality: number;
  sourceFilter?: string;
  minQuality: number;
  createdAt: string;
}

export interface ZeroPromptLearningLoopEdgeSummary {
  remediationDerived: ReturnType<typeof getCuratedGoldenStats>['remediationDerived'];
  latestSnapshot: ZeroPromptLearningLoopEdgeSnapshotSummary | null;
  latestTraining: ZeroPromptLearningLoopEdgeTrainingSummary | null;
}

export interface ZeroPromptEdgeMirrorEnvelope {
  mirroredAt: string;
  summary: ZeroPromptEdgeSummary;
}

function summarizeTrainingRun(
  run: TrainingRunRecord | undefined,
): ZeroPromptLearningLoopEdgeTrainingSummary | null {
  if (!run) {
    return null;
  }

  const metadata = (run.metadata ?? {}) as LearningLoopTrainingRunMetadata;
  return {
    runId: run.runId,
    snapshotId: run.snapshotId,
    status: run.status,
    modelName: run.modelName,
    dryRun: run.dryRun,
    sampleCount: run.sampleCount,
    avgQuality: run.avgQuality,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    snapshotSource:
      typeof metadata.snapshotSource === 'string' ? metadata.snapshotSource : undefined,
    minQuality:
      typeof metadata.minQuality === 'number' ? metadata.minQuality : undefined,
    routineCategories: Array.isArray(metadata.routineCategories)
      ? metadata.routineCategories.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : undefined,
  };
}

export async function buildZeroPromptEdgeSummary(): Promise<ZeroPromptEdgeSummary> {
  const workflows = approvalRouter.listWorkflows();
  const approvals: ZeroPromptApprovalEdgeSummary = {
    total: workflows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    counts: {
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
    },
  };

  for (const workflow of workflows) {
    approvals[workflow.status] += 1;
    approvals.counts[workflow.status] += 1;

    if (!approvals.latestUpdatedAt || workflow.updatedAt > approvals.latestUpdatedAt) {
      approvals.latestUpdatedAt = workflow.updatedAt;
    }
  }

  const curatedStats = await getCuratedGoldenStats();
  const latestSnapshot = (await listLearningLoopSnapshots())[0] ?? null;
  const latestTraining = listTrainingRuns(1)[0];
  const remediationSummary = githubRemediationRuntime.getSummary();

  return {
    approvals,
    remediation: {
      total: remediationSummary.total,
      counts: remediationSummary.counts,
      active: remediationSummary.active,
      latestUpdatedAt: remediationSummary.latestUpdatedAt,
      pendingFinalApproval: remediationSummary.pendingFinalApproval,
      inFlight: remediationSummary.inFlight,
      latestRunId: remediationSummary.latestRunId,
      latestRunStatus: remediationSummary.latestRunStatus,
      latestRepositoryName: remediationSummary.latestRepositoryName,
      latestFailureReason: remediationSummary.latestFailureReason,
    },
    learningLoop: {
      remediationDerived: curatedStats.remediationDerived,
      latestSnapshot: latestSnapshot
        ? {
            snapshotId: latestSnapshot.snapshotId,
            sampleCount: latestSnapshot.sampleCount,
            avgQuality: latestSnapshot.avgQuality,
            sourceFilter: latestSnapshot.sourceFilter,
            minQuality: latestSnapshot.minQuality,
            createdAt: latestSnapshot.createdAt,
          }
        : null,
      latestTraining: summarizeTrainingRun(latestTraining),
    },
    timestamp: new Date().toISOString(),
    source: 'local-runtime',
  };
}

export function createZeroPromptEdgeMirrorEnvelope(
  summary: ZeroPromptEdgeSummary,
): ZeroPromptEdgeMirrorEnvelope {
  return {
    mirroredAt: summary.timestamp,
    summary,
  };
}
