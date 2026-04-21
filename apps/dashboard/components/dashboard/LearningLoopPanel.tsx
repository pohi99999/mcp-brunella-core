import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Database,
  FlaskConical,
  Clock,
  RefreshCcw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type EvalGateStatus = 'passed' | 'failed' | 'warning';
type ReflexModelState = 'candidate' | 'shadow' | 'active' | 'retired';
type TrainingRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dry_run';
type CuratedGoldenApprovalState = 'pending' | 'approved' | 'rejected';
type CuratedGoldenFilterState = CuratedGoldenApprovalState | 'all';

interface CuratedGoldenStats {
  totalCandidates: number;
  approvedCount: number;
  rejectedCount: number;
  pendingReview: number;
  avgQuality: number;
  lastApprovedAt?: string;
}

interface CuratedGoldenSample {
  id: string;
  prompt: string;
  completion: string;
  source: string;
  quality: number;
  approvalState: CuratedGoldenApprovalState;
  provenance?: Record<string, unknown>;
  piiRedactedCount?: number;
  createdAt: string;
  approvedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

interface CuratedGoldenSamplesApiResponse {
  success?: boolean;
  count: number;
  data: CuratedGoldenSample[];
  error?: string;
}

interface TrainingRunRecord {
  runId: string;
  status: TrainingRunStatus;
  dryRun: boolean;
  modelName: string;
  sampleCount: number;
  avgQuality: number;
  summary?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface EvalResultRecord {
  resultId: string;
  candidateVersion: string;
  baselineModel: string;
  avgScore: number;
  regressionDelta: number;
  scenarioCount: number;
  gateStatus: EvalGateStatus;
  summary?: string;
  createdAt: string;
}

interface ReflexModelRecord {
  modelId: string;
  version: string;
  displayName: string;
  state: ReflexModelState;
  provider: string;
  modelName: string;
  artifactPath: string;
  snapshotPath: string;
  trainerRunId: string;
  evalResultId?: string;
  avgScore?: number;
  regressionDelta?: number;
  routineCategories: string[];
  createdAt: string;
  updatedAt: string;
  promotedAt?: string;
  promotedBy?: string;
  retiredAt?: string;
  retiredReason?: string;
}

interface ReflexRegistrySummary {
  activeModel: ReflexModelRecord | null;
  shadowModels: ReflexModelRecord[];
  candidateModels: ReflexModelRecord[];
  retiredModels: ReflexModelRecord[];
  latestTrainingRuns: TrainingRunRecord[];
  latestEvalResults: EvalResultRecord[];
}

interface LearningLoopOverview {
  curatedStats: CuratedGoldenStats | null;
  registry: ReflexRegistrySummary;
  latestTrainingRuns: TrainingRunRecord[];
  activeReflexModel: ReflexModelRecord | null;
}

interface LearningLoopApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

const CURATED_FILTERS: Array<{ value: CuratedGoldenFilterState; label: string }> = [
  { value: 'pending', label: 'Függő' },
  { value: 'approved', label: 'Jóváhagyott' },
  { value: 'rejected', label: 'Elutasított' },
  { value: 'all', label: 'Összes' },
];

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function trainingStatusTone(status: TrainingRunStatus): string {
  if (status === 'completed') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (status === 'running') return 'text-blue-300 border-blue-500/20 bg-blue-500/10';
  if (status === 'dry_run') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  if (status === 'failed') return 'text-red-300 border-red-500/20 bg-red-500/10';
  return 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10';
}

function gateTone(status: EvalGateStatus): string {
  if (status === 'passed') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (status === 'warning') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  return 'text-red-300 border-red-500/20 bg-red-500/10';
}

function modelStateTone(state: ReflexModelState): string {
  if (state === 'active') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (state === 'shadow') return 'text-blue-300 border-blue-500/20 bg-blue-500/10';
  if (state === 'candidate') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  return 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10';
}

function curatedStateTone(state: CuratedGoldenApprovalState): string {
  if (state === 'approved') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (state === 'rejected') return 'text-red-300 border-red-500/20 bg-red-500/10';
  return 'text-yellow-300 border-yellow-500/20 bg-yellow-500/10';
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-400">{hint}</div> : null}
    </div>
  );
}

function CuratedSampleCard({
  sample,
  busy,
  onReview,
}: {
  sample: CuratedGoldenSample;
  busy: boolean;
  onReview: (sampleId: string, decision: 'approved' | 'rejected') => void;
}) {
  const provenanceKind = typeof sample.provenance?.kind === 'string' ? sample.provenance.kind : undefined;
  const reviewLabel = sample.reviewedBy ? `Ellenőrizte: ${sample.reviewedBy}` : 'Még nincs review';

  return (
    <div data-testid={`curated-sample-${sample.id}`} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={curatedStateTone(sample.approvalState)}>
              {sample.approvalState.toUpperCase()}
            </Badge>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{sample.source}</span>
            {provenanceKind ? <span className="text-[10px] text-zinc-500 font-mono">{provenanceKind}</span> : null}
          </div>
          <div className="text-xs text-zinc-400">
            Quality {sample.quality.toFixed(2)} • {formatTimestamp(sample.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Minta</div>
          <div className="text-sm font-semibold text-white">{sample.id}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Prompt</div>
          <p className="mt-1 text-sm text-zinc-200">{truncateText(sample.prompt, 180)}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Completion</div>
          <p className="mt-1 text-sm text-zinc-300">{truncateText(sample.completion, 220)}</p>
        </div>
      </div>

      {sample.reviewNotes ? (
        <div className="rounded-md border border-white/[0.04] bg-black/20 px-2 py-1 text-xs text-zinc-400">
          Megjegyzés: {sample.reviewNotes}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">
          {reviewLabel}
          {sample.approvedAt ? ` • ${formatTimestamp(sample.approvedAt)}` : ''}
        </div>
        {sample.approvalState === 'pending' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => onReview(sample.id, 'approved')}
              disabled={busy}
              data-testid={`curated-approve-${sample.id}`}
            >
              <CheckCircle2 size={14} /> Jóváhagyás
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              onClick={() => onReview(sample.id, 'rejected')}
              disabled={busy}
              data-testid={`curated-reject-${sample.id}`}
            >
              <XCircle size={14} /> Elutasítás
            </Button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
            <Clock size={12} />
            Review kész
          </div>
        )}
      </div>
    </div>
  );
}

export function LearningLoopPanel() {
  const [overview, setOverview] = useState<LearningLoopOverview | null>(null);
  const [curatedSamples, setCuratedSamples] = useState<CuratedGoldenSample[]>([]);
  const [curatedCount, setCuratedCount] = useState(0);
  const [curatedStateFilter, setCuratedStateFilter] = useState<CuratedGoldenFilterState>('pending');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curatedError, setCuratedError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [curatedLoading, setCuratedLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const response = await fetch('/api/v1/learning-loop/overview');
      const payload = await response.json() as LearningLoopApiResponse<LearningLoopOverview>;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setOverview(payload.data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadCuratedSamples = useCallback(async (filter: CuratedGoldenFilterState = curatedStateFilter) => {
    setCuratedLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '8',
        offset: '0',
      });
      if (filter !== 'all') {
        params.set('state', filter);
      }

      const response = await fetch(`/api/v1/learning-loop/curated/samples?${params.toString()}`);
      const payload = await response.json() as CuratedGoldenSamplesApiResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setCuratedSamples(payload.data);
      setCuratedCount(typeof payload.count === 'number' ? payload.count : payload.data.length);
      setCuratedError(null);
    } catch (err: unknown) {
      setCuratedError(err instanceof Error ? err.message : String(err));
    } finally {
      setCuratedLoading(false);
    }
  }, [curatedStateFilter]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadOverview(),
      loadCuratedSamples(curatedStateFilter),
    ]);
  }, [curatedStateFilter, loadCuratedSamples, loadOverview]);

  useEffect(() => {
    void refreshDashboard();
    const interval = window.setInterval(() => void refreshDashboard(), 30_000);
    return () => window.clearInterval(interval);
  }, [refreshDashboard]);

  const runAction = useCallback(async (action: string, path: string, body?: Record<string, unknown>) => {
    setBusyAction(action);
    setError(null);
    setCuratedError(null);
    try {
      const response = await fetch(`/api/v1/learning-loop${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json() as LearningLoopApiResponse<Record<string, unknown>>;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      await refreshDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  }, [refreshDashboard]);

  const handleCuratedReview = useCallback(async (sampleId: string, decision: 'approved' | 'rejected') => {
    await runAction(`review-${sampleId}`, `/curated/review/${sampleId}`, {
      decision,
      reviewer: 'dashboard',
    });
  }, [runAction]);

  const registry = overview?.registry;
  const latestTraining = useMemo(() => registry?.latestTrainingRuns?.[0] ?? overview?.latestTrainingRuns?.[0] ?? null, [overview, registry]);
  const latestEval = useMemo(() => registry?.latestEvalResults?.[0] ?? null, [registry]);
  const activeModel = registry?.activeModel ?? overview?.activeReflexModel ?? null;
  const candidateModels = registry?.candidateModels ?? [];
  const shadowModels = registry?.shadowModels ?? [];
  const latestCandidate = candidateModels[0] ?? null;

  const promotableModels = useMemo(
    () => [...candidateModels, ...shadowModels].filter((model) => Boolean(model.evalResultId)),
    [candidateModels, shadowModels],
  );
  const loading = overviewLoading || curatedLoading;

  const handlePromote = async (modelId: string) => {
    await runAction(`promote-${modelId}`, `/models/${modelId}/promote`);
  };

  const handleRollback = async () => {
    await runAction('rollback', '/rollback', {});
  };

  if (loading && !overview) {
    return <div className="p-6 text-sm text-zinc-400">Learning Loop betöltése...</div>;
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-cyan-400" /> Learning Loop
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Kurált golden dataset, nightly trainer, eval harness és reflex model registry áttekintés.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={error ? 'destructive' : loading ? 'secondary' : 'default'}>
            {error ? 'HIBA' : loading ? 'BETÖLTÉS' : 'ÉLŐ'}
          </Badge>
          <Button onClick={() => void refreshDashboard()} variant="outline" className="gap-2" disabled={Boolean(busyAction)}>
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Frissítés
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Approved minták"
          value={String(overview?.curatedStats?.approvedCount ?? 0)}
          hint={`Pending: ${overview?.curatedStats?.pendingReview ?? 0}`}
        />
        <StatCard
          label="Átlag quality"
          value={(overview?.curatedStats?.avgQuality ?? 0).toFixed(2)}
          hint={`Rejected: ${overview?.curatedStats?.rejectedCount ?? 0}`}
        />
        <StatCard
          label="Aktív reflex"
          value={activeModel?.version ?? 'nincs'}
          hint={activeModel?.avgScore !== undefined ? `Score: ${activeModel.avgScore.toFixed(2)}` : 'Még nincs promóció'}
        />
        <StatCard
          label="Legutóbbi eval"
          value={latestEval?.gateStatus ?? 'nincs'}
          hint={latestEval ? `Δ ${latestEval.regressionDelta.toFixed(3)}` : 'Benchmark még nem futott'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-violet-400" /> Műveletek
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => void runAction('snapshot', '/snapshot', { minQuality: 0.7 })}
            disabled={Boolean(busyAction)}
            variant="outline"
            className="gap-2"
          >
            <Database size={14} /> Snapshot
          </Button>
          <Button
            onClick={() => void runAction('train', '/train', { dryRun: false })}
            disabled={Boolean(busyAction)}
            variant="outline"
            className="gap-2"
          >
            <FlaskConical size={14} /> Nightly tréning
          </Button>
          <Button
            onClick={() => void runAction('evaluate', '/evaluate', latestCandidate ? { modelId: latestCandidate.modelId } : {})}
            disabled={Boolean(busyAction) || !latestCandidate}
            variant="outline"
            className="gap-2"
          >
            <ShieldCheck size={14} /> Eval futtatás
          </Button>
          <Button
            onClick={() => void runAction('cycle', '/cycle', { dryRun: false, promotePassed: false })}
            disabled={Boolean(busyAction)}
            className="gap-2"
          >
            <Rocket size={14} /> Teljes ciklus
          </Button>
          <Button
            onClick={() => void handleRollback()}
            disabled={Boolean(busyAction) || shadowModels.length === 0}
            variant="outline"
            className="gap-2"
          >
            <RotateCcw size={14} /> Rollback
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Curated sample review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {CURATED_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={curatedStateFilter === filter.value ? 'default' : 'outline'}
                onClick={() => setCuratedStateFilter(filter.value)}
                disabled={curatedLoading}
                className="gap-2 capitalize"
                data-testid={`curated-filter-${filter.value}`}
              >
                {filter.label}
              </Button>
            ))}
            <Badge variant="outline" className="text-zinc-300 border-white/10">
              {curatedCount} shown
            </Badge>
          </div>

          {curatedError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {curatedError}
            </div>
          ) : null}

          {curatedLoading && curatedSamples.length === 0 ? (
            <p className="text-sm text-zinc-500">Curated minták betöltése...</p>
          ) : curatedSamples.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nincs megjeleníthető curated minta a kiválasztott szűrővel.
            </p>
          ) : (
            <div className="space-y-3">
              {curatedSamples.map((sample) => (
                <CuratedSampleCard
                  key={sample.id}
                  sample={sample}
                  busy={Boolean(busyAction)}
                  onReview={(sampleId, decision) => void handleCuratedReview(sampleId, decision)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reflex modellek</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeModel ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Aktív modell</div>
                    <div className="text-sm font-semibold text-white">{activeModel.version}</div>
                    <div className="text-xs text-zinc-400">{activeModel.modelName}</div>
                  </div>
                  <Badge variant="outline" className={modelStateTone('active')}>ACTIVE</Badge>
                </div>
              </div>
            ) : null}

            {promotableModels.length === 0 ? (
              <p className="text-sm text-zinc-500">Még nincs promócióra alkalmas candidate/shadow modell.</p>
            ) : (
              promotableModels.map((model) => (
                <div key={model.modelId} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={modelStateTone(model.state)}>
                          {model.state.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-zinc-500 font-mono">{model.provider}</span>
                      </div>
                      <div className="text-sm font-semibold text-white">{model.version}</div>
                      <div className="text-xs text-zinc-400 break-all">{model.modelName}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Routinek: {model.routineCategories.join(', ')}
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-2">
                      <div className="text-xs text-zinc-400">
                        {model.avgScore !== undefined ? `Score ${model.avgScore.toFixed(2)}` : 'Score nincs'}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handlePromote(model.modelId)}
                        disabled={Boolean(busyAction)}
                      >
                        Promote
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legutóbbi futások</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestTraining ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Training run</div>
                    <div className="text-sm font-semibold text-white">{latestTraining.runId}</div>
                  </div>
                  <Badge variant="outline" className={trainingStatusTone(latestTraining.status)}>
                    {latestTraining.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-zinc-400">
                  {latestTraining.modelName} • {latestTraining.sampleCount} minta • quality {latestTraining.avgQuality.toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500">{formatTimestamp(latestTraining.completedAt ?? latestTraining.startedAt)}</div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Még nincs tréning run.</p>
            )}

            {latestEval ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Eval result</div>
                    <div className="text-sm font-semibold text-white">{latestEval.candidateVersion}</div>
                  </div>
                  <Badge variant="outline" className={gateTone(latestEval.gateStatus)}>
                    {latestEval.gateStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-zinc-400">
                  baseline: {latestEval.baselineModel} • score {latestEval.avgScore.toFixed(2)} • Δ {latestEval.regressionDelta.toFixed(3)}
                </div>
                <div className="text-xs text-zinc-500">{formatTimestamp(latestEval.createdAt)}</div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Még nincs eval eredmény.</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

export default LearningLoopPanel;
