import React, { Suspense } from "react";
import {
  LayoutDashboard, Network, Rocket, Cloud, Cpu, MessageSquare,
  Sparkles, Layers, History, FlaskConical, Brain, Shield, Code2,
  Zap, FileText, Gauge, Activity, Box, FolderOpen, Settings, Workflow,
  BarChart3, Flame, Briefcase, Palette, DollarSign, Lightbulb,
  Search, Target, Receipt, ShieldAlert
} from "lucide-react";

// Component Imports
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { ProjectExplorer } from "@/components/dashboard/ProjectExplorer";
import { RobotkezV2Chat } from "@/components/dashboard/RobotkezV2Chat";
import { PAIOSOrchestratorChat } from "@/components/dashboard/PAIOSOrchestratorChat";
import { PhoenixEventsPanel } from "@/components/dashboard/PhoenixEventsPanel";
import { AgentManagementPanel } from "@/components/dashboard/AgentManagementPanel";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { KnowledgeBasePanel } from "@/components/dashboard/KnowledgeBasePanel";
import { IncubatorPanel } from "@/components/dashboard/IncubatorPanel";
import { DeveloperPanel } from "@/components/dashboard/DeveloperPanel";
import { EdgePanel } from "@/components/dashboard/EdgePanel";
import { JulesPanel } from "@/components/dashboard/JulesPanel";
import { MarketWatcherConfig } from "@/components/dashboard/MarketWatcherConfig";
import { InvoiceSyncWidget } from "@/components/dashboard/InvoiceSyncWidget";
import { LeadMiningWidget } from "@/components/dashboard/LeadMiningWidget";
import { TrackGenerator } from "@/components/dashboard/TrackGenerator";
import { TaskDecomposerPanel } from "@/components/dashboard/TaskDecomposerPanel";
import { SuggestedTasksWidget } from "@/components/dashboard/SuggestedTasksWidget";
import { CEANLayout } from "@/components/cean/CEANLayout";
import { CloudflareDeployment } from "@/pages/CloudflareDeployment";
import FleetManager from "@/pages/FleetManager";
import { NeuralMap } from "@/pages/NeuralMap";
import { MCPCommandCenter } from "@/components/dashboard/MCPCommandCenter";
import { InventoryCatalog } from "@/components/dashboard/InventoryCatalog";
import { TestResultsWidget } from "@/components/dashboard/TestResultsWidget";
import { EmbeddedWorkflow } from "@/components/dashboard/EmbeddedWorkflow";
import { PythonWorkersPanel } from "@/components/dashboard/PythonWorkersPanel";
import { SystemArchitectureWidget } from "@/components/dashboard/SystemArchitectureWidget";
import { EnterpriseSuitePanel } from "@/components/dashboard/EnterpriseSuitePanel";
import { BrunellaStudio } from "@/components/dashboard/BrunellaStudio";
import { CampaignStudio } from "@/components/dashboard/CampaignStudio";
import { InnovationBridgeWidget } from "@/components/dashboard/InnovationBridgeWidget";
import { DigitalHRWidget } from "@/components/dashboard/DigitalHRWidget";
import { GrantHunterWidget } from "@/components/dashboard/GrantHunterWidget";
import { LawDetectiveWidget } from "@/components/dashboard/LawDetectiveWidget";
import { PropertyVisionaryWidget } from "@/components/dashboard/PropertyVisionaryWidget";
import { LeadsMasterMonitor } from "@/components/dashboard/LeadsMasterMonitor";
import { TrojanHorseCommandCenter } from "@/components/dashboard/TrojanHorseCommandCenter";
import { AutonomousInfraPanel } from "@/components/dashboard/AutonomousInfraPanel";
import { ShowcasePage } from "@/pages/ShowcasePage";
import { GuardrailsPanel } from "@/components/dashboard/GuardrailsPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { logInfo } from "@/utils/logger";

const LazyEnterpriseAnalyticsWidget = React.lazy(async () => {
  const module = await import("@/components/dashboard/EnterpriseAnalyticsWidget");
  return { default: module.EnterpriseAnalyticsWidget };
});

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  component: React.ReactNode;
}

export interface NavGroup {
  title: string;
  items: string[];
  icon: any;
}

