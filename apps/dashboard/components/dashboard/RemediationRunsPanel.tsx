import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitBranch, RefreshCcw, ShieldCheck, Wrench } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '@/context/SocketContext';
import {
  getRemediationRuns,
  getRemediationRunsSummary,
  type RemediationRunRecord,
  type RemediationRunStatus,
  type RemediationRunsSummary,
} from '@/lib/apiService';
import { cn } from '@/lib/utils';

type RemediationFilter = 'all' | RemediationRunStatus;

const STATUS_OPTIONS: Array<{ id: RemediationFilter; label: string }> = [
  { id: 'all', label: 'Mind' },
  { id: 'queued', label: 'Sorban' },
  { id: 'running_fixer', label: 'Fix fut' },
  { id: 'verifying', label: 'Verifikál' },
  { id: 'awaiting_final_approval', label: 'Approval' },
  { id: 'approved', label: 'Jóváhagyott' },
  { id: 'failed', label: 'Hibás' },
];

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) {
    return '—';
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toLocaleString('hu-HU');
}

function countFor(summary: RemediationRunsSummary | null, ...statuses: RemediationRunStatus[]): number {
  return statuses.reduce((total, status) => total + (summary?.counts?.[status] ?? 0), 0);
}

function statusLabel(status: RemediationRunStatus): string {
  switch (status) {
    case 'queued':
      return 'QUEUE';
    case 'analyzing':
      return 'ANALYZE';
    case 'running_fixer':
      return 'FIXER';
    case 'verifying':
      return 'VERIFY';
    case 'awaiting_final_approval':
      return 'APPROVAL';
    case 'approved':
      return 'OK';
    case 'rejected':
      return 'REJECT';
    case 'failed':
      return 'FAIL';
  }
}

