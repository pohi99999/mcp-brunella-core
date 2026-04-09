import { getGoldenStats, getCuratedGoldenStats, type CuratedGoldenStats, type GoldenDatasetStats } from '../core/goldenDatasetBridge.js';
import { getLearningLoopOverview } from '../core/learningLoopService.js';

export interface DataFlywheelTrendPoint {
  label: string;
  value: number;
}

export interface DataFlywheelTrainingRunSummary {
  runId: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  snapshotId?: string;
  dryRun?: boolean;
  avgQuality?: number;
  summary?: string;
  modelName?: string;
}

export interface DataFlywheelSnapshotSummary {
  snapshotId: string;
  sampleCount: number;
  avgQuality: number;
  createdAt: string;
  minQuality: number;
  sourceFilter?: string;
}

export interface DataFlywheelRecommendation {
  id: string;
  target: 'flywheel';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  rationale: string;
  evidence: string[];
  actions: string[];
}

export interface DataFlywheelMetricsSnapshot {
  checkedAt: string;
  golden: {
    totalSamples: number;
    newSinceLastTraining: number;
    lastTrainingAt?: string;
    avgQuality: number | null;
    status: string | null;
    sourceBreakdown: DataFlywheelTrendPoint[];
  };
  curated: CuratedGoldenStats;
  learningLoop: {
    latestSnapshot: DataFlywheelSnapshotSummary | null;
    latestTrainingRuns: DataFlywheelTrainingRunSummary[];
    activeReflexModel: string | null;
    registrySummary: Record<string, unknown> | null;
  };
  trend: {
    sampleStateBreakdown: DataFlywheelTrendPoint[];
    trainingRunStatusBreakdown: DataFlywheelTrendPoint[];
  };
  summary: {
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    goldenStatus: 'healthy' | 'warning' | 'critical';
    curatedStatus: 'healthy' | 'warning' | 'critical';
  };
  warnings: string[];
  recommendations: DataFlywheelRecommendation[];
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

function normalizeRecordedStatus(value: unknown): 'healthy' | 'warning' | 'critical' | null {
  if (value === 'healthy' || value === 'warning' || value === 'critical') {
    return value;
  }

  return null;
}

function normalizeSourceBreakdown(sources: Record<string, number> | undefined): DataFlywheelTrendPoint[] {
  return Object.entries(sources ?? {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function normalizeTrainingRuns(runs: unknown): DataFlywheelTrainingRunSummary[] {
  if (!Array.isArray(runs)) {
    return [];
  }

  return runs
    .flatMap((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return [];
      }

      return [
        {
          runId: toString(record.runId) ?? toString(record.id) ?? `run-${index + 1}`,
          status: toString(record.status) ?? 'unknown',
          startedAt: toString(record.startedAt) ?? toString(record.createdAt),
          completedAt: toString(record.completedAt),
          snapshotId: toString(record.snapshotId),
          dryRun: typeof record.dryRun === 'boolean' ? record.dryRun : undefined,
          avgQuality: toNumber(record.avgQuality),
          summary: toString(record.summary),
          modelName: toString(record.modelName),
        } satisfies DataFlywheelTrainingRunSummary,
      ];
    })
    .sort((a, b) => {
      const aStamp = a.completedAt ?? a.startedAt ?? '';
      const bStamp = b.completedAt ?? b.startedAt ?? '';
      return bStamp.localeCompare(aStamp);
    })
    .slice(0, 5);
}

function summarizeLatestSnapshot(value: unknown): DataFlywheelSnapshotSummary | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const snapshotId = toString(record.snapshotId) ?? toString(record.id);
  const sampleCount = toNumber(record.sampleCount);
  const avgQuality = toNumber(record.avgQuality);
  const createdAt = toString(record.createdAt);

  if (!snapshotId || sampleCount === undefined || avgQuality === undefined || !createdAt) {
    return null;
  }

  return {
    snapshotId,
    sampleCount,
    avgQuality,
    createdAt,
    minQuality: toNumber(record.minQuality) ?? 0,
    sourceFilter: toString(record.sourceFilter),
  };
}

function buildSampleStateBreakdown(curated: CuratedGoldenStats): DataFlywheelTrendPoint[] {
  return [
    { label: 'approved', value: curated.approvedCount },
    { label: 'pending', value: curated.pendingReview },
    { label: 'rejected', value: curated.rejectedCount },
  ];
}

function buildTrainingStatusBreakdown(runs: DataFlywheelTrainingRunSummary[]): DataFlywheelTrendPoint[] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    counts.set(run.status, (counts.get(run.status) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildFlywheelWarnings(
  golden: DataFlywheelMetricsSnapshot['golden'],
  curated: CuratedGoldenStats,
  latestTrainingRuns: DataFlywheelTrainingRunSummary[],
  activeReflexModel: string | null,
): string[] {
  const warnings: string[] = [];

  if (golden.totalSamples === 0) {
    warnings.push('Nincs még golden dataset minta.');
  }

  if (golden.newSinceLastTraining > 25) {
    warnings.push(`Túl sok új sample vár tréningre: ${golden.newSinceLastTraining}.`);
  }

  if (curated.pendingReview > curated.approvedCount) {
    warnings.push(`A pending review sor nagyobb, mint az approved állomány: ${curated.pendingReview} pending.`);
  }

  if (curated.avgQuality < 0.75) {
    warnings.push(`Az átlagos curated quality alacsony: ${curated.avgQuality.toFixed(2)}.`);
  }

  if (latestTrainingRuns.length === 0) {
    warnings.push('Még nincs learning-loop tréning futás.');
  }

  if (!activeReflexModel) {
    warnings.push('Nincs aktív reflex modell.');
  }

  return warnings;
}

function buildFlywheelRecommendations(snapshot: DataFlywheelMetricsSnapshot): DataFlywheelRecommendation[] {
  const recommendations: DataFlywheelRecommendation[] = [];
  const { golden, curated, learningLoop } = snapshot;

  if (golden.totalSamples === 0) {
    recommendations.push({
      id: 'flywheel-capture-golden-samples',
      target: 'flywheel',
      priority: 'critical',
      title: 'Capture the first golden samples',
      rationale: 'The learning loop cannot improve without a baseline golden dataset.',
      evidence: ['golden.totalSamples=0'],
      actions: [
        'Capture curated samples from successful tasks and approvals.',
        'Seed the dataset with high-quality remediation examples.',
        'Re-run the learning loop snapshot after the first batch lands.',
      ],
    });
  }

  if (golden.newSinceLastTraining > 25) {
    recommendations.push({
      id: 'flywheel-refresh-training-snapshot',
      target: 'flywheel',
      priority: 'high',
      title: 'Refresh the training snapshot',
      rationale: 'Too many samples have accumulated since the last training pass.',
      evidence: [`newSinceLastTraining=${golden.newSinceLastTraining}`],
      actions: [
        'Create a fresh curated snapshot.',
        'Run the nightly training cycle against the updated dataset.',
        'Promote the resulting reflex candidate when the eval passes.',
      ],
    });
  }

  if (curated.pendingReview > curated.approvedCount) {
    recommendations.push({
      id: 'flywheel-clear-review-queue',
      target: 'flywheel',
      priority: 'high',
      title: 'Clear the curated review queue',
      rationale: 'Pending review is larger than the approved set, which slows the flywheel.',
      evidence: [`pendingReview=${curated.pendingReview}`, `approvedCount=${curated.approvedCount}`],
      actions: [
        'Review and classify the highest-quality pending samples first.',
        'Promote approved remediation-derived samples into the training snapshot.',
        'Reject or redact low-quality candidates before the next cycle.',
      ],
    });
  }

  if (curated.avgQuality < 0.75) {
    recommendations.push({
      id: 'flywheel-raise-quality-floor',
      target: 'flywheel',
      priority: 'critical',
      title: 'Raise the curated quality floor',
      rationale: 'The average curated quality is below a healthy training threshold.',
      evidence: [`avgQuality=${curated.avgQuality.toFixed(2)}`],
      actions: [
        'Increase the minimum quality threshold for curated intake.',
        'Add tighter sample review and redaction validation.',
        'Prefer remediation-derived samples with reproducible acceptance evidence.',
      ],
    });
  }

  if (learningLoop.latestTrainingRuns.length === 0) {
    recommendations.push({
      id: 'flywheel-schedule-training-cycle',
      target: 'flywheel',
      priority: 'medium',
      title: 'Schedule the first training cycle',
      rationale: 'The learning loop has snapshots, but no visible training run yet.',
      evidence: ['latestTrainingRuns=0'],
      actions: [
        'Run the learning loop training workflow.',
        'Capture the generated artifact path in the snapshot metadata.',
        'Expose the training result in the dashboard and CLI output.',
      ],
    });
  }

  if (!learningLoop.activeReflexModel) {
    recommendations.push({
      id: 'flywheel-promote-reflex-model',
      target: 'flywheel',
      priority: 'high',
      title: 'Promote an active reflex model',
      rationale: 'There is no promoted reflex model backing the current flywheel.',
      evidence: ['activeReflexModel=null'],
      actions: [
        'Promote the best-scoring candidate after a successful eval.',
        'Keep the latest training artifact attached to the model record.',
        'Show the active reflex model in the dashboard summary card.',
      ],
    });
  }

  if (curated.remediationDerived.approvedCount > 0) {
    recommendations.push({
      id: 'flywheel-leverage-remediation-candidates',
      target: 'flywheel',
      priority: 'low',
      title: 'Leverage remediation-derived samples',
      rationale: 'Approved remediation candidates are available for dataset enrichment.',
      evidence: [`remediationApproved=${curated.remediationDerived.approvedCount}`],
      actions: [
        'Promote remediation-derived approvals into the next snapshot.',
        'Track the last approved remediation timestamp for trend visibility.',
        'Keep rejected candidates out of the training dataset.',
      ],
    });
  }

  return recommendations.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return order[a.priority] - order[b.priority] || a.title.localeCompare(b.title);
  });
}

function buildFlywheelScore(
  golden: DataFlywheelMetricsSnapshot['golden'],
  curated: CuratedGoldenStats,
  latestTrainingRuns: DataFlywheelTrainingRunSummary[],
  activeReflexModel: string | null,
): number {
  let score = 100;

  if (golden.totalSamples === 0) {
    score -= 35;
  } else if (golden.totalSamples < 10) {
    score -= 20;
  } else if (golden.totalSamples < 50) {
    score -= 10;
  }

  if (golden.newSinceLastTraining > 50) {
    score -= 15;
  } else if (golden.newSinceLastTraining > 25) {
    score -= 8;
  }

  if (curated.avgQuality < 0.65) {
    score -= 20;
  } else if (curated.avgQuality < 0.8) {
    score -= 10;
  }

  if (curated.pendingReview > curated.approvedCount) {
    score -= 10;
  }

  if (latestTrainingRuns.length === 0) {
    score -= 10;
  }

  if (!activeReflexModel) {
    score -= 10;
  }

  if (curated.remediationDerived.approvedCount > 0) {
    score += 3;
  }

  return clamp(score, 0, 100);
}

export async function buildDataFlywheelMetricsSnapshot(): Promise<DataFlywheelMetricsSnapshot> {
  const checkedAt = new Date().toISOString();
  const [goldenStats, learningLoopRaw] = await Promise.all([
    getGoldenStats(),
    getLearningLoopOverview(),
  ]);

  const curatedStats = getCuratedGoldenStats();
  const latestTrainingRuns = normalizeTrainingRuns((learningLoopRaw as Record<string, unknown>).latestTrainingRuns);
  const latestSnapshot = summarizeLatestSnapshot((learningLoopRaw as Record<string, unknown>).latestSnapshot);
  const activeReflexModel = (() => {
    const raw = (learningLoopRaw as Record<string, unknown>).activeReflexModel;
    const record = asRecord(raw);

    if (typeof raw === 'string') {
      return raw;
    }

    if (!record) {
      return null;
    }

    return toString(record.displayName)
      ?? toString(record.modelName)
      ?? toString(record.version)
      ?? null;
  })();

  const registrySummary = asRecord((learningLoopRaw as Record<string, unknown>).registry);
  const golden: DataFlywheelMetricsSnapshot['golden'] = {
    totalSamples: goldenStats?.totalSamples ?? 0,
    newSinceLastTraining: goldenStats?.newSinceLastTraining ?? 0,
    lastTrainingAt: goldenStats?.lastTrainingAt,
    avgQuality: goldenStats?.avgQuality ?? null,
    status: goldenStats?.status ?? null,
    sourceBreakdown: normalizeSourceBreakdown(goldenStats?.sources),
  };

  const flywheelScore = buildFlywheelScore(golden, curatedStats, latestTrainingRuns, activeReflexModel);
  const flywheelStatus = normalizeStatus(flywheelScore);
  const goldenStatus = normalizeRecordedStatus(golden.status) ?? normalizeStatus(
    golden.totalSamples === 0
      ? 0
      : golden.avgQuality !== null
        ? golden.avgQuality >= 0.85
          ? 92
          : golden.avgQuality >= 0.75
            ? 76
            : 58
        : 70,
  );
  const curatedStatus = normalizeStatus(
    curatedStats.avgQuality >= 0.85
      ? 92
      : curatedStats.avgQuality >= 0.75
        ? 76
        : curatedStats.avgQuality >= 0.65
          ? 58
          : 42,
  );

  const snapshot: DataFlywheelMetricsSnapshot = {
    checkedAt,
    golden,
    curated: curatedStats,
    learningLoop: {
      latestSnapshot,
      latestTrainingRuns,
      activeReflexModel,
      registrySummary,
    },
    trend: {
      sampleStateBreakdown: buildSampleStateBreakdown(curatedStats),
      trainingRunStatusBreakdown: buildTrainingStatusBreakdown(latestTrainingRuns),
    },
    summary: {
      score: flywheelScore,
      status: flywheelStatus,
      goldenStatus,
      curatedStatus,
    },
    warnings: buildFlywheelWarnings(golden, curatedStats, latestTrainingRuns, activeReflexModel),
    recommendations: [],
  };

  snapshot.recommendations = buildFlywheelRecommendations(snapshot);
  return snapshot;
}

export function renderDataFlywheelMetricsMarkdown(snapshot: DataFlywheelMetricsSnapshot): string {
  const lines = [
    '# Data Flywheel',
    '',
    `- Checked at: ${snapshot.checkedAt}`,
    `- Score: ${snapshot.summary.score} (${snapshot.summary.status})`,
    `- Golden status: ${snapshot.summary.goldenStatus}`,
    `- Curated status: ${snapshot.summary.curatedStatus}`,
    `- Golden samples: ${snapshot.golden.totalSamples}`,
    `- New since last training: ${snapshot.golden.newSinceLastTraining}`,
    `- Curated avg quality: ${snapshot.curated.avgQuality.toFixed(2)}`,
    `- Pending review: ${snapshot.curated.pendingReview}`,
    `- Active reflex model: ${snapshot.learningLoop.activeReflexModel ?? 'n/a'}`,
    '',
    '## Recommendations',
  ];

  if (snapshot.recommendations.length === 0) {
    lines.push('- No flywheel recommendations.');
  } else {
    for (const recommendation of snapshot.recommendations) {
      lines.push(`- **${recommendation.title}** — ${recommendation.rationale}`);
      for (const action of recommendation.actions) {
        lines.push(`  - ${action}`);
      }
    }
  }

  return lines.join('\n');
}
