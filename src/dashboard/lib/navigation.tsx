import React from "react";
import { 
  LayoutDashboard, Network, Rocket, Cloud, Cpu, MessageSquare, 
  Sparkles, Layers, History, FlaskConical, Brain, Shield, Code2, 
  Zap, FileText, Gauge, Activity, Box, FolderOpen, Settings, Workflow
} from "lucide-react";

// Component Imports
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { RobotkezV2Chat } from "@/components/dashboard/RobotkezV2Chat";
import { AgentManagementPanel } from "@/components/dashboard/AgentManagementPanel";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { KnowledgeBasePanel } from "@/components/dashboard/KnowledgeBasePanel";
import { IncubatorPanel } from "@/components/dashboard/IncubatorPanel";
import { DeveloperPanel } from "@/components/dashboard/DeveloperPanel";
import { EdgePanel } from "@/components/dashboard/EdgePanel";
import { JulesPanel } from "@/components/dashboard/JulesPanel";
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
  console.log("Initializing Navigation Registry...");
  
  // Register all items
  const items: NavItem[] = [
    { id: "dashboard", label: "Mission Control", icon: LayoutDashboard, component: null },
    { id: "neural-map", label: "Neural Map", icon: Network, component: <NeuralMap /> },
    { id: "cean", label: "CEAN Orchestrator", icon: Rocket, component: <CEANLayout /> },
    { id: "cloudflare", label: "Cloudflare Deploy", icon: Cloud, component: <CloudflareDeployment /> },
    { id: "fleet_manager", label: "Fleet Manager", icon: Cpu, component: <FleetManager /> },
    { id: "chat", label: "Neural Chat", icon: MessageSquare, component: <NeuralLinkChat /> },
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
    { id: "robotkez", label: "Robotkéz", icon: Activity, component: <RobotkezV2Chat /> },
    { id: "tasks", label: "Task Queue", icon: History, component: <TaskQueueMonitor /> },
    { id: "inventory", label: "Assets", icon: Box, component: <InventoryCatalog /> },
    { id: "files", label: "Filesystem", icon: FolderOpen, component: <FileExplorer /> },
    { id: "settings", label: "System Config", icon: Settings, component: <SettingsPanel /> },
    { id: "n8n", label: "n8n Automation", icon: Workflow, component: <EmbeddedWorkflow title="n8n Automation" url="http://localhost:5678" icon={<Workflow size={20} />} /> },
    { id: "langflow", label: "Langflow Orchestration", icon: Sparkles, component: <EmbeddedWorkflow title="Langflow Orchestration" url="http://localhost:3000" icon={<Sparkles size={20} />} /> }
  ];

  items.forEach(item => navigationRegistry.registerItem(item));

  // Register groups
  navigationRegistry.registerGroup({ title: "Core Systems", icon: Layers, items: ["dashboard", "neural-map"] });
  navigationRegistry.registerGroup({ title: "AI & Agents", icon: Brain, items: ["chat", "management", "decomposer", "incubator", "knowledge", "developer", "edge", "robotkez"] });
  navigationRegistry.registerGroup({ title: "Orchestration", icon: Rocket, items: ["cean", "cloudflare", "fleet_manager", "tasks"] });
  navigationRegistry.registerGroup({ title: "Project Mgmt", icon: FileText, items: ["tracks", "suggested-tasks", "tests"] });
  navigationRegistry.registerGroup({ title: "System", icon: Settings, items: ["inventory", "files", "settings", "n8n", "langflow"] });

  console.log("Navigation Registry Initialized.");
}
