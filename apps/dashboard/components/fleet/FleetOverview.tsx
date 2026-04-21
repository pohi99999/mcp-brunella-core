/**
 * Fleet Overview Component
 * Path: src/dashboard/components/fleet/FleetOverview.tsx
 * 
 * Displays list of fleets with health status and quick actions
 * Integrated with useFleetList() and useScaling() hooks
 */

import React, { useState } from 'react';
import { useFleetList } from './hooks/useFleetList.js';
import { useScaling } from './hooks/useScaling.js';
import { Server, Zap, AlertTriangle, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FleetOverviewProps {
  fleetId?: string;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({ fleetId }) => {
  const { fleets, healthData, loading, error } = useFleetList();
  const { executeScale } = useScaling(fleetId);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);

  const getHealthColor = (errorRate: number) => {
    if (errorRate < 1) return 'bg-emerald-500';
    if (errorRate < 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (error) {
    return (
      <div className="glass-panel border-red-500/20 bg-red-500/5 rounded-2xl p-8 text-center text-red-400">
        <AlertTriangle className="mx-auto mb-4" size={32} />
        <p className="font-mono text-sm uppercase">Critical Link Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fleets.map((fleet) => {
          const health = healthData[fleet.id];
          const isSelected = selectedFleet === fleet.id;
          const errorRate = health?.avg_error_rate || 0;

          return (
            <div
              key={fleet.id}
              className={cn(
                "glass-card border-white/5 p-6 cursor-pointer relative group overflow-hidden",
                isSelected && "border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
              )}
              onClick={() => setSelectedFleet(fleet.id)}
            >
              {/* Animated background glow */}
              <div className="absolute -right-16 -top-16 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500" />

              {/* Header */}
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Server size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight uppercase">{fleet.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                      <Globe size={10} />
                      {fleet.region.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest",
                  fleet.enabled 
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                    : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                )}>
                  {fleet.enabled ? 'Online' : 'Offline'}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Workers</p>
                  <p className="text-2xl font-space font-bold text-white leading-none">
                    {health?.worker_count || 0}
                    <span className="text-[10px] text-emerald-500 ml-1.5">+{health?.active_workers || 0}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Error Rate</p>
                  <p className={cn(
                    "text-2xl font-space font-bold leading-none",
                    errorRate < 1 ? "text-emerald-500" : errorRate < 5 ? "text-amber-500" : "text-red-500"
                  )}>
                    {errorRate.toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Latency</p>
                  <p className="text-lg font-space font-bold text-zinc-300 leading-none">
                    {health?.avg_latency_p95?.toFixed(0) || 0}ms
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Load</p>
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-primary" />
                    <span className="text-lg font-space font-bold text-zinc-300 leading-none">Balanced</span>
                  </div>
                </div>
              </div>

              {/* Health Bar */}
              <div className="mb-6 relative z-10 space-y-2">
                <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase">
                  <span>Cluster Health</span>
                  <span className={errorRate < 1 ? "text-emerald-500" : "text-amber-500"}>Optimal</span>
                </div>
                <Progress
                  value={100 - errorRate}
                  className="h-1 bg-white/5"
                />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 relative z-10 pt-4 border-t border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-[10px] font-bold border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    void executeScale(fleet.id, 'up');
                  }}
                  disabled={loading || !fleet.enabled}
                >
                  <ArrowUpRight size={12} className="mr-1.5" />
                  SCALE_UP
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-[10px] font-bold border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    void executeScale(fleet.id, 'down');
                  }}
                  disabled={loading || !fleet.enabled}
                >
                  <ArrowDownRight size={12} className="mr-1.5" />
                  SCALE_DOWN
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {fleets.length === 0 && !loading && (
        <div className="glass-panel border-white/5 bg-white/5 rounded-2xl p-12 text-center text-zinc-500">
          <Server className="mx-auto mb-4 opacity-20" size={48} />
          <p className="font-space">No clusters detected. Initialize your first fleet to begin monitoring.</p>
        </div>
      )}
    </div>
  );
};
