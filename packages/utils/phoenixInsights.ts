import { failoverRegistry } from '@packages/core-logic/failoverRegistry.js';
import { githubRemediationRuntime } from '@packages/core-logic/githubRemediationRuntime.js';
import { getCheckpointStats, listActiveCheckpoints, type Checkpoint } from '@packages/core-logic/checkpoint.js';
import { getRecoveryLog } from '@packages/core-logic/gitRecovery.js';
import { phoenixEventBus } from '@packages/core-logic/phoenixEventBus.js';
import { heartbeatMonitor } from '@packages/utils/heartbeatMonitor.js';
import { type DataFlywheelMetricsSnapshot, type DataFlywheelTrendPoint, buildDataFlywheelMetricsSnapshot } from './dataFlywheelMetrics.js';

export interface PhoenixTrendPoint {
  hour: string;
  events: number;
  failures: number;
  failovers: number;
  recoveries: number;
}

export interface PhoenixEventSignal {
  event: string;
  timestamp: string;
  detail: string;
}

export interface PhoenixFailoverAgentSummary {
  agent: string;
  total: number;
  success: number;
  failure: number;
  successRate: number;
}

export interface PhoenixFailoverAttemptSummary {
  primaryAgent: string;
  fallbackAgent: string;
  success: boolean;
  attemptIndex: number;
  timestamp: string;
  error?: string;
}

export interface PhoenixRecoveryEntry {
  type: string;
  agent: string;
  details: string;
  timestamp: string;
}

export interface PhoenixRemediationRunSummary {
  id: string;
  status: string;
  updatedAt: string;
  repositoryName: string;
  failureReason?: string;
  workflowRunId?: string;
}

export interface ObservabilityRecommendation {
  id: string;
  target: 'phoenix' | 'flywheel' | 'combined';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  rationale: string;
  evidence: string[];
  actions: string[];
}

export interface MitigationTrackDraft {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  scope: string[];
  rationale: string;
  actions: string[];
}

