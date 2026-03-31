/**
 * Gold Protocol G7.5: Cost Summary Component
 *
 * Összesző dashboard az LLM költségekről
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CurrencyDollar, TrendUp, TrendDown } from '@phosphor-icons/react';

interface CostData {
  today: { cost: number; tokens: number };
  week: { cost: number; tokens: number };
  month: { cost: number; tokens: number };
  byModel: Record<string, { cost: number; tokens: number }>;
}

export function CostSummary() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCost();
    const interval = setInterval(fetchCost, 15000); // Auto-refresh 15s
    return () => clearInterval(interval);
  }, []);

  const fetchCost = async () => {
    try {
      const res = await fetch('/api/telemetry/cost');
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch cost:', e);
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">Cost Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <div className="text-zinc-500 text-sm">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          <CurrencyDollar className="w-5 h-5" />
          LLM Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 lg:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Today */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Today</div>
            <div className="text-2xl font-semibold font-mono text-cyan-300">${data.today.cost.toFixed(4)}</div>
            <div className="text-xs text-zinc-500">{data.today.tokens.toLocaleString()} tokens</div>
          </div>

          {/* Week */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">This Week</div>
            <div className="text-2xl font-semibold font-mono text-emerald-300">${data.week.cost.toFixed(4)}</div>
            <div className="text-xs text-zinc-500">{data.week.tokens.toLocaleString()} tokens</div>
          </div>

          {/* Month */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">This Month</div>
            <div className="text-2xl font-semibold font-mono text-violet-300">${data.month.cost.toFixed(4)}</div>
            <div className="text-xs text-zinc-500">{data.month.tokens.toLocaleString()} tokens</div>
          </div>
        </div>

        {/* By Model Breakdown */}
        <div>
          <h4 className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400 mb-3">Cost by Model</h4>
          <div className="space-y-2">
            {Object.entries(data.byModel).map(([model, stats]) => (
              <div key={model} className="flex items-center justify-between p-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] transition-all duration-200 hover:border-white/10">
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/15 text-cyan-100 border border-cyan-400/20">{model}</Badge>
                  <span className="text-xs text-zinc-500">{stats.tokens.toLocaleString()} tokens</span>
                </div>
                <div className="font-semibold text-sm text-zinc-100">${stats.cost.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
