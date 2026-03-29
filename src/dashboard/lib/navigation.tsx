import React, { Suspense } from "react";
import
{
  LayoutDashboard, Network, Rocket, Cloud, Cpu, MessageSquare,
  Sparkles, Layers, History, FlaskConical, Brain, Shield, Code2,
  Zap, FileText, Gauge, Activity, Box, FolderOpen, Settings, Workflow, Terminal,
  BarChart3, Flame, Briefcase, Palette, DollarSign, Lightbulb, Database, Bell, Wallet,
  Search, Target, Receipt, ShieldAlert, Users, Wrench, Building2, Globe
} from "lucide-react";

// Component Imports
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { RobotkezV2Chat } from "@/components/dashboard/RobotkezV2Chat";
import { BrowserCopilotPanel } from "@/components/dashboard/BrowserCopilotPanel";
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
import { BookkeepingWidget } from "@/components/dashboard/BookkeepingWidget";
import { HazipenztarWidget } from "@/components/dashboard/HazipenztarWidget";
import { PropertyVisionaryWidget } from "@/components/dashboard/PropertyVisionaryWidget";
import { PropertySalesWidget } from "@/components/dashboard/PropertySalesWidget";
import { LeadsMasterMonitor } from "@/components/dashboard/LeadsMasterMonitor";
import { TrojanHorseCommandCenter } from "@/components/dashboard/TrojanHorseCommandCenter";
import { AutonomousInfraPanel } from "@/components/dashboard/AutonomousInfraPanel";
import { ShowcasePage } from "@/pages/ShowcasePage";
import { GuardrailsPanel } from "@/components/dashboard/GuardrailsPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { MemoryPanel } from "@/components/dashboard/MemoryPanel";
import { WorkflowPanel } from "@/components/dashboard/WorkflowPanel";
import { AgentDiagnosticsPanel } from "@/components/dashboard/AgentDiagnosticsPanel";
import { AssistantBlueprintPanel } from "@/components/dashboard/AssistantBlueprintPanel";
import SwarmPanel from "@/components/dashboard/SwarmPanel";
import ToolDiscoveryPanel from "@/components/dashboard/ToolDiscoveryPanel";
import SecurityPanel from "@/components/dashboard/SecurityPanel";
import { Crawl4AIPanel } from "@/components/dashboard/Crawl4AIPanel";
import { IntelligenceMonitorPanel } from "@/components/dashboard/IntelligenceMonitorPanel";
import { UserPreferencesPanel } from "@/components/dashboard/UserPreferencesPanel";
import LLMObservabilityPanel from "@/components/dashboard/LLMObservabilityPanel";
import { CopilotCommanderPanel } from "@/components/dashboard/CopilotCommanderPanel";
import { RemoteConsolePanel } from "@/components/dashboard/RemoteConsolePanel";
import { ZeroPromptNotificationPanel } from "@/components/dashboard/ZeroPromptNotificationPanel";
import { EphemeralAgentsPanel } from "@/components/dashboard/EphemeralAgentsPanel";
import { LearningLoopPanel } from "@/components/dashboard/LearningLoopPanel";
import { FederationCenter } from "@/components/FederationCenter";
import { logInfo } from "@/utils/logger";

const LazyEnterpriseAnalyticsWidget = React.lazy( async () =>
{
  const module = await import( "@/components/dashboard/EnterpriseAnalyticsWidget" );
  return { default: module.EnterpriseAnalyticsWidget };
} );

export interface NavItem
{
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ReactNode;
}

export interface NavGroup
{
  title: string;
  items: string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

class NavigationRegistry
{
  private items: Map<string, NavItem> = new Map();
  private groups: NavGroup[] = [];

  registerItem ( item: NavItem )
  {
    this.items.set( item.id, item );
  }

  registerGroup ( group: NavGroup )
  {
    this.groups.push( group );
  }

  getItem ( id: string ): NavItem | undefined
  {
    return this.items.get( id );
  }

  getAllItems (): NavItem[]
  {
    return Array.from( this.items.values() );
  }

