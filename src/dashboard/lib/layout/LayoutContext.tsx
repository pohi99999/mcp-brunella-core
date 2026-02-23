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
        '"dev-main dev-main dev-right"',
        '"dev-logs dev-tasks dev-right"',
        '"dev-neural dev-neural dev-right"'
      ],
      gridTemplateColumns: '1.5fr 1fr 1fr',
      gridTemplateRows: '140px 1fr 180px',
      widgetAssignments: {
        health: 'dev-main', // System health check
        logs: 'dev-logs', // Terminal/Activity Monitor
        task_queue: 'dev-tasks', // Active development tasks
        files: 'dev-right', // Code Editor / File Explorer
        neural_command: 'dev-neural', // Quick command execution
      },
    },
    {
      id: 'ops-mode',
      name: 'Operations Mode',
      description: 'Layout focused on system health, agents, and process control.',
      gridTemplateAreas: [
        '"ops-health ops-health ops-cf"',
        '"ops-agents ops-process ops-cf"',
        '"ops-tasks ops-tasks ops-scheduled"'
      ],
      gridTemplateColumns: '1.5fr 1fr 1fr',
      gridTemplateRows: '140px 1.5fr 1fr',
      widgetAssignments: {
        health: 'ops-health', // System Health
        agent_status: 'ops-agents', // Individual agent monitoring
        process_control: 'ops-process', // Process intervention/alerts
        cloudflare_agents: 'ops-cf', // Cloudflare Workers audit
        task_queue: 'ops-tasks', // Active task monitoring
        scheduled_tasks: 'ops-scheduled', // Scheduled automation
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
    {
      id: 'ai-control',
      name: 'AI Control Center',
      description: 'AI-focused layout with Jules, Neural Command, and agent monitoring.',
      gridTemplateAreas: [
        '"ai-health ai-health ai-cf"',
        '"ai-jules ai-chatter ai-cf"',
        '"ai-neural ai-neural ai-agents"'
      ],
      gridTemplateColumns: '1.5fr 1fr 1fr',
      gridTemplateRows: '140px 1.5fr 180px',
      widgetAssignments: {
        health: 'ai-health', // System health
        jules: 'ai-jules', // Jules AI assistant
        agent_chatter: 'ai-chatter', // Agent communication
        cloudflare_agents: 'ai-cf', // Cloudflare edge agents
        neural_command: 'ai-neural', // Natural language command
        agent_status: 'ai-agents', // Agent status monitoring
      },
    },
    {
      id: 'business-mode',
      name: 'Business Dashboard',
      description: 'Layout for monitoring monetization services like Invoices and Market Intel.',
      gridTemplateAreas: [
        '"biz-health biz-health biz-market"',
        '"biz-invoice biz-invoice biz-market"',
        '"biz-tasks biz-tasks biz-tasks"'
      ],
      gridTemplateColumns: '1.5fr 1fr 1.2fr',
      gridTemplateRows: '140px 1.5fr 1fr',
      widgetAssignments: {
        health: 'biz-health',
        invoice_sync: 'biz-invoice',
        market_watcher: 'biz-market',
        task_queue: 'biz-tasks'
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
