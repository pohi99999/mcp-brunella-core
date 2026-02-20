import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { LayoutModeId, LayoutMode, DashboardLayoutConfig } from './types';

// Define default layout configurations
const defaultLayoutConfig: DashboardLayoutConfig = {
  defaultMode: 'default-dashboard',
  modes: [
    {
      id: 'default-dashboard',
      name: 'Default Dashboard',
      description: 'A standard multi-widget dashboard view.',
      gridTemplateAreas: [
        '"health health jules"',
        '"agent-status chatter jules"',
        '"tasks scheduled scheduled"'
      ],
      gridTemplateColumns: '1fr 1fr 1.2fr',
      gridTemplateRows: '140px 1.5fr 1fr',
      widgetAssignments: {
        health: 'health',
        agent_status: 'agent-status',
        agent_chatter: 'chatter',
        jules: 'jules',
        task_queue: 'tasks',
        scheduled_tasks: 'scheduled'
      },
    },
    {
      id: 'dev-mode',
      name: 'Developer Mode',
      description: 'Layout optimized for development with terminal/editor focus.',
      gridTemplateAreas: [
        '"dev-main dev-main"',
        '"dev-bottom dev-right"'
      ],
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '2fr 1fr',
      widgetAssignments: {
        logs: 'dev-main', // Terminal/Logs
        task_queue: 'dev-bottom', // For active tasks related to dev
        files: 'dev-right', // Code Editor / File Explorer
      },
    },
    {
      id: 'ops-mode',
      name: 'Operations Mode',
      description: 'Layout focused on system health and metrics.',
      gridTemplateAreas: [
        '"ops-main ops-main"',
        '"ops-metrics ops-alerts"'
      ],
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: '2fr 1fr',
      widgetAssignments: {
        health: 'ops-main', // System Health
        agent_status: 'ops-metrics', // Individual agent health/metrics
        process_control: 'ops-alerts', // Process intervention/alerts
      },
    },
    {
      id: 'focused-mode',
      name: 'Focused Mode',
      description: 'Highlights a single widget for detailed view.',
      gridTemplateAreas: [
        '"focused-main"'
      ],
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
      widgetAssignments: {
        'health': 'focused-main',
      },
    },
  ],
};

interface LayoutContextType {
  currentLayout: LayoutMode;
  setLayoutMode: (modeId: LayoutModeId) => void;
  layouts: DashboardLayoutConfig;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeLayoutId, setActiveLayoutId] = useState<LayoutModeId>(defaultLayoutConfig.defaultMode);

  const currentLayout = useMemo(() => 
    defaultLayoutConfig.modes.find(mode => mode.id === activeLayoutId) || defaultLayoutConfig.modes[0],
    [activeLayoutId]
  );

  const setLayoutMode = useCallback((modeId: LayoutModeId) => {
    if (defaultLayoutConfig.modes.some(mode => mode.id === modeId)) {
      setActiveLayoutId(modeId);
    } else {
      console.warn(`Attempted to set unknown layout mode: ${modeId}`);
    }
  }, []);

  const value = useMemo(() => ({
    currentLayout,
    setLayoutMode,
    layouts: defaultLayoutConfig
  }), [currentLayout, setLayoutMode]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