  getGroups (): NavGroup[]
  {
    return this.groups;
  }
}

export const navigationRegistry = new NavigationRegistry();

export function initializeNavigation ()
{
  logInfo( "NavigationRegistry", "Initializing Navigation Registry..." );

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
    { id: "assistant-blueprint", label: "Personal Assistant", icon: Sparkles, component: <AssistantBlueprintPanel /> },
    { id: "phoenix", label: "Phoenix Events", icon: Flame, component: <PhoenixEventsPanel /> },
    { id: "zero-prompt-notifications", label: "Approval Notifications", icon: Bell, component: <ZeroPromptNotificationPanel /> },
    { id: "ephemeral-agents", label: "Ephemeral Agents", icon: Zap, component: <EphemeralAgentsPanel /> },
    { id: "learning-loop", label: "Learning Loop", icon: Brain, component: <LearningLoopPanel /> },
    { id: "federation", label: "Federated MCP", icon: Globe, component: <FederationCenter /> },
    { id: "management", label: "Agent Roster", icon: Sparkles, component: <AgentManagementPanel /> },
    { id: "agent-diagnostics", label: "Agent Diagnostics", icon: Gauge, component: <AgentDiagnosticsPanel /> },
    { id: "decomposer", label: "Decompose", icon: Layers, component: <TaskDecomposerPanel /> },
    { id: "tracks", label: "Tracks", icon: History, component: <TrackGenerator /> },
    { id: "incubator", label: "Incubator", icon: FlaskConical, component: <IncubatorPanel /> },
    { id: "knowledge", label: "Neural Knowledge", icon: Brain, component: <KnowledgeBasePanel /> },
    { id: "memory", label: "Agent Memory", icon: Database, component: <MemoryPanel /> },
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
        <Suspense fallback={ <div className="p-4 text-sm text-zinc-400">Enterprise Analytics betöltése...</div> }>
          <LazyEnterpriseAnalyticsWidget />
        </Suspense>
      ),
    },
    { id: "robotkez", label: "Robotkéz", icon: Activity, component: <RobotkezV2Chat /> },
    { id: "browser-copilot", label: "Browser Copilot", icon: MessageSquare, component: <BrowserCopilotPanel /> },
    { id: "tasks", label: "Task Queue", icon: History, component: <TaskQueueMonitor /> },
    { id: "workflow-engine", label: "Workflow Engine", icon: Workflow, component: <WorkflowPanel /> },
    { id: "python-workers", label: "Python Workers", icon: Cpu, component: <PythonWorkersPanel /> },
    { id: "inventory", label: "Assets", icon: Box, component: <InventoryCatalog /> },
    { id: "files", label: "Filesystem", icon: FolderOpen, component: <FileExplorer /> },
    // { id: "projects", label: "Projektek", icon: FolderOpen, component: <ProjectExplorer /> },
    { id: "enterprise-suite", label: "Enterprise Suite", icon: Briefcase, component: <EnterpriseSuitePanel /> },
    { id: "studio", label: "Brunella Studio", icon: Palette, component: <BrunellaStudio /> },
    { id: "campaign-studio", label: "Kampány Stúdió", icon: DollarSign, component: <CampaignStudio /> },
    { id: "innovation-bridge", label: "Innovation Bridge", icon: Lightbulb, component: <InnovationBridgeWidget /> },
    { id: "invoice-sync", label: "Számla Szinkron", icon: Receipt, component: <InvoiceSyncWidget /> },
    { id: "bookkeeping", label: "Könyvelés", icon: BarChart3, component: <BookkeepingWidget /> },
    { id: "kp-penztar", label: "Házipénztár", icon: Wallet, component: <HazipenztarWidget /> },
    { id: "lead-mining", label: "Lead Mining", icon: Target, component: <LeadMiningWidget /> },
    { id: "leads-master", label: "Leads Monitor", icon: DollarSign, component: <LeadsMasterMonitor /> },
    { id: "trojan-horse", label: "Trójai Faló", icon: ShieldAlert, component: <TrojanHorseCommandCenter /> },
    { id: "lead-monitor", label: "Lead Monitor", icon: Activity, component: <LeadsMasterMonitor /> },
    { id: "property-sales", label: "Ingatlan Értékesítés", icon: Building2, component: <PropertySalesWidget /> },
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
    { id: "chrome-acp", label: "Chrome ACP", icon: Code2, component: <EmbeddedWorkflow title="Chrome ACP Browser" url="http://localhost:9315" icon={ <Code2 size={ 20 } /> } allowSameOrigin={ true } /> },
    { id: "n8n", label: "n8n Automation", icon: Workflow, component: <EmbeddedWorkflow title="n8n Automation" url="http://localhost:5678" icon={ <Workflow size={ 20 } /> } /> },
    { id: "langflow", label: "Langflow Orchestration", icon: Sparkles, component: <EmbeddedWorkflow title="Langflow Orchestration" url="http://localhost:3000" icon={ <Sparkles size={ 20 } /> } /> },
    { id: "vscode", label: "VSCode Stream", icon: Code2, component: <EmbeddedWorkflow title="VSCode — Brunella Workspace" url="http://localhost:8080" icon={ <Code2 size={ 20 } /> } allowSameOrigin={ true } /> },
    { id: "swarm-panel", label: "Swarm Intelligence", icon: Users, component: <SwarmPanel /> },
    { id: "tool-discovery", label: "Tool Discovery", icon: Wrench, component: <ToolDiscoveryPanel /> },
    { id: "security-panel", label: "Security Monitor", icon: Shield, component: <SecurityPanel /> },
    { id: "crawl4ai", label: "Crawl4AI", icon: Search, component: <Crawl4AIPanel /> },
    { id: "intelligence-monitor", label: "Intelligence Monitor", icon: Database, component: <IntelligenceMonitorPanel /> },
    { id: "user-preferences", label: "Felhasználói Memória", icon: Database, component: <UserPreferencesPanel /> },
    { id: "llm-observability", label: "LLM Observability", icon: BarChart3, component: <LLMObservabilityPanel /> },
    { id: "copilot-commander", label: "Copilot Commander", icon: Terminal, component: <CopilotCommanderPanel /> },
    { id: "remote-console", label: "Remote Layer", icon: Target, component: <RemoteConsolePanel /> },
  ];

  items.forEach( item => navigationRegistry.registerItem( item ) );

  // Register groups
  navigationRegistry.registerGroup( { title: "Core Systems", icon: Layers, items: ["dashboard", "neural-map", "system-arch", "studio", "vscode"] } );
  navigationRegistry.registerGroup( { title: "AI & Agents", icon: Brain, items: ["chat", "paios", "copilot-commander", "assistant-blueprint", "phoenix", "zero-prompt-notifications", "ephemeral-agents", "learning-loop", "federation", "management", "agent-diagnostics", "decomposer", "incubator", "knowledge", "memory", "user-preferences", "developer", "edge", "robotkez", "browser-copilot", "jules"] } );
  navigationRegistry.registerGroup( { title: "Enterprise", icon: Briefcase, items: ["enterprise-suite", "digital-hr", "grant-hunter", "law-detective", "property-visionary", "property-sales", "enterprise-analytics", "intelligence-monitor"] } );
  navigationRegistry.registerGroup( { title: "Értékesítési Központ", icon: DollarSign, items: ["trojan-horse", "lead-monitor", "demo-factory", "showcase", "campaign-studio", "leads-master", "innovation-bridge", "invoice-sync", "bookkeeping", "kp-penztar", "lead-mining", "marketwatcher", "inventory"] } );
  navigationRegistry.registerGroup( { title: "Orchestration", icon: Rocket, items: ["cean", "cloudflare", "fleet_manager", "autonomy", "tasks", "workflow-engine", "swarm-panel", "tool-discovery", "crawl4ai"] } );
  navigationRegistry.registerGroup( { title: "Project Mgmt", icon: FileText, items: ["tracks", "suggested-tasks", "tests"] } );
  navigationRegistry.registerGroup( { title: "System", icon: Settings, items: ["python-workers", "files", "guardrails", "telemetry", "llm-observability", "security-panel", "chrome-acp", "settings", "n8n", "langflow", "remote-console"] } );

  logInfo( "NavigationRegistry", "Navigation Registry Initialized." );
}
