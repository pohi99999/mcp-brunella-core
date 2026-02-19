import React from "react";
import { SystemHealthCard } from "@/components/dashboard/SystemHealthCard";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { JulesPanel } from "@/components/dashboard/JulesPanel";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { TrackProgressWidget } from "@/components/dashboard/TrackProgress";
import { TestResultsWidget } from "@/components/dashboard/TestResultsWidget";
import { SuggestedTasksWidget } from "@/components/dashboard/SuggestedTasksWidget";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";

export interface WidgetDefinition {
  id: string;
  label: string;
  component: React.ComponentType<any>;
  defaultSize: { w: number; h: number };
}

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  health: {
    id: "health",
    label: "System Health",
    component: SystemHealthCard,
    defaultSize: { w: 12, h: 4 }
  },
  quick_actions: {
    id: "quick_actions",
    label: "Quick Actions",
    component: QuickActionsPanel,
    defaultSize: { w: 4, h: 6 }
  },
  agent_status: {
    id: "agent_status",
    label: "Agent Status",
    component: AgentStatusCard,
    defaultSize: { w: 6, h: 8 }
  },
  jules: {
    id: "jules",
    label: "Jules AI",
    component: JulesPanel,
    defaultSize: { w: 6, h: 8 }
  },
  logs: {
    id: "logs",
    label: "Activity Monitor",
    component: TerminalLog,
    defaultSize: { w: 8, h: 10 }
  },
  track_progress: {
    id: "track_progress",
    label: "Track Progress",
    component: TrackProgressWidget,
    defaultSize: { w: 4, h: 5 }
  },
  test_results: {
    id: "test_results",
    label: "Precision Tests",
    component: TestResultsWidget,
    defaultSize: { w: 4, h: 5 }
  },
  suggested_tasks: {
    id: "suggested_tasks",
    label: "Suggested Tasks",
    component: SuggestedTasksWidget,
    defaultSize: { w: 4, h: 6 }
  },
  task_queue: {
    id: "task_queue",
    label: "Task Queue",
    component: TaskQueueMonitor,
    defaultSize: { w: 6, h: 8 }
  },
  files: {
    id: "files",
    label: "Filesystem",
    component: FileExplorer,
    defaultSize: { w: 6, h: 8 }
  }
};
