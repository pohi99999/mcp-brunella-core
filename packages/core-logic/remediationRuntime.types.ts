import type { DeploymentAnalysis } from '@packages/utils/deploymentAnalyzer.js';

export type RemediationRunStatus =
  | 'queued'
  | 'analyzing'
  | 'running_fixer'
  | 'verifying'
  | 'awaiting_final_approval'
  | 'approved'
  | 'rejected'
  | 'failed';

export type RemediationFixerStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type RemediationVerificationStatus = 'pending' | 'passed' | 'failed';

export interface RemediationFixerState {
  agentName: string;
  task: string;
  ephemeralAgentId?: string;
  status: RemediationFixerStatus;
  startedAt?: string;
  finishedAt?: string;
  resultSummary?: string;
  executedBy?: string;
}

export interface RemediationVerificationStep {
  name: string;
  command: string;
  args: string[];
  status: RemediationVerificationStatus;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
}

export interface RemediationFinalApprovalState {
  workflowId: string;
  approvalRequestId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
  respondedAt?: string;
  response?: unknown;
}

export interface RemediationRunRecord {
  id: string;
  sourceEventId: string;
  sourceDedupKey: string;
  sourceEventType: string;
  repositoryName: string;
  repositoryOwner?: string;
  repositoryRepo?: string;
  workflowRunId?: string;
  workflowName?: string;
  branch?: string;
  htmlUrl?: string;
  status: RemediationRunStatus;
  createdAt: string;
  updatedAt: string;
  logsExcerpt?: string;
  analysis?: DeploymentAnalysis;
  fixer?: RemediationFixerState;
  verification: RemediationVerificationStep[];
  finalApproval?: RemediationFinalApprovalState;
  failureReason?: string;
}

export interface RemediationRunsSummary {
  total: number;
  counts: Partial<Record<RemediationRunStatus, number>>;
  active: boolean;
  latestUpdatedAt?: string;
  pendingFinalApproval: number;
  inFlight: number;
  latestRunId?: string;
  latestRunStatus?: RemediationRunStatus;
  latestRepositoryName?: string;
  latestFailureReason?: string;
}


