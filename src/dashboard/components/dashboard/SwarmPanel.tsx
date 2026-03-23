/**
 * SwarmPanel — Dashboard component for Swarm monitoring
 * Track #5: Swarm Intelligence v2 — Phase 4
 */
import React, { useState, useEffect } from 'react';
import { Users, Activity, Vote, AlertCircle, Play, Square, RefreshCw } from 'lucide-react';

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5" /> Swarm Intelligence v2
        </h2>
        <button onClick={() => void fetchData()} className="p-2 rounded hover:bg-gray-700" title="Frissítés">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" /> <span className="text-red-300">{error}</span>
        </div>
      )}

      {/* Colony Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {colonies.map(colony => (
          <div key={colony.swarmId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{colony.name}</h3>
              <span className={`text-sm font-mono ${statusColor(colony.status)}`}>{colony.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
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
          <div className="col-span-2 text-center text-gray-500 py-8">Nincs aktív colony</div>
        )}
      </div>

      {/* Checkpoint Stats */}
      {checkpoints && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Vote className="w-4 h-4" /> Checkpoint Statisztikák
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Összes checkpoint</div>
              <div className="text-lg font-mono">{checkpoints.totalCheckpoints}</div>
            </div>
            <div>
              <div className="text-gray-400">Colony-k</div>
              <div className="text-lg font-mono">{checkpoints.colonies}</div>
            </div>
            <div>
              <div className="text-gray-400">Legutóbbi</div>
              <div className="text-sm font-mono">{checkpoints.latestAt ?? '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