class NavigationRegistry {
  private items: Map<string, NavItem> = new Map();
  private groups: NavGroup[] = [];

  registerItem(item: NavItem) {
    this.items.set(item.id, item);
  }

  registerGroup(group: NavGroup) {
    this.groups.push(group);
  }

  getItem(id: string): NavItem | undefined {
    return this.items.get(id);
  }

  getAllItems(): NavItem[] {
    return Array.from(this.items.values());
  }

  getGroups(): NavGroup[] {
    return this.groups;
  }
}

export const navigationRegistry = new NavigationRegistry();

export function initializeNavigation() {
  logInfo("NavigationRegistry", "Initializing Navigation Registry...");

  // Register all items
  const items: NavItem[] = [
    { id: "dashboard", label: "Mission Control", icon: LayoutDashboard, component: null },
    { id: "neural-map", label: "Neural Map", icon: Network, component: <NeuralMap /> },
    { id: "system-arch", label: "Architecture", icon: Layers, component: <SystemArchitectureWidget /> },
    { id: "cean", label: "CEAN Orchestrator", icon: Rocket, component: <CEANLayout /> },
    { id: "cloudflare", label: "Cloudflare Deploy", icon: Cloud, component: <CloudflareDeployment /> },
    { id: "fleet_manager", label: "Fleet Manager", icon: Cpu, component: <FleetManager /> },
    { id: "autonomy", label: "Autonomous Infra", icon: Rocket, component: <AutonomousInfraPanel /> },
    { id: "chat", label: "Neural Chat", icon: MessageSquare, component: <NeuralLinkChat /> },
    { id: "paios", label: "PAIOS Orchestrator", icon: Brain, component: <PAIOSOrchestratorChat /> },
    { id: "phoenix", label: "Phoenix Events", icon: Flame, component: <PhoenixEventsPanel /> },
    { id: "management", label: "Agent Roster", icon: Sparkles, component: <AgentManagementPanel /> },
    { id: "decomposer", label: "Decompose", icon: Layers, component: <TaskDecomposerPanel /> },
    { id: "tracks", label: "Tracks", icon: History, component: <TrackGenerator /> },
    { id: "incubator", label: "Incubator", icon: FlaskConical, component: <IncubatorPanel /> },
    { id: "knowledge", label: "Neural Knowledge", icon: Brain, component: <KnowledgeBasePanel /> },
    { id: "mcp", label: "MCP Command Center", icon: Shield, component: <MCPCommandCenter /> },
    { id: "developer", label: "Developer", icon: Code2, component: <DeveloperPanel /> },
    { id: "edge", label: "Edge", icon: Zap, component: <EdgePanel /> },
    { id: "suggested-tasks", label: "Suggested", icon: FileText, component: <SuggestedTasksWidget /> },
    { id: "tests", label: "Precision Tests", icon: Gauge, component: <TestResultsWidget /> },
    {
      id: "enterprise-analytics",
      label: "Enterprise Analytics",
      icon: BarChart3,
      component: (
        <Suspense fallback={<div className="p-4 text-sm text-zinc-400">Enterprise Analytics betöltése...</div>}>
          <LazyEnterpriseAnalyticsWidget />
        </Suspense>
      ),
    },
    { id: "robotkez", label: "Robotkéz", icon: Activity, component: <RobotkezV2Chat /> },
    { id: "tasks", label: "Task Queue", icon: History, component: <TaskQueueMonitor /> },
    { id: "python-workers", label: "Python Workers", icon: Cpu, component: <PythonWorkersPanel /> },
    { id: "inventory", label: "Assets", icon: Box, component: <InventoryCatalog /> },
    { id: "files", label: "Filesystem", icon: FolderOpen, component: <FileExplorer /> },
    // { id: "projects", label: "Projektek", icon: FolderOpen, component: <ProjectExplorer /> },
    { id: "enterprise-suite", label: "Enterprise Suite", icon: Briefcase, component: <EnterpriseSuitePanel /> },
    { id: "studio", label: "Brunella Studio", icon: Palette, component: <BrunellaStudio /> },
    { id: "campaign-studio", label: "Kampány Stúdió", icon: DollarSign, component: <CampaignStudio /> },
    { id: "innovation-bridge", label: "Innovation Bridge", icon: Lightbulb, component: <InnovationBridgeWidget /> },
    { id: "invoice-sync", label: "Számla Szinkron", icon: Receipt, component: <InvoiceSyncWidget /> },
    { id: "lead-mining", label: "Lead Mining", icon: Target, component: <LeadMiningWidget /> },
    { id: "leads-master", label: "Leads Monitor", icon: DollarSign, component: <LeadsMasterMonitor /> },
    { id: "trojan-horse", label: "Trójai Faló", icon: ShieldAlert, component: <TrojanHorseCommandCenter /> },
    { id: "lead-monitor", label: "Lead Monitor", icon: Activity, component: <LeadsMasterMonitor /> },
    { id: "demo-factory", label: "Demo Gyár", icon: FlaskConical, component: <IncubatorPanel /> },
    { id: "showcase", label: "AI Showcase", icon: Sparkles, component: <ShowcasePage /> },
    { id: "jules", label: "Jules AI", icon: Zap, component: <JulesPanel /> },
    { id: "digital-hr", label: "Digital HR", icon: Briefcase, component: <DigitalHRWidget /> },
    { id: "grant-hunter", label: "Grant Hunter", icon: Search, component: <GrantHunterWidget /> },
    { id: "law-detective", label: "Law Detective", icon: Shield, component: <LawDetectiveWidget /> },
    { id: "property-visionary", label: "Property Visionary", icon: Box, component: <PropertyVisionaryWidget /> },
    { id: "marketwatcher", label: "Market Watcher", icon: Activity, component: <MarketWatcherConfig /> },
    { id: "settings", label: "System Config", icon: Settings, component: <SettingsPanel /> },
    { id: "guardrails", label: "Guardrails", icon: ShieldAlert, component: <GuardrailsPanel /> },
    { id: "telemetry", label: "Telemetria", icon: Gauge, component: <TelemetryPanel /> },
    { id: "n8n", label: "n8n Automation", icon: Workflow, component: <EmbeddedWorkflow title="n8n Automation" url="http://localhost:5678" icon={<Workflow size={20} />} /> },
    { id: "langflow", label: "Langflow Orchestration", icon: Sparkles, component: <EmbeddedWorkflow title="Langflow Orchestration" url="http://localhost:3000" icon={<Sparkles size={20} />} /> },
    { id: "vscode", label: "VSCode Stream", icon: Code2, component: <EmbeddedWorkflow title="VSCode — Brunella Workspace" url="http://localhost:8080" icon={<Code2 size={20} />} allowSameOrigin={true} /> },
  ];

  items.forEach(item => navigationRegistry.registerItem(item));

  // Register groups
  navigationRegistry.registerGroup({ title: "Core Systems", icon: Layers, items: ["dashboard", "neural-map", "system-arch", "studio", "vscode"] });
  navigationRegistry.registerGroup({ title: "AI & Agents", icon: Brain, items: ["chat", "paios", "phoenix", "management", "decomposer", "incubator", "knowledge", "developer", "edge", "robotkez", "jules"] });
  navigationRegistry.registerGroup({ title: "Enterprise", icon: Briefcase, items: ["enterprise-suite", "digital-hr", "grant-hunter", "law-detective", "property-visionary", "enterprise-analytics"] });
  navigationRegistry.registerGroup({ title: "Értékesítési Központ", icon: DollarSign, items: ["trojan-horse", "lead-monitor", "demo-factory", "showcase", "campaign-studio", "leads-master", "innovation-bridge", "invoice-sync", "lead-mining", "marketwatcher", "inventory"] });
  navigationRegistry.registerGroup({ title: "Orchestration", icon: Rocket, items: ["cean", "cloudflare", "fleet_manager", "autonomy", "tasks"] });
  navigationRegistry.registerGroup({ title: "Project Mgmt", icon: FileText, items: ["tracks", "suggested-tasks", "tests"] });
  navigationRegistry.registerGroup({ title: "System", icon: Settings, items: ["python-workers", "files", "guardrails", "telemetry", "settings", "n8n", "langflow"] });

  logInfo("NavigationRegistry", "Navigation Registry Initialized.");
}
