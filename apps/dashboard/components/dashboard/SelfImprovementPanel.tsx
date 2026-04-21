import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock,
  Gauge,
  RefreshCcw,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  approveSelfModificationProposal,
  getSelfModificationOverview,
  getSelfModificationProposals,
  rejectSelfModificationProposal,
  runSelfModification,
  runWeeklySelfModificationCycle,
  type SelfModificationOverview,
  type SelfModificationProposal,
} from '@/lib/selfModificationApi';

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function statusTone(status: SelfModificationProposal['status']): string {
  if (status === 'applied') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (status === 'pending_review' || status === 'approved') return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  if (status === 'failed' || status === 'rejected') return 'text-red-300 border-red-500/20 bg-red-500/10';
  return 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10';
}

function StatCard({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-400">{hint}</div> : null}
    </div>
  );
}

export function SelfImprovementPanel() {
  const [overview, setOverview] = useState<SelfModificationOverview | null>(null);
  const [proposals, setProposals] = useState<SelfModificationProposal[]>([]);
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, proposalData] = await Promise.all([
        getSelfModificationOverview(),
        getSelfModificationProposals(undefined, 10),
      ]);
      setOverview(overviewData);
      setProposals(proposalData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weakAgents = useMemo(() => overview?.weakAgents.slice(0, 5) ?? [], [overview]);

  const handleRun = useCallback(async () => {
    if (!agentName.trim()) {
      setError('Adj meg egy DynamicAgent nevet.');
      return;
    }

    setActionBusy('run');
    setError(null);
    try {
      await runSelfModification(agentName.trim(), false);
      setAgentName('');
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setActionBusy(null);
    }
  }, [agentName, load]);

  const handleCycle = useCallback(async () => {
    setActionBusy('cycle');
    setError(null);
    try {
      await runWeeklySelfModificationCycle();
      await load();
    } catch (cycleError) {
      setError(cycleError instanceof Error ? cycleError.message : String(cycleError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  const handleApprove = useCallback(async (proposalId: string) => {
    setActionBusy(`approve:${proposalId}`);
    setError(null);
    try {
      await approveSelfModificationProposal(proposalId);
      await load();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : String(approveError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  const handleReject = useCallback(async (proposalId: string) => {
    setActionBusy(`reject:${proposalId}`);
    setError(null);
    try {
      await rejectSelfModificationProposal(proposalId);
      await load();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : String(rejectError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  return (
    <div className="space-y-6" data-testid="self-improvement-panel">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <Brain size={18} className="text-cyan-300" />
              Self-Improvement Control
            </CardTitle>
            <p className="text-sm text-zinc-400">
              DynamicAgent proposal queue, weekly self-mod cycle, and human review flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading || actionBusy !== null}
            >
              <RefreshCcw size={14} />
              Frissítés
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              onClick={() => void handleCycle()}
              disabled={loading || actionBusy !== null}
            >
              <Clock size={14} />
              Heti ciklus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard
              label="Runs / 7d"
              value={String(overview?.summary.totalRuns ?? 0)}
              hint="Összes mért agent futás"
              testId="selfmod-stat-runs"
            />
            <StatCard
              label="Agents"
              value={String(overview?.summary.agentCount ?? 0)}
              hint="Agentek a metrikaablakban"
              testId="selfmod-stat-agents"
            />
            <StatCard
              label="Success"
              value={`${((overview?.summary.overallSuccessRate ?? 0) * 100).toFixed(1)}%`}
              hint="Összesített sikerarány"
              testId="selfmod-stat-success"
            />
            <StatCard
              label="Weak agents"
              value={String(overview?.weakAgents.length ?? 0)}
              hint="Threshold alatti DynamicAgent jelöltek"
              testId="selfmod-stat-weak"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Manual proposal</div>
              <Input
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
                placeholder="DynamicAgent name, pl. MarketingDirector"
                data-testid="selfmod-agent-input"
              />
            </div>
            <Button
              className="gap-2"
              onClick={() => void handleRun()}
              disabled={loading || actionBusy !== null}
              data-testid="selfmod-run-button"
            >
              <Wrench size={14} />
              Proposal futtatása
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200" data-testid="selfmod-error">
              {error}
            </div>
          ) : null}

          {overview?.activeProposal ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-200">
                <ShieldAlert size={14} />
                Aktív proposal
              </div>
              <div className="mt-2 text-sm text-zinc-100">
                <span className="font-semibold">{overview.activeProposal.agentName}</span> · {overview.activeProposal.id}
              </div>
              <div className="mt-1 text-xs text-zinc-300">
                {overview.activeProposal.improvement.improvementPercent.toFixed(1)} improvement • {overview.activeProposal.status}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Gauge size={16} className="text-cyan-300" />
                Weak-agent shortlist
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-400">Betöltés...</div>
                ) : weakAgents.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-400">Nincs threshold alatti agent.</div>
                ) : weakAgents.map((agent) => (
                  <div key={agent.agentName} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4" data-testid={`selfmod-weak-${agent.agentName}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{agent.agentName}</div>
                        <div className="text-xs text-zinc-400">
                          Success {(agent.successRate * 100).toFixed(1)}% • Avg {Math.round(agent.avgDurationMs)} ms • Failures {agent.failureCount}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-amber-300 border-amber-500/20 bg-amber-500/10">
                        {agent.totalRuns} runs
                      </Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                      {agent.weaknessReasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock size={16} className="text-cyan-300" />
                Proposal queue
              </div>
              <div className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-400">Betöltés...</div>
                ) : proposals.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-400">Nincs self-mod proposal.</div>
                ) : proposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 space-y-3" data-testid={`selfmod-proposal-${proposal.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{proposal.agentName}</span>
                          <Badge variant="outline" className={statusTone(proposal.status)}>
                            {proposal.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-zinc-400">{proposal.id}</div>
                      </div>
                      <div className="text-right text-xs text-zinc-400">
                        <div>{proposal.improvement.improvementPercent.toFixed(1)} improvement</div>
                        <div>{formatTimestamp(proposal.updatedAt)}</div>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-300">{proposal.weaknessSummary}</p>
                    {proposal.failureReason ? (
                      <div className="text-xs text-red-300">{proposal.failureReason}</div>
                    ) : null}
                    {proposal.status === 'pending_review' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                          onClick={() => void handleApprove(proposal.id)}
                          disabled={actionBusy !== null}
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          onClick={() => void handleReject(proposal.id)}
                          disabled={actionBusy !== null}
                        >
                          <XCircle size={14} />
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
