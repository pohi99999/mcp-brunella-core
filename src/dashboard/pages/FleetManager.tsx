/**
 * Fleet Manager Main Page
 * Path: src/dashboard/pages/FleetManager.tsx
 */

import React, { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { FleetOverview } from '../components/fleet/FleetOverview.js';
import { MetricsDashboard } from '../components/fleet/MetricsDashboard.js';
import { WorkerDetails } from '../components/fleet/WorkerDetails.js';
import { ScalingConfig } from '../components/fleet/ScalingConfig.js';
import { Cpu, Activity, Users, Settings2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FleetManager: React.FC = () => {
  const [selectedFleetId, setSelectedFleetId] = useState<string>('fleet-default');
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-3xl font-space font-bold text-white tracking-tight flex items-center gap-3">
            <Cpu className="text-primary" size={32} />
            Fleet Manager
            <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-500 align-middle">SYSTEM_READY</div>
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-space">Scale and monitor your Brunella agent infrastructure.</p>
        </div>
      </div>
      
      <Tabs.Root value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <Tabs.List className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'metrics', label: 'Metrics', icon: BarChart3 },
            { id: 'workers', label: 'Workers', icon: Users },
            { id: 'scaling', label: 'Scaling', icon: Settings2 },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all duration-300 rounded-lg",
                selectedTab === tab.id
                  ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.4)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <tab.icon size={14} />
              {tab.label.toUpperCase()}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="min-h-[600px]">
          <Tabs.Content value="overview" className="outline-none">
            <FleetOverview fleetId={selectedFleetId} />
          </Tabs.Content>

          <Tabs.Content value="metrics" className="outline-none">
            <MetricsDashboard fleetId={selectedFleetId} />
          </Tabs.Content>

          <Tabs.Content value="workers" className="outline-none">
            <WorkerDetails fleetId={selectedFleetId} />
          </Tabs.Content>

          <Tabs.Content value="scaling" className="outline-none">
            <ScalingConfig policy={null} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
};

export default FleetManager;
