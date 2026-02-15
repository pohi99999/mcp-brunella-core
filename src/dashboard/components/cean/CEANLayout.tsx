import { useState } from 'react';
import { Tabs, TabsContent } from '@radix-ui/react-tabs';
import { CEANNavBar } from './CEANNavBar.js';
import { DashboardTab } from './tabs/DashboardTab.js';
import { WorkersTab } from './tabs/WorkersTab.js';
import { TasksTab } from './tabs/TasksTab.js';
import { DataTab } from './tabs/DataTab.js';
import { SettingsTab } from './tabs/SettingsTab.js';
import { OrchestratorChat } from './chat/OrchestratorChat.js';
import { CEAN_TABS } from './utils/constants.js';
import { CEANTabId } from './types.js';
import { logInfo } from '../../utils/logger.js';

export const CEANLayout = () => {
  const [activeTab, setActiveTab] = useState<CEANTabId>('dashboard');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as CEANTabId);
    logInfo('CEANLayout', `Switched to tab: ${tab}`);
  };

  return (
    <div className="grid grid-cols-[1fr_350px] h-screen bg-white dark:bg-slate-950">
      {/* Main Content */}
      <div className="flex flex-col overflow-hidden">
        <CEANNavBar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full">
            <TabsContent value={CEAN_TABS.DASHBOARD} className="p-6">
              <DashboardTab />
            </TabsContent>
            <TabsContent value={CEAN_TABS.WORKERS} className="p-6">
              <WorkersTab />
            </TabsContent>
            <TabsContent value={CEAN_TABS.TASKS} className="p-6">
              <TasksTab />
            </TabsContent>
            <TabsContent value={CEAN_TABS.DATA} className="p-6">
              <DataTab />
            </TabsContent>
            <TabsContent value={CEAN_TABS.SETTINGS} className="p-6">
              <SettingsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Fixed Chat Panel */}
      <OrchestratorChat />
    </div>
  );
};
