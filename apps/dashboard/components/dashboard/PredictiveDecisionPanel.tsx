import React, { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCcw, RotateCcw, Sparkles } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getDecisionHistory,
  getDecisionStats,
  rollbackDecision,
  triggerDecision,
} from '@/lib/predictiveDecisionApi';
import type { DecisionResult, DecisionStats } from '../../../core/decisionTypes.js';

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('hu-HU');
}

function badgeVariant(outcome: DecisionResult['outcome']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (outcome === 'executed') return 'default';
  if (outcome === 'failed') return 'destructive';
  if (outcome === 'rolled_back') return 'outline';
  return 'secondary';
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export function PredictiveDecisionPanel() {
  const [history, setHistory] = useState<DecisionResult[]>([]);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, statsData] = await Promise.all([
        getDecisionHistory(8),
        getDecisionStats(30),
      ]);
      setHistory(historyData);
      setStats(statsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTrigger = useCallback(async () => {
    setBusyKey('trigger');
    setError(null);
    try {
      await triggerDecision('dashboard');
      await load();
    } catch (triggerError) {
      setError(triggerError instanceof Error ? triggerError.message : String(triggerError));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  const handleRollback = useCallback(async (decisionId: string) => {
    setBusyKey(`rollback:${decisionId}`);
    setError(null);
    try {
      await rollbackDecision(decisionId);
      await load();
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  return (
    <div className="space-y-6" data-testid="predictive-decision-panel">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <Brain size={18} className="text-cyan-300" />
              Predictive Decision
            </CardTitle>
            <p className="text-sm text-zinc-400">
              Monte Carlo alapú döntési futások valós alert, signal és review queue inputokból.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading || busyKey !== null}
            >
              <RefreshCcw size={14} />
              Frissítés
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={loading || busyKey !== null}
              onClick={() => void handleTrigger()}
              data-testid="predictive-trigger-button"
            >
              <Sparkles size={14} />
              Döntési ciklus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Total" value={String(stats?.totalDecisions ?? 0)} />
            <StatCard label="Executed" value={String(stats?.actionsExecuted ?? 0)} />
            <StatCard label="No Action" value={String(stats?.noActionDecisions ?? 0)} />
            <StatCard label="Avg Score" value={(stats?.averageSelectedScore ?? 0).toFixed(3)} />
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Recent runs</div>
              <div className="text-xs text-zinc-500">
                Success rate: {((stats?.successRate ?? 0) * 100).toFixed(1)}%
              </div>
            </div>

            {history.length === 0 ? (
              <div className="text-sm text-zinc-400">Még nincs predictive decision futás.</div>
            ) : (
              <div className="space-y-3">
                {history.map((decision) => (
                  <div
                    key={decision.id}
                    className="rounded-lg border border-white/[0.06] bg-zinc-950/40 p-3"
                    data-testid={`predictive-decision-${decision.id}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVariant(decision.outcome)}>{decision.outcome}</Badge>
                          <span className="font-medium text-white">{decision.selectedScenario?.action.type ?? 'no-action'}</span>
                        </div>
                        <div className="text-xs text-zinc-400">
                          {decision.triggeredBy} • {formatTimestamp(decision.createdAt)}
                        </div>
                      </div>
                      {decision.rollbackCapability ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={busyKey !== null}
                          onClick={() => void handleRollback(decision.id)}
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-3 text-xs text-zinc-300 md:grid-cols-4">
                      <div>
                        <div className="text-zinc-500">Source</div>
                        <div>{decision.selectedScenario ? `${decision.selectedScenario.candidate.sourceType}:${decision.selectedScenario.candidate.sourceId}` : '—'}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Score</div>
                        <div>{decision.selectedScenario ? decision.selectedScenario.totalScore.toFixed(3) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Scenarios</div>
                        <div>{decision.scenarios.length}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Alerts / signals</div>
                        <div>{decision.metadata.activeAlerts} / {decision.metadata.signalCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
