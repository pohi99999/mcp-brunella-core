/**
 * SwarmPanel — Dashboard component for Swarm monitoring
 * Track #5: Swarm Intelligence v2 — Phase 4
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Users, Activity, Vote, AlertCircle, Play, Square, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ColonySummary {
  swarmId: string;
  name: string;
  status: string;
  agentCount: number;
  leaderId: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  avgDurationMs: number;
}

interface CheckpointInfo {
  totalCheckpoints: number;
  colonies: number;
  latestAt: string | null;
}

export default function SwarmPanel() {
  const { t } = useTranslation();
  const [colonies, setColonies] = useState<ColonySummary[]>([]);        
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [colRes, cpRes] = await Promise.all([
        fetch('/api/v1/swarm/status'),
        fetch('/api/v1/swarm/checkpoints/stats'),
      ]);
      if (colRes.ok) setColonies(await colRes.json());
      if (cpRes.ok) setCheckpoints(await cpRes.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');        
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'forming': return 'text-yellow-400';
      case 'paused': return 'text-orange-400';
      case 'degraded': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Swarm telemetry</p>
          <h2 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-300" /> {t("swarm.title")}
          </h2>
        </div>
        <button onClick={() => void fetchData()} className="rounded-full border border-white/10 bg-white/[0.02] p-2 text-zinc-100 hover:bg-white/[0.05]" title={t("common.refresh", "Frissítés")}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
          <AlertCircle className="w-4 h-4 text-red-300" /> <span>{error}</span>
        </div>
      )}

      {/* Colony Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {colonies.map(colony => (
          <div key={colony.swarmId} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-2 flex items-center justify-between">    
              <h3 className="font-semibold text-zinc-100">{colony.name}</h3>
              <Badge className={cn("border text-[10px] uppercase tracking-[0.16em]", statusColor(colony.status).replace('text-', 'bg-').replace('400', '400/10'))}>
                {colony.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-zinc-400">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {colony.agentCount} agent 
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" /> {colony.tasksCompleted}✓ / {colony.tasksFailed}✗
              </div>
              <div>Leader: {colony.leaderId ?? '—'}</div>
              <div>Avg: {colony.avgDurationMs.toFixed(0)}ms</div>       
            </div>
          </div>
        ))}
        {colonies.length === 0 && !loading && (
          <div className="col-span-2 text-center text-gray-500 py-8">{t("swarm.no_colonies", "Nincs aktív kolónia")}</div>
        )}
      </div>

      {/* Checkpoint Stats */}
      {checkpoints && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-zinc-100">
            <Vote className="w-4 h-4 text-violet-300" /> {t("swarm.checkpoint_stats", "Checkpoint Statisztikák")}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-zinc-500">{t("swarm.total_checkpoints", "Összes checkpoint")}</div>   
              <div className="font-mono text-lg text-zinc-100">{checkpoints.totalCheckpoints}</div>
            </div>
            <div>
              <div className="text-zinc-500">{t("swarm.active_colonies", "Kolóniák")}</div>
              <div className="font-mono text-lg text-zinc-100">{checkpoints.colonies}</div>
            </div>
            <div>
              <div className="text-zinc-500">{t("swarm.latest", "Legutóbbi")}</div>
              <div className="font-mono text-sm text-zinc-100">{checkpoints.latestAt ?? '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