export interface PhoenixFlywheelObservabilitySnapshot {
  checkedAt: string;
  windowHours: number;
  summary: {
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    phoenixScore: number;
    phoenixStatus: 'healthy' | 'warning' | 'critical';
    flywheelScore: number;
    flywheelStatus: 'healthy' | 'warning' | 'critical';
    failureSignals: number;
    recoverySignals: number;
    pendingFinalApproval: number;
    pendingCuratedReview: number;
    latestFailureReason?: string;
    latestTrainingAt?: string;
  };
  phoenix: {
    eventBus: {
      totalEvents: number;
      breakdown: DataFlywheelTrendPoint[];
      timeline: PhoenixTrendPoint[];
      recentSignals: PhoenixEventSignal[];
    };
    checkpoints: {
      totalCheckpoints: number;
      activeTasks: number;
      activeCheckpoints: Array<Pick<Checkpoint, 'taskId' | 'stepIndex' | 'stepName' | 'createdAt'>>;
    };
    recovery: {
      total: number;
      breakdown: DataFlywheelTrendPoint[];
      recent: PhoenixRecoveryEntry[];
    };
    failover: {
      totalAttempts: number;
      successCount: number;
      failureCount: number;
      successRate: number;
      byAgent: PhoenixFailoverAgentSummary[];
      recentAttempts: PhoenixFailoverAttemptSummary[];
    };
    heartbeat: {
      status: 'healthy' | 'unhealthy' | 'degraded' | 'checking';
      unhealthyServices: string[];
    };
    remediation: {
      total: number;
      counts: Record<string, number>;
      active: boolean;
      latestUpdatedAt?: string;
      pendingFinalApproval: number;
      inFlight: number;
      latestRunId?: string;
      latestRunStatus?: string;
      latestRepositoryName?: string;
      latestFailureReason?: string;
      recentRuns: PhoenixRemediationRunSummary[];
    };
  };
  flywheel: DataFlywheelMetricsSnapshot;
  recommendations: ObservabilityRecommendation[];
  mitigationTracks: MitigationTrackDraft[];
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeStatus(score: number): 'healthy' | 'warning' | 'critical' {
  if (score >= 85) {
    return 'healthy';
  }

  if (score >= 65) {
    return 'warning';
  }

  return 'critical';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function summarizeEventDetail(event: string, data: unknown): string {
  const record = asRecord(data);
  if (!record) {
    return event;
  }

  if (event === 'phoenix:agent_failed') {
    const agent = toString(record.agentName) ?? 'unknown-agent';
    const error = toString(record.error) ?? 'unknown error';
    return `${agent}: ${error}`;
  }

  if (event === 'phoenix:failover_triggered') {
    const originalAgent = toString(record.originalAgent) ?? 'unknown';
    const fallbackAgent = toString(record.fallbackAgent) ?? 'unknown';
    return `${originalAgent} → ${fallbackAgent}`;
  }

  if (event === 'phoenix:failover_result') {
    const originalAgent = toString(record.originalAgent) ?? 'unknown';
    const fallbackAgent = toString(record.fallbackAgent) ?? 'unknown';
    const state = record.success === false ? 'failed' : 'ok';
    return `${originalAgent} → ${fallbackAgent} (${state})`;
  }

  if (event === 'phoenix:edge_health') {
    const status = toString(record.status) ?? 'unknown';
    const latency = toNumber(record.latencyMs);
    return `${status}${latency !== undefined ? `, ${latency}ms` : ''}`;
  }

  if (event === 'phoenix:circuit_breaker') {
    const agentName = toString(record.agentName) ?? 'unknown';
    const state = toString(record.state) ?? 'unknown';
    const failures = toNumber(record.failures);
    return `${agentName} ${state}${failures !== undefined ? ` (${failures})` : ''}`;
  }

  if (event === 'phoenix:recovery') {
    const agent = toString(record.agent) ?? 'unknown';
    const type = toString(record.type) ?? 'recovery';
    return `${type} for ${agent}`;
  }

  if (event === 'phoenix:remediation_run_updated') {
    const runId = toString(record.runId) ?? 'run';
    const status = toString(record.status) ?? 'unknown';
    return `${runId} → ${status}`;
  }

  if (event === 'phoenix:state_restored') {
    const agentName = toString(record.agentName) ?? 'unknown';
    const stepName = toString(record.stepName) ?? 'step';
    return `${agentName} restored at ${stepName}`;
  }

  return Object.entries(record)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' • ') || event;
}

function isFailureSignal(event: string, data: unknown): boolean {
  const record = asRecord(data);

  if (event === 'phoenix:agent_failed') {
    return true;
  }

  if (event === 'phoenix:failover_result') {
    return record?.success === false;
  }

  if (event === 'phoenix:circuit_breaker') {
    return toString(record?.state) === 'open';
  }

  if (event === 'phoenix:edge_health') {
    return toString(record?.status) !== 'healthy';
  }

  if (event === 'phoenix:degraded') {
    return true;
  }

  if (event === 'phoenix:restart') {
    return record?.success === false;
  }

  return false;
}

function isRecoverySignal(event: string, data: unknown): boolean {
  const record = asRecord(data);

  if (event === 'phoenix:recovery' || event === 'phoenix:state_restored') {
    return true;
  }

  if (event === 'phoenix:restart') {
    return record?.success !== false;
  }

  if (event === 'phoenix:failover_result') {
    return record?.success === true;
  }

  return false;
}

function buildTrend(history: Array<{ event: string; data: unknown; timestamp: string }>, windowHours: number): PhoenixTrendPoint[] {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const buckets = new Map<string, { events: number; failures: number; failovers: number; recoveries: number }>();

  for (const entry of history) {
    const timestampMs = Date.parse(entry.timestamp);
    if (Number.isFinite(timestampMs) && timestampMs < cutoff) {
      continue;
    }

    const hour = entry.timestamp.slice(0, 13);
    const bucket = buckets.get(hour) ?? { events: 0, failures: 0, failovers: 0, recoveries: 0 };
    bucket.events += 1;
    if (isFailureSignal(entry.event, entry.data)) {
      bucket.failures += 1;
    }
    if (entry.event === 'phoenix:failover_triggered' || entry.event === 'phoenix:failover_result') {
      bucket.failovers += 1;
    }
    if (isRecoverySignal(entry.event, entry.data)) {
      bucket.recoveries += 1;
    }
    buckets.set(hour, bucket);
  }

  return Array.from(buckets.entries())
    .map(([hour, value]) => ({ hour, ...value }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

function buildEventBreakdown(stats: Record<string, number>): DataFlywheelTrendPoint[] {
  return Object.entries(stats)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildRecoveryBreakdown(recoveryLog: Array<{ type: string }>): DataFlywheelTrendPoint[] {
  const counts = new Map<string, number>();
  for (const entry of recoveryLog) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildFailoverByAgent(stats: Record<string, { total: number; success: number }>): PhoenixFailoverAgentSummary[] {
  return Object.entries(stats)
    .map(([agent, value]) => ({
      agent,
      total: value.total,
      success: value.success,
      failure: value.total - value.success,
      successRate: value.total > 0 ? value.success / value.total : 0,
    }))
    .sort((a, b) => b.total - a.total || a.agent.localeCompare(b.agent));
}

function buildRecentSignals(history: Array<{ event: string; data: unknown; timestamp: string }>, limit: number): PhoenixEventSignal[] {
  return [...history]
    .reverse()
    .slice(0, limit)
    .map((entry) => ({
      event: entry.event,
      timestamp: entry.timestamp,
      detail: summarizeEventDetail(entry.event, entry.data),
    }));
}

function buildRecentRecoveryEntries(recoveryLog: Array<{ type: string; agent: string; details: string; timestamp: number }>, limit: number): PhoenixRecoveryEntry[] {
  return [...recoveryLog]
    .reverse()
    .slice(0, limit)
    .map((entry) => ({
      type: entry.type,
      agent: entry.agent,
      details: entry.details,
      timestamp: new Date(entry.timestamp).toISOString(),
    }));
}

function buildRecentAttempts(attempts: Array<{ primaryAgent: string; fallbackAgent: string; success: boolean; attemptIndex: number; timestamp: string; error?: string }>): PhoenixFailoverAttemptSummary[] {
  return [...attempts]
    .reverse()
    .slice(0, 5)
    .map((attempt) => ({
      primaryAgent: attempt.primaryAgent,
      fallbackAgent: attempt.fallbackAgent,
      success: attempt.success,
      attemptIndex: attempt.attemptIndex,
      timestamp: attempt.timestamp,
      error: attempt.error,
    }));
}

function buildRecentRuns(runs: Array<Record<string, unknown>>): PhoenixRemediationRunSummary[] {
  return runs.slice(0, 5).map((run) => ({
    id: toString(run.id) ?? toString(run.runId) ?? 'run',
    status: toString(run.status) ?? 'unknown',
    updatedAt: toString(run.updatedAt) ?? toString(run.startedAt) ?? new Date().toISOString(),
    repositoryName: toString(run.repositoryName) ?? 'unknown',
    failureReason: toString(run.failureReason),
    workflowRunId: toString(run.workflowRunId),
  }));
}

function buildPhoenixScore(
  heartbeatStatus: 'healthy' | 'unhealthy' | 'degraded' | 'checking',
  failureSignals: number,
  failoverSuccessRate: number,
  pendingFinalApproval: number,
  checkpointStats: { totalCheckpoints: number; activeTasks: number },
  remediationInFlight: number,
): number {
  let score = 100;

  if (heartbeatStatus === 'unhealthy') {
    score -= 30;
  } else if (heartbeatStatus === 'degraded') {
    score -= 12;
  } else if (heartbeatStatus === 'checking') {
    score -= 4;
  }

  score -= Math.min(30, failureSignals * 8);

  if (failoverSuccessRate < 0.75) {
    score -= 15;
  } else if (failoverSuccessRate < 0.9) {
    score -= 8;
  } else if (failoverSuccessRate < 0.98) {
    score -= 3;
  }

  if (pendingFinalApproval > 0) {
    score -= Math.min(10, pendingFinalApproval * 2);
  }

  if (remediationInFlight > 3) {
    score -= 5;
  }

  if (checkpointStats.totalCheckpoints === 0 && checkpointStats.activeTasks === 0) {
    score -= 8;
  }

  return clamp(score, 0, 100);
}

function buildPhoenixRecommendations(snapshot: PhoenixFlywheelObservabilitySnapshot): ObservabilityRecommendation[] {
  const recommendations: ObservabilityRecommendation[] = [];
  const { summary, phoenix, flywheel } = snapshot;

  if (summary.phoenixStatus !== 'healthy') {
    recommendations.push({
      id: 'phoenix-stabilize-recovery-path',
      target: 'phoenix',
      priority: summary.phoenixStatus === 'critical' ? 'critical' : 'high',
      title: 'Stabilize the Phoenix recovery path',
      rationale: 'Heartbeat, failure or failover pressure indicates the recovery path needs attention.',
      evidence: [
        `heartbeat=${phoenix.heartbeat.status}`,
        `failureSignals=${summary.failureSignals}`,
        `failoverSuccessRate=${phoenix.failover.successRate.toFixed(2)}`,
      ],
      actions: [
        'Tighten failover handoff thresholds and circuit-breaker transitions.',
        'Review the latest Phoenix failure and recovery events for root-cause patterns.',
        'Keep the remediation runtime surfaced in the dashboard until the score returns to healthy.',
      ],
    });
  }

  if (phoenix.failover.successRate < 0.9 && phoenix.failover.totalAttempts > 0) {
    recommendations.push({
      id: 'phoenix-tighten-failover-chain',
      target: 'phoenix',
      priority: phoenix.failover.successRate < 0.75 ? 'critical' : 'high',
      title: 'Tighten the failover chain',
      rationale: 'Failover success is too low for a resilient Phoenix loop.',
      evidence: [`successRate=${phoenix.failover.successRate.toFixed(2)}`, `totalAttempts=${phoenix.failover.totalAttempts}`],
      actions: [
        'Review the top failover pairs and their fallback ordering.',
        'Add regression tests for the most failure-prone agents.',
        'Expose failover success rate by agent in the dashboard summary.',
      ],
    });
  }

  if (phoenix.remediation.pendingFinalApproval > 0) {
    recommendations.push({
      id: 'phoenix-clear-approval-queue',
      target: 'phoenix',
      priority: 'medium',
      title: 'Clear the remediation approval queue',
      rationale: 'Pending final approvals block the self-healing loop from completing.',
      evidence: [`pendingFinalApproval=${phoenix.remediation.pendingFinalApproval}`],
      actions: [
        'Review the most recent remediation runs and approve or reject them.',
        'Keep the approval state visible alongside the run history.',
        'Prefer auto-captured evidence for future remediation candidates.',
      ],
    });
  }

  if (summary.phoenixScore < 65) {
    recommendations.push({
      id: 'phoenix-open-mitigation-track',
      target: 'combined',
      priority: 'critical',
      title: 'Open a Phoenix mitigation track',
      rationale: 'Phoenix health is below the warning threshold and needs a track-level response.',
      evidence: [`phoenixScore=${summary.phoenixScore}`],
      actions: [
        'Create a dedicated mitigation track for the current failure mode.',
        'Bundle the recovery, checkpoint and failover changes behind that track.',
        'Attach test coverage and rollout notes to the track scaffold.',
      ],
    });
  }

  if (flywheel.summary.status !== 'healthy') {
    recommendations.push({
      id: 'phoenix-flywheel-refresh-learning-loop',
      target: 'flywheel',
      priority: flywheel.summary.status === 'critical' ? 'critical' : 'high',
      title: 'Refresh the data flywheel',
      rationale: 'The learning loop is below its healthy operating threshold.',
      evidence: [
        `flywheelScore=${flywheel.summary.score}`,
        `curatedStatus=${flywheel.summary.curatedStatus}`,
        `goldenStatus=${flywheel.summary.goldenStatus}`,
      ],
      actions: [
        'Capture a new curated snapshot and rerun the training cycle.',
        'Promote remediation-derived samples when the quality gate passes.',
        'Expose the latest training artifact in the dashboard summary.',
      ],
    });
  }

  return recommendations.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return order[a.priority] - order[b.priority] || a.title.localeCompare(b.title);
  });
}

function buildMitigationTrackDrafts(recommendations: ObservabilityRecommendation[]): MitigationTrackDraft[] {
  return recommendations
    .filter((recommendation) => recommendation.priority === 'critical' || recommendation.priority === 'high')
    .map((recommendation) => ({
      id: slugify(`${recommendation.target}-${recommendation.title}`),
      title: recommendation.title,
      priority: recommendation.priority,
      scope: recommendation.evidence.length > 0 ? recommendation.evidence : [recommendation.target],
      rationale: recommendation.rationale,
      actions: recommendation.actions,
    }));
}

function buildPhoenixWarnings(
  summary: PhoenixFlywheelObservabilitySnapshot['summary'],
  phoenix: PhoenixFlywheelObservabilitySnapshot['phoenix'],
): string[] {
  const warnings: string[] = [];

  if (phoenix.heartbeat.status === 'unhealthy') {
    warnings.push(`Heartbeat unhealthy: ${phoenix.heartbeat.unhealthyServices.join(', ') || 'unknown services'}.`);
  } else if (phoenix.heartbeat.status === 'degraded') {
    warnings.push(`Heartbeat degraded: ${phoenix.heartbeat.unhealthyServices.join(', ') || 'services listed as unhealthy'}.`);
  }

  if (summary.failureSignals > 0) {
    warnings.push(`Detected ${summary.failureSignals} Phoenix failure signal(s) in the current window.`);
  }

  if (summary.pendingFinalApproval > 0) {
    warnings.push(`There are ${summary.pendingFinalApproval} remediation run(s) waiting for final approval.`);
  }

  if (phoenix.checkpoints.totalCheckpoints === 0 && phoenix.checkpoints.activeTasks === 0) {
    warnings.push('No active checkpoints are present for Phoenix recovery.');
  }

  return warnings;
}

export async function buildPhoenixFlywheelObservabilitySnapshot(options?: {
  windowHours?: number;
  historyLimit?: number;
  recentRunsLimit?: number;
}): Promise<PhoenixFlywheelObservabilitySnapshot> {
  const checkedAt = new Date().toISOString();
  const windowHours = options?.windowHours ?? 24;
  const historyLimit = options?.historyLimit ?? 120;
  const recentRunsLimit = options?.recentRunsLimit ?? 5;

  const [checkpointStats, activeCheckpoints, flywheel] = await Promise.all([
    getCheckpointStats(),
    listActiveCheckpoints(),
    buildDataFlywheelMetricsSnapshot(),
  ]);

  const eventBreakdown = buildEventBreakdown(phoenixEventBus.getStats());
  const eventHistory = phoenixEventBus.getHistory(undefined, historyLimit);
  const trend = buildTrend(eventHistory, windowHours);
  const recentSignals = buildRecentSignals(eventHistory, 10);
  const recoveryLog = getRecoveryLog();
  const recoveryBreakdown = buildRecoveryBreakdown(recoveryLog);
  const recoveryRecent = buildRecentRecoveryEntries(recoveryLog, 5);
  const failoverStats = failoverRegistry.getStats();
  const failoverByAgent = buildFailoverByAgent(failoverStats.byAgent);
  const failoverRecent = buildRecentAttempts(failoverRegistry.getAttempts(undefined, 10));
  const remediationSummary = githubRemediationRuntime.getSummary();
  const remediationRecent = buildRecentRuns(
    githubRemediationRuntime
      .listRuns(undefined, recentRunsLimit)
      .map((run) => ({
        id: run.id,
        status: run.status,
        updatedAt: run.updatedAt,
        repositoryName: run.repositoryName,
        failureReason: run.failureReason,
        workflowRunId: run.workflowRunId,
      })),
  );
  const heartbeat = heartbeatMonitor.getOverallHealth();

  const failureSignals = trend.reduce((total, point) => total + point.failures, 0);
  const recoverySignals = trend.reduce((total, point) => total + point.recoveries, 0);
  const phoenixScore = buildPhoenixScore(
    heartbeat.status,
    failureSignals,
    failoverStats.successRate,
    remediationSummary.pendingFinalApproval,
    checkpointStats,
    remediationSummary.inFlight,
  );
  const phoenixStatus = normalizeStatus(phoenixScore);
  const summaryScore = Math.round((phoenixScore + flywheel.summary.score) / 2);

  const snapshot: PhoenixFlywheelObservabilitySnapshot = {
    checkedAt,
    windowHours,
    summary: {
      score: summaryScore,
      status: normalizeStatus(summaryScore),
      phoenixScore,
      phoenixStatus,
      flywheelScore: flywheel.summary.score,
      flywheelStatus: flywheel.summary.status,
      failureSignals,
      recoverySignals,
      pendingFinalApproval: remediationSummary.pendingFinalApproval,
      pendingCuratedReview: flywheel.curated.pendingReview,
      latestFailureReason: remediationSummary.latestFailureReason,
      latestTrainingAt: flywheel.golden.lastTrainingAt ?? flywheel.learningLoop.latestTrainingRuns[0]?.completedAt ?? flywheel.learningLoop.latestTrainingRuns[0]?.startedAt,
    },
    phoenix: {
      eventBus: {
        totalEvents: Object.values(phoenixEventBus.getStats()).reduce((total, count) => total + count, 0),
        breakdown: eventBreakdown,
        timeline: trend,
        recentSignals,
      },
      checkpoints: {
        totalCheckpoints: checkpointStats.totalCheckpoints,
        activeTasks: checkpointStats.activeTasks,
        activeCheckpoints: activeCheckpoints.slice(0, 5).map((checkpoint) => ({
          taskId: checkpoint.taskId,
          stepIndex: checkpoint.stepIndex,
          stepName: checkpoint.stepName,
          createdAt: checkpoint.createdAt,
        })),
      },
      recovery: {
        total: recoveryLog.length,
        breakdown: recoveryBreakdown,
        recent: recoveryRecent,
      },
      failover: {
        totalAttempts: failoverStats.totalAttempts,
        successCount: failoverStats.successCount,
        failureCount: failoverStats.failureCount,
        successRate: failoverStats.successRate,
        byAgent: failoverByAgent,
        recentAttempts: failoverRecent,
      },
      heartbeat,
      remediation: {
        total: remediationSummary.total,
        counts: remediationSummary.counts as Record<string, number>,
        active: remediationSummary.active,
        latestUpdatedAt: remediationSummary.latestUpdatedAt,
        pendingFinalApproval: remediationSummary.pendingFinalApproval,
        inFlight: remediationSummary.inFlight,
        latestRunId: remediationSummary.latestRunId,
        latestRunStatus: remediationSummary.latestRunStatus,
        latestRepositoryName: remediationSummary.latestRepositoryName,
        latestFailureReason: remediationSummary.latestFailureReason,
        recentRuns: remediationRecent,
      },
    },
    flywheel,
    recommendations: [],
    mitigationTracks: [],
    warnings: [],
  };

  snapshot.recommendations = buildPhoenixRecommendations(snapshot).concat(flywheel.recommendations);
  snapshot.mitigationTracks = buildMitigationTrackDrafts(snapshot.recommendations);
  snapshot.warnings = [
    ...buildPhoenixWarnings(snapshot.summary, snapshot.phoenix),
    ...flywheel.warnings,
  ];

  return snapshot;
}

export function renderPhoenixFlywheelMarkdown(snapshot: PhoenixFlywheelObservabilitySnapshot): string {
  const phoenixTopEvents = snapshot.phoenix.eventBus.breakdown.slice(0, 5);
  const flywheelSources = snapshot.flywheel.golden.sourceBreakdown.slice(0, 5);
  const latestRuns = snapshot.flywheel.learningLoop.latestTrainingRuns.slice(0, 5);

  const lines = [
    '# Phoenix / Flywheel Observability',
    '',
    `- Checked at: ${snapshot.checkedAt}`,
    `- Window: last ${snapshot.windowHours} hour(s)`,
    `- Overall score: ${snapshot.summary.score} (${snapshot.summary.status})`,
    `- Phoenix score: ${snapshot.summary.phoenixScore} (${snapshot.summary.phoenixStatus})`,
    `- Flywheel score: ${snapshot.summary.flywheelScore} (${snapshot.summary.flywheelStatus})`,
    '',
    '## Phoenix signals',
    `- Failure signals: ${snapshot.summary.failureSignals}`,
    `- Recovery signals: ${snapshot.summary.recoverySignals}`,
    `- Failover success rate: ${(snapshot.phoenix.failover.successRate * 100).toFixed(1)}%`,
    `- Pending final approvals: ${snapshot.summary.pendingFinalApproval}`,
    `- Active checkpoints: ${snapshot.phoenix.checkpoints.activeTasks}`,
    '',
    '### Top event types',
    ...phoenixTopEvents.map((event) => `- ${event.label}: ${event.value}`),
    '',
    '## Flywheel signals',
    `- Golden samples: ${snapshot.flywheel.golden.totalSamples}`,
    `- New since last training: ${snapshot.flywheel.golden.newSinceLastTraining}`,
    `- Pending review: ${snapshot.summary.pendingCuratedReview}`,
    `- Active reflex model: ${snapshot.flywheel.learningLoop.activeReflexModel ?? 'n/a'}`,
    '',
    '### Top golden sources',
    ...flywheelSources.map((source) => `- ${source.label}: ${source.value}`),
    '',
    '### Latest learning runs',
    ...(latestRuns.length > 0
      ? latestRuns.map((run) => `- ${run.runId}: ${run.status}${run.completedAt ? ` @ ${run.completedAt}` : ''}`)
      : ['- No training runs recorded yet.']),
    '',
    '### Recent remediation runs',
    ...(snapshot.phoenix.remediation.recentRuns.length > 0
      ? snapshot.phoenix.remediation.recentRuns.map(
          (run) =>
            `- ${run.id}: ${run.status}${run.updatedAt ? ` @ ${run.updatedAt}` : ''}${run.workflowRunId ? ` (workflow ${run.workflowRunId})` : ''}`,
        )
      : ['- No remediation runs recorded yet.']),
    '',
    '## Recommendations',
    ...(snapshot.recommendations.length > 0
      ? snapshot.recommendations.map((recommendation) => `- **${recommendation.title}** — ${recommendation.rationale}`)
      : ['- No active recommendations.']),
    '',
    '## Mitigation tracks',
    ...(snapshot.mitigationTracks.length > 0
      ? snapshot.mitigationTracks.map((track) => `- **${track.title}** (${track.priority})`)
      : ['- No mitigation tracks suggested.']),
  ];

  return lines.join('\n');
}

