import { type EphemeralAgentRecord } from './ephemeralAgentManager.js';
import { logInfo } from '@packages/utils/logger.js';

export interface EphemeralPostmortem {
  agentId: string;
  parentAgentName: string;
  purpose: string;
  state: string;
  spawnedAt: string;
  terminatedAt?: string;
  terminationReason?: string;
  durationMs?: number;
  tokenUsed: number;
  costUsed: number;
  stepsUsed: number;
  allowedTools: string[];
  deniedTools: string[];
  allowedPaths: string[];
  allowedHosts: string[];
  auditTrail: Array<{ timestamp: string; event: string; detail?: string }>;
  budgets: {
    ttlMs?: number;
    tokenBudget?: number;
    costBudgetUsd?: number;
    stepBudget?: number;
    renewalsUsed?: number;
    maxRenewals?: number;
    budgetStatus?: string;
  };
  approval?: {
    kind: string;
    workflowId: string;
    approvalRequestId: string;
    requestedAt: string;
    reason: string;
    budgetType?: string;
  };
  summary: string;
}

const postmortems: EphemeralPostmortem[] = [];
const MAX_POSTMORTEMS = 500;

export function generatePostmortem(record: EphemeralAgentRecord): EphemeralPostmortem {
  const durationMs = record.terminatedAt !== undefined
    ? new Date(record.terminatedAt).getTime() - new Date(record.spawnedAt).getTime()
    : undefined;

  const budgetPcts: string[] = [];
  if (record.spec.tokenBudget !== undefined && record.spec.tokenBudget > 0) {
    budgetPcts.push(`tokens ${Math.round((record.tokenUsed / record.spec.tokenBudget) * 100)}%`);
  }
  if (record.spec.costBudgetUsd !== undefined && record.spec.costBudgetUsd > 0) {
    budgetPcts.push(`cost ${Math.round((record.costUsed / record.spec.costBudgetUsd) * 100)}%`);
  }
  if (record.spec.stepBudget !== undefined && record.spec.stepBudget > 0) {
    budgetPcts.push(`steps ${Math.round((record.stepsUsed / record.spec.stepBudget) * 100)}%`);
  }

  const allowedTools = record.spec.allowedTools ?? [];
  const allowedPaths = record.spec.allowedPaths ?? [];
  const allowedHosts = record.spec.allowedHosts ?? [];
  const deniedTools = record.spec.deniedTools ?? [];
  const lease = record.lease;

  const scopeParts: string[] = [];
  if (allowedTools.length > 0) scopeParts.push(`tools ${allowedTools.length}`);
  if (allowedPaths.length > 0) scopeParts.push(`paths ${allowedPaths.length}`);
  if (allowedHosts.length > 0) scopeParts.push(`hosts ${allowedHosts.length}`);

  const budgetSummary = budgetPcts.length > 0 ? ` Budget used: ${budgetPcts.join(', ')}.` : '';
  const durationSummary = durationMs !== undefined ? ` Duration: ${durationMs}ms.` : '';
  const scopeSummary = scopeParts.length > 0 ? ` Scope: ${scopeParts.join(', ')}.` : '';
  const summary = `Agent ${record.id.slice(0, 8)} (${record.spec.purpose}) ended as '${record.state}'.${durationSummary}${budgetSummary}${scopeSummary}`;

  const postmortem: EphemeralPostmortem = {
    agentId: record.id,
    parentAgentName: record.spec.parentAgentName,
    purpose: record.spec.purpose,
    state: record.state,
    spawnedAt: record.spawnedAt,
    terminatedAt: record.terminatedAt,
    terminationReason: record.terminationReason,
    durationMs,
    tokenUsed: record.tokenUsed,
    costUsed: record.costUsed,
    stepsUsed: record.stepsUsed,
    allowedTools,
    deniedTools,
    allowedPaths,
    allowedHosts,
    auditTrail: record.auditTrail,
    budgets: {
      ttlMs: record.spec.ttlMs,
      tokenBudget: record.spec.tokenBudget,
      costBudgetUsd: record.spec.costBudgetUsd,
      stepBudget: record.spec.stepBudget,
      renewalsUsed: lease?.renewalsUsed,
      maxRenewals: lease?.maxRenewals,
      budgetStatus: lease?.budgetStatus,
    },
    approval: record.approval ? {
      kind: record.approval.kind,
      workflowId: record.approval.workflowId,
      approvalRequestId: record.approval.approvalRequestId,
      requestedAt: record.approval.requestedAt,
      reason: record.approval.reason,
      budgetType: record.approval.budgetType,
    } : undefined,
    summary,
  };

  postmortems.push(postmortem);
  if (postmortems.length > MAX_POSTMORTEMS) {
    postmortems.splice(0, postmortems.length - MAX_POSTMORTEMS);
  }

  logInfo('EphemeralAudit', `Postmortem recorded: ${summary}`);
  return postmortem;
}

export function getPostmortems(limit = 50): EphemeralPostmortem[] {
  return postmortems.slice(-limit).reverse();
}

export function getPostmortem(agentId: string): EphemeralPostmortem | undefined {
  return postmortems.find((postmortem) => postmortem.agentId === agentId);
}

export function clearPostmortems(): void {
  postmortems.length = 0;
}

