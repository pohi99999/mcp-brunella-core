/**
 * Fleet Manager Main Page
 * Path: src/dashboard/pages/FleetManager.tsx
 */

import React, { useState } from 'react';
import { Tabs } from '@radix-ui/themes';
import { FleetOverview } from '../components/fleet/FleetOverview.js';
import { MetricsDashboard } from '../components/fleet/MetricsDashboard.js';
import { WorkerDetails } from '../components/fleet/WorkerDetails.js';
import { ScalingConfig } from '../components/fleet/ScalingConfig.js';

export const FleetManager: React.FC = () => {
  const [selectedFleetId, setSelectedFleetId] = useState<string>('fleet-default');
  const [selectedTab, setSelectedTab] = useState<string>('overview');

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">🚀 Fleet Manager</h1>
      
      <Tabs.Root value={selectedTab} onValueChange={setSelectedTab}>
        <Tabs.List>
          <Tabs.Trigger value="overview">📊 Overview</Tabs.Trigger>
          <Tabs.Trigger value="metrics">📈 Metrics</Tabs.Trigger>
          <Tabs.Trigger value="workers">👷 Workers</Tabs.Trigger>
          <Tabs.Trigger value="scaling">⚙️ Scaling Policy</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview">
          <FleetOverview fleetId={selectedFleetId} />
        </Tabs.Content>

        <Tabs.Content value="metrics">
          <MetricsDashboard fleetId={selectedFleetId} />
        </Tabs.Content>

        <Tabs.Content value="workers">
          <WorkerDetails fleetId={selectedFleetId} />
        </Tabs.Content>

        <Tabs.Content value="scaling">
          <ScalingConfig policy={null} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default FleetManager;
