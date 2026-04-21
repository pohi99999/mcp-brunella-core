import React, { Suspense } from "react";
import
{
  LayoutDashboard, Network, Rocket, Cloud, Cpu, MessageSquare,
  Sparkles, Layers, History, FlaskConical, Brain, Shield, Code2,
  Zap, FileText, Gauge, Activity, Box, FolderOpen, Settings, Workflow, Terminal,
  BarChart3, Flame, Briefcase, Palette, DollarSign, Lightbulb, Database, Bell, Wallet,
  Search, Target, Receipt, ShieldAlert, Users, Wrench, Building2, Globe, ClipboardList, PackageSearch, TrendingUp
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
import { AgentToolCatalog } from "@/components/dashboard/AgentToolCatalog";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { KnowledgeBasePanel } from "@/components/dashboard/KnowledgeBasePanel";
import { IncubatorPanel } from "@/components/dashboard/IncubatorPanel";
import { DeveloperPanel } from "@/components/dashboard/DeveloperPanel";
import { EdgePanel } from "@/components/dashboard/EdgePanel";
import { JulesPanel } from "@/components/dashboard/JulesPanel";
import { MarketWatcherConfig } from "@/components/dashboard/MarketWatcherConfig";
import { InvoiceSyncWidget } from "@/components/dashboard/InvoiceSyncWidget";
import { InvoiceAutomationWidget } from "@/components/dashboard/InvoiceAutomationWidget";
import { LeadMiningWidget } from "@/components/dashboard/LeadMiningWidget";
import { TrackGenerator } from "@/components/dashboard/TrackGenerator";
import { ConductorTracksMonitor } from "@/components/dashboard/ConductorTracksMonitor";
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
import { HROnboardingWidget } from "@/components/dashboard/HROnboardingWidget"; import { ViktoriaPhygitalPanel } from "@/components/dashboard/ViktoriaPhygitalPanel"; import { GrantManager } from "@/components/GrantManager";
import { LawDetectiveWidget } from "@/components/dashboard/LawDetectiveWidget";
import { BookkeepingWidget } from "@/components/dashboard/BookkeepingWidget";
import { HazipenztarWidget } from "@/components/dashboard/HazipenztarWidget";
import { FinanceReconciliationPanel } from "@/components/dashboard/FinanceReconciliationPanel";
import { PropertyVisionaryWidget } from "@/components/dashboard/PropertyVisionaryWidget";
import { PropertySalesWidget } from "@/components/dashboard/PropertySalesWidget";
import { LeadsMasterMonitor } from "@/components/dashboard/LeadsMasterMonitor";
import { PayrollDashboard } from "@/components/payroll/PayrollDashboard";
import { TrojanHorseCommandCenter } from "@/components/dashboard/TrojanHorseCommandCenter";
import { AutonomousInfraPanel } from "@/components/dashboard/AutonomousInfraPanel";
import { ShowcasePage } from "@/pages/ShowcasePage";
import { GuardrailsPanel } from "@/components/dashboard/GuardrailsPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { MemoryPanel } from "@/components/dashboard/MemoryPanel";
import { WorkflowPanel } from "@/components/dashboard/WorkflowPanel";
import { AgentDiagnosticsPanel } from "@/components/dashboard/AgentDiagnosticsPanel";
import { AgentRegistryHealthPanel } from "@/components/dashboard/AgentRegistryHealthPanel";
import { DocsSotPanel } from "@/components/dashboard/DocsSotPanel";
import { ConfigHealthPanel } from "@/components/dashboard/ConfigHealthPanel";
import { OpenClawIntegrationPanel } from "@/components/dashboard/OpenClawIntegrationPanel";
import { PhoenixFlywheelObservabilityPanel } from "@/components/dashboard/PhoenixFlywheelObservabilityPanel";
import { HookMonitorPanel } from "@/components/dashboard/HookMonitorPanel";
import { MissionPlannerPanel } from "@/components/dashboard/MissionPlannerPanel";
import { TestPlanPanel } from "@/components/dashboard/TestPlanPanel";
import { KKVPackCockpit } from "@/components/dashboard/KKVPackCockpit";
import { HRTimesheetStatusPanel } from "@/components/dashboard/HRTimesheetStatusPanel";
import { AssistantBlueprintPanel } from "@/components/dashboard/AssistantBlueprintPanel";
import SwarmPanel from "@/components/dashboard/SwarmPanel";
import ToolDiscoveryPanel from "@/components/dashboard/ToolDiscoveryPanel";
import SecurityPanel from "@/components/dashboard/SecurityPanel";
import { Crawl4AIPanel } from "@/components/dashboard/Crawl4AIPanel";
import { IntelligenceMonitorPanel } from "@/components/dashboard/IntelligenceMonitorPanel";
import { WorldPerceptionPanel } from "@/components/dashboard/WorldPerceptionPanel";
import { UserPreferencesPanel } from "@/components/dashboard/UserPreferencesPanel";
import LLMObservabilityPanel from "@/components/dashboard/LLMObservabilityPanel";
import { CopilotCommanderPanel } from "@/components/dashboard/CopilotCommanderPanel";
import { CopilotOrchestratorPanel } from "@/components/dashboard/CopilotOrchestratorPanel";
import { PredictiveDecisionPanel } from "@/components/dashboard/PredictiveDecisionPanel";
import { KernelPipelinePanel } from "@/components/dashboard/KernelPipelinePanel";
import { RemoteConsolePanel } from "@/components/dashboard/RemoteConsolePanel";
import { ZeroPromptNotificationPanel } from "@/components/dashboard/ZeroPromptNotificationPanel";
import { EphemeralAgentsPanel } from "@/components/dashboard/EphemeralAgentsPanel";
import { LearningLoopPanel } from "@/components/dashboard/LearningLoopPanel";
import { SelfImprovementPanel } from "@/components/dashboard/SelfImprovementPanel";
import { PSalesIntakePanel } from "@/components/dashboard/PSalesIntakePanel";
import { PSalesResearchPanel } from "@/components/dashboard/PSalesResearchPanel";
import { PSalesStrategyPanel } from "@/components/dashboard/PSalesStrategyPanel";
import { FederationCenter } from "@/components/FederationCenter";
import { AdminSelfCheckWidget } from "@/components/dashboard/AdminSelfCheckWidget";
import { CognitiveMemoryPanel } from "@/components/dashboard/CognitiveMemoryPanel";
import { TraceViewer } from "@/components/dashboard/TraceViewer";
import { LogViewer } from "@/components/dashboard/LogViewer";
import { AuditPanel } from "@/components/dashboard/AuditPanel";
import { ModelRouterPanel } from "@/components/dashboard/ModelRouterPanel";
import { ScheduledTasksPanel } from "@/components/dashboard/ScheduledTasksPanel";
import { SpecManagerPanel } from "@/components/dashboard/SpecManagerPanel";
import { VectorizeAnalyticsWidget } from "@/components/dashboard/VectorizeAnalyticsWidget";
import { AgentFactory } from "@/components/dashboard/AgentFactory";
import { AgentToolsManager } from "@/components/dashboard/AgentToolsManager";
import { HarvestPipelineWidget } from "@/components/dashboard/HarvestPipelineWidget";
import { ProcessControlWidget } from "@/components/dashboard/ProcessControlWidget";
import { ServiceControlWidget } from "@/components/dashboard/ServiceControlWidget";
import { ProjectExplorer } from "@/components/dashboard/ProjectExplorer";
import { AIAgentBriefingPanel } from "@/components/dashboard/AIAgentBriefingPanel";
import { AnythingLLMActionBridgePanel } from "@/components/dashboard/AnythingLLMActionBridgePanel";
import { RemoteOperationsPanel } from "@/components/dashboard/RemoteOperationsPanel";
import { logInfo } from "@/utils/logger";
import { CONDUCTOR_MONITOR_NAV, PROJECT_MGMT_NAV_GROUP } from "./navigationContract.js";

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

  reset ()
  {
    this.items.clear();
    this.groups = [];
  }

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
  navigationRegistry.reset();

  // Register all items
  const items: NavItem[] = [
    { id: "remote-operations", label: "Remote Operations", icon: Target, component: <RemoteOperationsPanel /> },
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
    { id: "phoenix-flywheel", label: "Phoenix / Flywheel", icon: Activity, component: <PhoenixFlywheelObservabilityPanel /> },
    { id: "zero-prompt-notifications", label: "Approval Notifications", icon: Bell, component: <ZeroPromptNotificationPanel /> },
    { id: "ephemeral-agents", label: "Ephemeral Agents", icon: Zap, component: <EphemeralAgentsPanel /> },
    { id: "learning-loop", label: "Learning Loop", icon: Brain, component: <LearningLoopPanel /> },
    { id: "self-improvement", label: "Self Improvement", icon: Sparkles, component: <SelfImprovementPanel /> },
    { id: "hook-monitor", label: "Hook Monitor", icon: Activity, component: <HookMonitorPanel /> },
    { id: "federation", label: "Federated MCP", icon: Globe, component: <FederationCenter /> },
    { id: "management", label: "Agent Roster", icon: Sparkles, component: <AgentManagementPanel /> },
    { id: "agent-diagnostics", label: "Agent Diagnostics", icon: Gauge, component: <AgentDiagnosticsPanel /> },
    { id: "agent-registry-governance", label: "Registry Governance", icon: ClipboardList, component: <AgentRegistryHealthPanel /> },
    { id: "docs-config-sot", label: "Docs / Config SOT", icon: FileText, component: <DocsSotPanel /> },
    { id: "config-health", label: "Config Health", icon: Shield, component: <ConfigHealthPanel /> },
    { id: "openclaw-bridge", label: "OpenClaw Bridge", icon: Shield, component: <OpenClawIntegrationPanel /> },
    { id: "mission-devex", label: "Mission Planner", icon: Workflow, component: <MissionPlannerPanel /> },
    { id: "test-cadence-devex", label: "Test Cadence", icon: Gauge, component: <TestPlanPanel /> },
    { id: "decomposer", label: "Decompose", icon: Layers, component: <TaskDecomposerPanel /> },
    { id: "tracks", label: "Track generátor", icon: History, component: <TrackGenerator /> },
    { id: CONDUCTOR_MONITOR_NAV.id, label: CONDUCTOR_MONITOR_NAV.label, icon: ClipboardList, component: <ConductorTracksMonitor /> },
    { id: "incubator", label: "Incubator", icon: FlaskConical, component: <IncubatorPanel /> },
    { id: "knowledge", label: "Neural Knowledge", icon: Brain, component: <KnowledgeBasePanel /> },
    { id: "memory", label: "Agent Memory", icon: Database, component: <MemoryPanel /> },
    { id: "anythingllm-bridge", label: "AnythingLLM Bridge", icon: Zap, component: <AnythingLLMActionBridgePanel /> },
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
    { id: "browser-copilot", label: "Browser Copilot", icon: MessageSquare, component: <BrowserCopilotPanel /> },
    { id: "tasks", label: "Task Queue", icon: History, component: <TaskQueueMonitor /> },
    { id: "workflow-engine", label: "Workflow Engine", icon: Workflow, component: <WorkflowPanel /> },
    { id: "python-workers", label: "Python Workers", icon: Cpu, component: <PythonWorkersPanel /> },
    { id: "inventory", label: "Assets", icon: Box, component: <InventoryCatalog /> },
    { id: "kkv-pack", label: "KKV Pack", icon: PackageSearch, component: <KKVPackCockpit /> },
    { id: "files", label: "Filesystem", icon: FolderOpen, component: <FileExplorer /> },
    // { id: "projects", label: "Projektek", icon: FolderOpen, component: <ProjectExplorer /> },
    { id: "enterprise-suite", label: "Enterprise Suite", icon: Briefcase, component: <EnterpriseSuitePanel /> },
    { id: "hr-timesheet", label: "HR Timesheet", icon: ClipboardList, component: <HRTimesheetStatusPanel /> },
    { id: "payroll", label: "Bérszemfejtő", icon: DollarSign, component: <PayrollDashboard /> },
    { id: "studio", label: "Brunella Studio", icon: Palette, component: <BrunellaStudio /> },
    { id: "campaign-studio", label: "Kampány Stúdió", icon: DollarSign, component: <CampaignStudio /> },
    { id: "innovation-bridge", label: "Innovation Bridge", icon: Lightbulb, component: <InnovationBridgeWidget /> },
    { id: "invoice-sync", label: "Számla Szinkron", icon: Receipt, component: <InvoiceSyncWidget /> },
    { id: "invoice-automation", label: "Számla Automatizálás", icon: Receipt, component: <InvoiceAutomationWidget /> },
    { id: "bookkeeping", label: "Könyvelés", icon: BarChart3, component: <BookkeepingWidget /> },
    { id: "finance-reconciliation", label: "Pénzügyi Egyeztetés", icon: Receipt, component: <FinanceReconciliationPanel /> },
    { id: "kp-penztar", label: "Házipénztár", icon: Wallet, component: <HazipenztarWidget /> },
    { id: "lead-mining", label: "Lead Mining", icon: Target, component: <LeadMiningWidget /> },
    { id: "leads-master", label: "Leads Monitor", icon: DollarSign, component: <LeadsMasterMonitor /> },
    { id: "trojan-horse", label: "Trójai Faló", icon: ShieldAlert, component: <TrojanHorseCommandCenter /> },
    { id: "lead-monitor", label: "Lead Monitor", icon: Activity, component: <LeadsMasterMonitor /> },
    { id: "property-sales", label: "Ingatlan Értékesítés", icon: Building2, component: <PropertySalesWidget /> },
    { id: "psales-intake", label: "P-Sales Intake", icon: ClipboardList, component: <PSalesIntakePanel /> },
    { id: "psales-research", label: "P-Sales Kutatás", icon: Search, component: <PSalesResearchPanel /> },
    { id: "psales-strategy", label: "P-Sales Stratégia", icon: Target, component: <PSalesStrategyPanel /> },
    { id: "demo-factory", label: "Demo Gyár", icon: FlaskConical, component: <IncubatorPanel /> },
    { id: "showcase", label: "AI Showcase", icon: Sparkles, component: <ShowcasePage /> },
    { id: "jules", label: "Jules AI", icon: Zap, component: <JulesPanel /> },
    { id: "viktoria-phygital", label: "Viktoria Phygital", icon: Sparkles, component: <ViktoriaPhygitalPanel /> },
    { id: "digital-hr", label: "Digital HR", icon: Briefcase, component: <DigitalHRWidget /> },
    { id: "hr-onboarding", label: "HR Onboarding", icon: Workflow, component: <HROnboardingWidget /> },
    { id: "grant-hunter", label: "Pályázatfigyelő", icon: Search, component: <GrantManager /> },
    { id: "law-detective", label: "Law Detective", icon: Shield, component: <LawDetectiveWidget /> },
    { id: "property-visionary", label: "Property Visionary", icon: Box, component: <PropertyVisionaryWidget /> },
    { id: "marketwatcher", label: "Market Watcher", icon: Activity, component: <MarketWatcherConfig /> },
    { id: "settings", label: "System Config", icon: Settings, component: <SettingsPanel /> },
    { id: "guardrails", label: "Guardrails", icon: ShieldAlert, component: <GuardrailsPanel /> },
    { id: "telemetry", label: "Telemetria", icon: Gauge, component: <TelemetryPanel /> },
    { id: "chrome-acp", label: "Chrome ACP", icon: Code2, component: <EmbeddedWorkflow title="Chrome ACP Browser" url="http://localhost:9315" icon={<Code2 size={20} />} allowSameOrigin={true} /> },
    { id: "n8n", label: "n8n Automation", icon: Workflow, component: <EmbeddedWorkflow title="n8n Automation" url="http://localhost:5678" icon={<Workflow size={20} />} /> },
    { id: "langflow", label: "Langflow Orchestration", icon: Sparkles, component: <EmbeddedWorkflow title="Langflow Orchestration" url="http://localhost:3000" icon={<Sparkles size={20} />} /> },
    { id: "vscode", label: "VSCode Stream", icon: Code2, component: <EmbeddedWorkflow title="VSCode — Brunella Workspace" url="http://localhost:8080" icon={<Code2 size={20} />} allowSameOrigin={true} /> },
    { id: "swarm-panel", label: "Swarm Intelligence", icon: Users, component: <SwarmPanel /> },
    { id: "tool-discovery", label: "Tool Discovery", icon: Wrench, component: <ToolDiscoveryPanel /> },
    { id: "security-panel", label: "Security Monitor", icon: Shield, component: <SecurityPanel /> },
    { id: "crawl4ai", label: "Crawl4AI", icon: Search, component: <Crawl4AIPanel /> },
    { id: "intelligence-monitor", label: "Intelligence Monitor", icon: Database, component: <IntelligenceMonitorPanel /> },
    { id: "predictive-decision", label: "Predictive Decision", icon: Lightbulb, component: <PredictiveDecisionPanel /> },
    { id: "world-perception", label: "World Perception", icon: Globe, component: <WorldPerceptionPanel /> },
    { id: "user-preferences", label: "Felhasználói Memória", icon: Database, component: <UserPreferencesPanel /> },
    { id: "llm-observability", label: "LLM Observability", icon: BarChart3, component: <LLMObservabilityPanel /> },
    { id: "copilot-commander", label: "Copilot Commander", icon: Terminal, component: <CopilotCommanderPanel /> },
    { id: "kernel-pipeline", label: "Kernel Pipeline", icon: Layers, component: <KernelPipelinePanel /> },
    { id: "copilot-orchestrator", label: "Copilot Orchestrator", icon: Rocket, component: <CopilotOrchestratorPanel /> },
    { id: "remote-console", label: "Remote Layer", icon: Target, component: <RemoteConsolePanel /> },
    { id: "admin-check", label: "Admin Self-Check", icon: Shield, component: <AdminSelfCheckWidget /> },
    { id: "cognitive-memory", label: "Cognitive Memory", icon: Brain, component: <CognitiveMemoryPanel /> },
    { id: "trace-viewer", label: "Trace Viewer", icon: Search, component: <TraceViewer /> },
    { id: "log-viewer", label: "System Logs", icon: FileText, component: <LogViewer /> },
    { id: "audit-log", label: "Audit Trail", icon: ClipboardList, component: <AuditPanel /> },
    { id: "model-router", label: "Model Router", icon: Network, component: <ModelRouterPanel /> },
    { id: "scheduled-tasks", label: "Scheduled", icon: History, component: <ScheduledTasksPanel /> },
    { id: "spec-manager", label: "Spec Manager", icon: Settings, component: <SpecManagerPanel /> },
    { id: "vector-stats", label: "Vector Analytics", icon: BarChart3, component: <VectorizeAnalyticsWidget /> },
    { id: "agent-factory", label: "Agent Factory", icon: Sparkles, component: <AgentFactory /> },
    { id: "tools-manager", label: "Tool Manager", icon: Wrench, component: <AgentToolsManager /> },
    { id: "agent-tool-catalog", label: "Agent & Tool Catalog", icon: Rocket, component: <AgentToolCatalog /> },
    { id: "harvest-pipeline", label: "Harvest Pipeline", icon: Activity, component: <HarvestPipelineWidget /> },
    { id: "process-control", label: "Process Control", icon: Gauge, component: <ProcessControlWidget /> },
    { id: "service-control", label: "Service Control", icon: Settings, component: <ServiceControlWidget /> },
    { id: "ai-agent-briefing", label: "Napi AI Összefoglaló", icon: Brain, component: <AIAgentBriefingPanel /> },
  ];

  items.forEach( item => navigationRegistry.registerItem( item ) );

  // Register groups
  navigationRegistry.registerGroup( { title: "Core Systems", icon: Layers, items: ["dashboard", "neural-map", "system-arch", "studio", "vscode", "process-control", "service-control"] } );
  navigationRegistry.registerGroup( { title: "AI & Agents", icon: Brain, items: ["chat", "paios", "copilot-orchestrator", "copilot-commander", "kernel-pipeline", "assistant-blueprint", "phoenix", "phoenix-flywheel", "zero-prompt-notifications", "ephemeral-agents", "learning-loop", "self-improvement", "predictive-decision", "world-perception", "federation", "management", "agent-diagnostics", "agent-registry-governance", "agent-factory", "decomposer", "incubator", "knowledge", "memory", "cognitive-memory", "user-preferences", "developer", "edge", "robotkez", "browser-copilot", "jules", "viktoria-phygital", "ai-agent-briefing"] } );
  navigationRegistry.registerGroup( { title: "Enterprise", icon: Briefcase, items: ["enterprise-suite", "digital-hr", "payroll", "hr-timesheet", "hr-onboarding", "grant-hunter", "law-detective", "property-visionary", "property-sales", "psales-intake", "psales-research", "psales-strategy", "enterprise-analytics", "intelligence-monitor"] } );
  navigationRegistry.registerGroup( { title: "Értékesítési Központ", icon: DollarSign, items: ["trojan-horse", "lead-monitor", "demo-factory", "showcase", "campaign-studio", "leads-master", "innovation-bridge", "invoice-sync", "invoice-automation", "bookkeeping", "finance-reconciliation", "kp-penztar", "lead-mining", "marketwatcher", "inventory"] } );
  navigationRegistry.registerGroup( { title: "KKV Pack", icon: PackageSearch, items: ["kkv-pack"] } );
  navigationRegistry.registerGroup( { title: "Orchestration", icon: Rocket, items: ["cean", "cloudflare", "fleet_manager", "autonomy", "tasks", "workflow-engine", "swarm-panel", "tool-discovery", "tools-manager", "crawl4ai", "harvest-pipeline"] } );
  navigationRegistry.registerGroup( { title: "Orchestration", icon: Rocket, items: ["cean", "cloudflare", "fleet_manager", "autonomy", "tasks", "workflow-engine", "swarm-panel", "tool-discovery", "tools-manager", "crawl4ai", "harvest-pipeline", "openclaw-bridge"] } );
  navigationRegistry.registerGroup( { title: PROJECT_MGMT_NAV_GROUP.title, icon: FileText, items: [...PROJECT_MGMT_NAV_GROUP.items] } );
  navigationRegistry.registerGroup( { title: "System", icon: Settings, items: ["remote-operations", "python-workers", "files", "guardrails", "telemetry", "llm-observability", "security-panel", "chrome-acp", "settings", "n8n", "langflow", "remote-console", "admin-check", "trace-viewer", "log-viewer", "audit-log", "hook-monitor", "model-router", "scheduled-tasks", "vector-stats"] } );

  logInfo( "NavigationRegistry", "Navigation Registry Initialized." );
}
