import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Rocket, Target, GitBranchPlus, ShieldAlert, Cpu, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAutonomousInfraState,
  runAutonomousInfraCycle,
  planAutonomousReplica,
  createAutonomousGoal,
  type AutonomousInfraState,
} from '@/lib/apiService';

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-b-0">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-100">{value}</span>
    </div>
  );
}

export function AutonomousInfraPanel() {
  const [data, setData] = useState<AutonomousInfraState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const state = await getAutonomousInfraState();
      setData(state);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCycle = async () => {
    setBusyAction('cycle');
    try {
      await runAutonomousInfraCycle('dashboard-manual-cycle');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusyAction(null);
    }
  };

  const handleReplica = async () => {
    if (!data) return;
    const sourceNode = data.replication.nodes.find(node => node.status === 'active');
    if (!sourceNode) {
      setError('Nincs aktív source node a replika tervhez.');
      return;
    }

    setBusyAction('replica');
    try {
      await planAutonomousReplica(sourceNode.nodeId, sourceNode.region === 'eu-central' ? 'us-east' : 'eu-central', 'Dashboard replication probe');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusyAction(null);
    }
  };

  const handleGoal = async () => {
    setBusyAction('goal');
    try {
      await createAutonomousGoal({
        title: 'Dashboard-triggered resilience pulse',
        category: 'resilience',
        metric: 'resilience-score',
        direction: 'increase',
        targetValue: 0.85,
        currentValue: data?.optimizer.forecast.resilienceScore ?? 0.65,
        priority: 72,
        rationale: 'Manual resilience reinforcement triggered from Mission Control.',
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setBusyAction(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Autonomous Infrastructure</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Glass Box szimuláció: self-replication, InfraAI, Goal Engine és HyperKernel vezérlés.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading || !!busyAction}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Frissítés
          </Button>
          <Button size="sm" onClick={handleCycle} disabled={loading || !!busyAction}>
            <Rocket size={14} />
            Hyper Cycle
          </Button>
          <Button variant="outline" size="sm" onClick={handleReplica} disabled={loading || !!busyAction}>
            <GitBranchPlus size={14} />
            Replika Terv
          </Button>
          <Button variant="outline" size="sm" onClick={handleGoal} disabled={loading || !!busyAction}>
            <Target size={14} />
            Új Cél
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-sm text-zinc-500">{loading ? 'Autonomous state betöltése...' : 'Nincs elérhető adat.'}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-zinc-100 text-sm">
                  <Rocket size={16} className="text-cyan-400" />
                  HyperKernel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <StatRow label="Snapshot health" value={data.hyperKernel.latestCycle?.snapshotHealth ?? 'n/a'} />
                <StatRow label="Kernel directives" value={data.hyperKernel.stats.kernel.directives} />
                <StatRow label="Optimizer pending" value={data.hyperKernel.stats.optimizer.pending} />
                <StatRow label="Aktív célok" value={data.hyperKernel.stats.goals.active} />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-zinc-100 text-sm">
                  <GitBranchPlus size={16} className="text-emerald-400" />
                  Self-Replication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <StatRow label="Aktív node-ok" value={data.replication.analysis.activeNodes} />
                <StatRow label="Bootstrap alatt" value={data.replication.analysis.bootstrappingNodes} />
                <StatRow label="Pending planok" value={data.replication.analysis.plansPendingApproval} />
                <StatRow label="Régiók" value={Object.keys(data.replication.analysis.replicasByRegion).join(', ')} />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-zinc-100 text-sm">
                  <Cpu size={16} className="text-amber-400" />
                  InfraAI + Optimizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <StatRow label="Open incidents" value={data.infra.incidents.filter(item => item.status !== 'resolved').length} />
                <StatRow label="Ajánlások" value={data.infra.recommendations.length} />
                <StatRow label="Latency forecast" value={`${data.optimizer.forecast.latencyMs.toFixed(0)} ms`} />
                <StatRow label="Trend" value={data.optimizer.forecast.trend} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-zinc-100 text-sm">
                  <BrainCircuit size={16} className="text-violet-400" />
                  Self-Model & Goal Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Self-Model</div>
                  <StatRow label="Health" value={data.selfModel.state.health} />
                  <StatRow label="Coherence" value={data.selfModel.state.coherence.toFixed(2)} />
                  <StatRow label="Blind spots" value={data.selfModel.state.blindSpots.length} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Célok</div>
                  {data.goals.items.slice(0, 3).map(goal => (
                    <div key={goal.goalId} className="rounded-md border border-white/5 bg-black/20 px-3 py-2 mb-2 last:mb-0">
                      <div className="text-sm text-zinc-100 font-medium">{goal.title}</div>
                      <div className="text-xs text-zinc-400 mt-1">{goal.category} · {goal.status} · priority {goal.priority}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-zinc-100 text-sm">
                  <ShieldAlert size={16} className="text-rose-400" />
                  Legutóbbi események
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Replika tervek</div>
                  {data.replication.plans.slice(-3).reverse().map(plan => (
                    <div key={plan.planId} className="text-sm text-zinc-300 py-1 border-b border-white/5 last:border-b-0">
                      <div className="font-mono text-xs text-cyan-300">{plan.planId}</div>
                      <div>{plan.sourceNodeId} → {plan.targetRegion} · {plan.status} · risk {plan.risk}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Infra ajánlások</div>
                  {data.infra.recommendations.slice(0, 4).map(item => (
                    <div key={item.recommendationId} className="text-sm text-zinc-300 py-1 border-b border-white/5 last:border-b-0">
                      <div className="font-medium">{item.type} → {item.targetResourceId}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
