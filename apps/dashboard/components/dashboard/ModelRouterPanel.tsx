/**
 * Gold Protocol G7.3 UI: Model Router Panel
 *
 * Model routing decisions és profile viewer
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Broadcast, ChartBar } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ModelProfile {
  model: string;
  specialties: string[];
  costPerToken: number;
  fallback?: string;
}

interface RoutingDecision {
  timestamp: string;
  task: string;
  category: string;
  selectedModel: string;
  reason: string;
}

interface RouterStats {
  byModel: Record<string, number>;
  byCategory: Record<string, Record<string, number>>;
}

export function ModelRouterPanel() {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000); // Auto-refresh 8s
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [modelsRes, decisionsRes, statsRes] = await Promise.all([
        fetch('/api/router/models'),
        fetch('/api/router/decisions'),
        fetch('/api/router/stats'),
      ]);
      const modelsData = await modelsRes.json();
      const decisionsData = await decisionsRes.json();
      const statsData = await statsRes.json();
      setModels(modelsData.models || []);
      setDecisions(decisionsData.decisions || []);
      setStats(statsData);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch router data:', e);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card border-white/10">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Model Router</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-zinc-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Model Profiles */}
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
            <Broadcast className="w-5 h-5 text-cyan-300" />
            Model Profiles ({models.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <div key={model.model} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="font-semibold text-zinc-100 mb-2">{model.model}</div>
                <div className="text-xs text-zinc-500 mb-2">
                  Cost: <span className="font-mono text-cyan-200">${model.costPerToken}</span>/token
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {model.specialties.map((spec) => (
                    <Badge key={spec} className="bg-cyan-500/15 text-cyan-100 border border-cyan-400/20 text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
                {model.fallback && (
                  <div className="text-xs text-zinc-500">Fallback: {model.fallback}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Decisions */}
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
            <ChartBar className="w-5 h-5 text-violet-300" />
            Recent Routing Decisions ({decisions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {decisions.map((dec, idx) => (
              <div key={idx} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-400/10 text-emerald-100 border border-emerald-400/20">{dec.selectedModel}</Badge>
                    <Badge variant="outline" className="border-white/10 text-zinc-300">{dec.category}</Badge>
                  </div>
                  <span className="text-xs text-zinc-500">{new Date(dec.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-zinc-500 font-mono mb-1">{dec.task.slice(0, 100)}...</div>
                <div className="text-xs text-cyan-200">{dec.reason}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Router Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-4 lg:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By Model */}
              <div>
                <h4 className="text-[10px] font-mono font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-3">Usage by Model</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byModel).map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                      <span className="text-sm text-zinc-100">{model}</span>
                      <Badge className="bg-cyan-500/15 text-cyan-100 border border-cyan-400/20">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Category */}
              <div>
                <h4 className="text-[10px] font-mono font-semibold uppercase tracking-[0.22em] text-zinc-500 mb-3">Usage by Category</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byCategory).map(([category, modelCounts]) => (
                    <div key={category} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="text-sm font-semibold text-zinc-100 mb-1">{category}</div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(modelCounts).map(([model, count]) => (
                          <Badge key={model} variant="outline" className="text-xs border-white/10 text-zinc-300">
                            {model}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