function statusTone(status: RemediationRunStatus): string {
  switch (status) {
    case 'queued':
    case 'analyzing':
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300';
    case 'running_fixer':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-300';
    case 'verifying':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-300';
    case 'awaiting_final_approval':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'approved':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'rejected':
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-300';
  }
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-center">
      <p className="text-[8px] uppercase font-mono text-zinc-500">{label}</p>
      <p className={`text-sm font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function RemediationRunsPanel() {
  const { socket } = useSocket();
  const [summary, setSummary] = useState<RemediationRunsSummary | null>(null);
  const [runs, setRuns] = useState<RemediationRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RemediationFilter>('all');

  const refreshData = useCallback(async (statusFilter: RemediationFilter) => {
    setLoading(true);
    try {
      const [summaryResponse, runsResponse] = await Promise.all([
        getRemediationRunsSummary(),
        getRemediationRuns(12, statusFilter === 'all' ? undefined : statusFilter),
      ]);
      setSummary(summaryResponse);
      setRuns(runsResponse);
      setError(null);
    } catch (refreshError: unknown) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData(filter);
    const interval = window.setInterval(() => {
      void refreshData(filter);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [filter, refreshData]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const refresh = () => {
      void refreshData(filter);
    };

    const refreshOnSignal = (signal: unknown) => {
      if (typeof signal !== 'object' || signal === null) {
        return;
      }
      const eventType =
        typeof (signal as { eventType?: unknown }).eventType === 'string'
          ? (signal as { eventType: string }).eventType
          : undefined;

      if (!eventType || eventType.startsWith('github.workflow_run')) {
        void refreshData(filter);
      }
    };

    socket.on('phoenix:approval_requested', refresh);
    socket.on('phoenix:approval_resolved', refresh);
    socket.on('phoenix:event_fabric_signal', refreshOnSignal);

    return () => {
      socket.off('phoenix:approval_requested', refresh);
      socket.off('phoenix:approval_resolved', refresh);
      socket.off('phoenix:event_fabric_signal', refreshOnSignal);
    };
  }, [filter, refreshData, socket]);

  const latestUpdate = useMemo(() => formatTimestamp(summary?.latestUpdatedAt), [summary?.latestUpdatedAt]);

  return (
    <Card className="glass-card border-white/10 bg-white/[0.03] backdrop-blur-xl h-full flex flex-col overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="p-4 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center justify-between text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          <span className="flex items-center gap-2">
            <Wrench size={16} className="text-cyan-300" />
            Remediation Runs
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={error ? 'destructive' : loading ? 'secondary' : 'default'}>
              {error ? 'HIBA' : loading ? 'FRISSÍTÉS' : summary?.active ? 'ÉLŐ' : 'STOP'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
              onClick={() => void refreshData(filter)}
            >
              <RefreshCcw size={12} className="mr-1" />
              Frissítés
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col gap-4">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <StatTile label="Queue" value={countFor(summary, 'queued', 'analyzing')} tone="text-yellow-400" />
          <StatTile label="Fixer" value={countFor(summary, 'running_fixer')} tone="text-blue-400" />
          <StatTile label="Verify" value={countFor(summary, 'verifying')} tone="text-violet-400" />
          <StatTile label="Approval" value={summary?.pendingFinalApproval ?? 0} tone="text-amber-300" />
          <StatTile label="OK" value={countFor(summary, 'approved')} tone="text-emerald-400" />
          <StatTile label="Fail" value={countFor(summary, 'failed', 'rejected')} tone="text-red-400" />
        </div>

        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-mono">
              <ShieldCheck size={13} className="text-emerald-300" />
              Operátori nézet
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">
              Utolsó frissítés: {latestUpdate}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                size="sm"
                className={cn(
                  'h-7 rounded-full border-white/10 text-xs',
                  filter === option.id
                    ? 'bg-white/[0.08] text-zinc-100'
                    : 'bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]',
                )}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3 flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400 font-mono">Legutóbbi remediation futások</p>
            <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-400">
              {runs.length} futás
            </Badge>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {runs.length === 0 ? (
              <p className="text-sm text-zinc-500">Még nincs remediation futás ehhez a szűrőhöz.</p>
            ) : (
              runs.map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={statusTone(run.status)}>
                          {statusLabel(run.status)}
                        </Badge>
                        <Badge variant="outline" className="border-white/[0.08] bg-white/[0.02] text-zinc-300">
                          {run.repositoryName}
                        </Badge>
                        {run.finalApproval ? (
                          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-200">
                            approval:{run.finalApproval.status}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {run.workflowName ?? 'GitHub workflow failure'} {run.workflowRunId ? `#${run.workflowRunId}` : ''}
                      </p>
                      <p className="text-xs text-zinc-400 line-clamp-2 whitespace-pre-line">
                        {run.analysis?.summary ?? run.failureReason ?? 'Még nincs elemzési összegzés.'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-[10px] font-mono text-zinc-500">{formatTimestamp(run.updatedAt)}</p>
                      {run.branch ? (
                        <p className="text-[10px] font-mono text-cyan-300 flex items-center gap-1 justify-end">
                          <GitBranch size={11} /> {run.branch}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {run.analysis?.affectedFiles?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {run.analysis.affectedFiles.slice(0, 5).map((file) => (
                        <Badge
                          key={`${run.id}-${file}`}
                          variant="secondary"
                          className="text-[10px] bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                        >
                          {file}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-white/[0.04] bg-black/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono uppercase tracking-[0.22em] text-zinc-500">Fixer</span>
                        <Badge variant="outline" className="border-white/[0.08] text-zinc-300">
                          {run.fixer?.agentName ?? 'n/a'}
                        </Badge>
                      </div>
                      <p className="text-zinc-300">{run.fixer?.status ?? 'pending'}</p>
                      {run.fixer?.resultSummary ? (
                        <p className="text-zinc-400 line-clamp-3 whitespace-pre-line">{run.fixer.resultSummary}</p>
                      ) : (
                        <p className="text-zinc-500">A fixer futás még nem adott összegzést.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/[0.04] bg-black/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono uppercase tracking-[0.22em] text-zinc-500">Verification</span>
                        <span className="text-zinc-500">{run.verification.length} lépés</span>
                      </div>
                      {run.verification.length === 0 ? (
                        <p className="text-zinc-500">A verifikáció még nem indult el.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {run.verification.map((step) => (
                            <div key={`${run.id}-${step.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                              <span className="text-zinc-300">{step.name}</span>
                              <div className="flex items-center gap-2 text-[10px] font-mono uppercase">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'border-white/[0.08]',
                                    step.status === 'passed' && 'text-emerald-300',
                                    step.status === 'failed' && 'text-red-300',
                                    step.status === 'pending' && 'text-yellow-300',
                                  )}
                                >
                                  {step.status}
                                </Badge>
                                <span className="text-zinc-500">{step.exitCode ?? '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {run.failureReason ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-200 flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{run.failureReason}</span>
                    </div>
                  ) : run.status === 'approved' ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                      <span>Remediation lezárva és jóváhagyva.</span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default RemediationRunsPanel;
