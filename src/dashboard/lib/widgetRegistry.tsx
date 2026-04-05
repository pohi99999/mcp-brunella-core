import React from "react";
import { SystemHealthCard } from "@/components/dashboard/SystemHealthCard";
import { AgentStatusMonitor } from "@/components/dashboard/AgentStatusMonitor";
import { JulesPanel } from "@/components/dashboard/JulesPanel";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { TrackProgressWidget } from "@/components/dashboard/TrackProgress";
import { TestResultsWidget } from "@/components/dashboard/TestResultsWidget";
import { SuggestedTasksWidget } from "@/components/dashboard/SuggestedTasksWidget";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { LiveChatterWidget } from "@/components/dashboard/LiveChatterWidget";
import { ScheduledTasksPanel } from "@/components/dashboard/ScheduledTasksPanel";
import { ProcessControlWidget } from "@/components/dashboard/ProcessControlWidget";
import { AdminSelfCheckWidget } from "@/components/dashboard/AdminSelfCheckWidget";
import { NeuralCommandWidget } from "@/components/dashboard/NeuralCommandWidget";
import { CloudflareAgentsCard } from "@/components/dashboard/CloudflareAgentsCard";
import { RAGMemoryWidget } from "@/components/dashboard/RAGMemoryWidget";
import { VectorizeAnalyticsWidget } from "@/components/dashboard/VectorizeAnalyticsWidget";
import { InvoiceSyncWidget } from "@/components/dashboard/InvoiceSyncWidget";
import { InvoiceAutomationWidget } from "@/components/dashboard/InvoiceAutomationWidget";
import { MarketWatcherWidget } from "@/components/dashboard/MarketWatcherWidget";
import { LeadMiningWidget } from "@/components/dashboard/LeadMiningWidget";
import { EnterpriseSuitePanel } from "@/components/dashboard/EnterpriseSuitePanel";
import { InnovationBridgeWidget } from "@/components/dashboard/InnovationBridgeWidget";
import { DigitalHRWidget } from "@/components/dashboard/DigitalHRWidget";
import { GrantHunterWidget } from "@/components/dashboard/GrantHunterWidget";
import { LawDetectiveWidget } from "@/components/dashboard/LawDetectiveWidget";
import { PropertyVisionaryWidget } from "@/components/dashboard/PropertyVisionaryWidget";
import { SystemGuideWidget } from "@/components/dashboard/SystemGuideWidget";
import { BrunellaStudio } from "@/components/dashboard/BrunellaStudio";
import { CampaignGeneratorWidget } from "@/components/dashboard/CampaignGeneratorWidget";
import { SalesPipelineWidget } from "@/components/dashboard/SalesPipelineWidget";
import { HarvestPipelineWidget } from "@/components/dashboard/HarvestPipelineWidget";
import { SwarmStatusWidget } from "@/components/dashboard/SwarmStatusWidget";

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
    component: AgentStatusMonitor,
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
  agent_chatter: {
    id: "agent_chatter",
    label: "Agent Chatter",
    component: LiveChatterWidget,
    defaultSize: { w: 6, h: 8 }
  },
  scheduled_tasks: {
    id: "scheduled_tasks",
    label: "Scheduled Tasks",
    component: ScheduledTasksPanel,
    defaultSize: { w: 6, h: 8 }
  },
  files: {
    id: "files",
    label: "Filesystem",
    component: FileExplorer,
    defaultSize: { w: 6, h: 8 }
  },
  process_control: {
    id: "process_control",
    label: "Process Control",
    component: ProcessControlWidget,
    defaultSize: { w: 6, h: 8 }
  },
  admin_self_check: {
    id: "admin_self_check",
    label: "Admin Self-Check",
    component: AdminSelfCheckWidget,
    defaultSize: { w: 6, h: 8 }
  },
  neural_command: {
    id: "neural_command",
    label: "Neural Command",
    component: NeuralCommandWidget,
    defaultSize: { w: 12, h: 6 }
  },
  cloudflare_agents: {
    id: "cloudflare_agents",
    label: "Cloudflare Edge Orchestrator",
    component: CloudflareOrchestrator,
    defaultSize: { w: 6, h: 8 }
  },
  rag_memory: {
    id: "rag_memory",
    label: "RAG Memória",
    component: RAGMemoryWidget,
    defaultSize: { w: 6, h: 8 }
  },
  vectorize_analytics: {
    id: "vectorize_analytics",
    label: "Vectorize Analytics",
    component: VectorizeAnalyticsWidget,
    defaultSize: { w: 6, h: 8 }
  },
  invoice_sync: {
    id: "invoice_sync",
    label: "Invoice Automation",
    component: InvoiceSyncWidget,
    defaultSize: { w: 6, h: 8 }
  },
  invoice_automation: {
    id: "invoice_automation",
    label: "Számla Automatizálás (Vision)",
    component: InvoiceAutomationWidget,
    defaultSize: { w: 6, h: 8 }
  },
  market_watcher: {
    id: "market_watcher",
    label: "Market Watcher",
    component: MarketWatcherWidget,
    defaultSize: { w: 6, h: 8 }
  },
  lead_mining: {
    id: "lead_mining",
    label: "Lead Mining",
    component: LeadMiningWidget,
    defaultSize: { w: 6, h: 8 }
  },
  enterprise_suite: {
    id: "enterprise_suite",
    label: "Enterprise Suite",
    component: EnterpriseSuitePanel,
    defaultSize: { w: 12, h: 10 }
  },
  innovation_bridge: {
    id: "innovation_bridge",
    label: "Innovation Bridge",
    component: InnovationBridgeWidget,
    defaultSize: { w: 12, h: 10 }
  },
  digital_hr: {
    id: "digital_hr",
    label: "Digital HR",
    component: DigitalHRWidget,
    defaultSize: { w: 6, h: 8 }
  },
  grant_hunter: {
    id: "grant_hunter",
    label: "Grant Hunter",
    component: GrantHunterWidget,
    defaultSize: { w: 6, h: 8 }
  },
  sales_pipeline: {
    id: "sales_pipeline",
    label: "Sales Pipeline",
    component: SalesPipelineWidget,
    defaultSize: { w: 12, h: 10 }
  },
  law_detective: {
    id: "law_detective",
    label: "Law Detective",
    component: LawDetectiveWidget,
    defaultSize: { w: 6, h: 8 }
  },
  property_visionary: {
    id: "property_visionary",
    label: "Property Visionary",
    component: PropertyVisionaryWidget,
    defaultSize: { w: 12, h: 10 }
  },
  system_guide: {
    id: "system_guide",
    label: "Brunella Atlas",
    component: SystemGuideWidget,
    defaultSize: { w: 12, h: 10 }
  },
  campaign_generator: {
    id: "campaign_generator",
    label: "Campaign Generator",
    component: CampaignGeneratorWidget,
    defaultSize: { w: 12, h: 10 }
  },
  studio: {
    id: "studio",
    label: "Brunella Studio",
    component: BrunellaStudio,
    defaultSize: { w: 12, h: 12 }
  },
  harvest_pipeline: {
    id: "harvest_pipeline",
    label: "Harvest Pipeline",
    component: HarvestPipelineWidget,
    defaultSize: { w: 4, h: 6 }
  },
  swarm_status: {
    id: "swarm_status",
    label: "Swarm Colonies",
    component: SwarmStatusWidget,
    defaultSize: { w: 4, h: 6 }
  }
};
