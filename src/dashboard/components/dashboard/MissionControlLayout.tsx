import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Box,
  MessageSquare,
  Workflow,
  Sparkles,
  FolderOpen,
  Settings,
  Activity,
  Terminal,
  Brain,
  FileText,
  Rocket,
  History,
  Network,
  Cpu,
  FlaskConical,
  Code2,
  Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { SystemHealthCard } from "@/components/dashboard/SystemHealthCard"; // Swapped
import { InventoryCatalog } from "@/components/dashboard/InventoryCatalog";
import { NeuralLinkChat } from "@/components/dashboard/NeuralLinkChat";
import { EmbeddedWorkflow } from "@/components/dashboard/EmbeddedWorkflow";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { FileExplorer } from "@/components/dashboard/FileExplorer";
import { useSocket } from "@/context/SocketContext";
import {
  getRegistry,
  executeAgent,
  type RegistryAgent,
} from "@/lib/apiService";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandMenu } from "@/components/CommandMenu";
import { AgentGraph } from "@/components/AgentGraph";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentFactory } from "@/components/dashboard/AgentFactory";
import { RobotkezPanel } from "@/components/dashboard/RobotkezPanel";
import { AgentManagementPanel } from "@/components/dashboard/AgentManagementPanel";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
import { LLMProvidersPanel } from "@/components/dashboard/LLMProvidersPanel";
import { KnowledgeBasePanel } from "@/components/dashboard/KnowledgeBasePanel";
import { IncubatorPanel } from "@/components/dashboard/IncubatorPanel";
import { DeveloperPanel } from "@/components/dashboard/DeveloperPanel";
import { EdgePanel } from "@/components/dashboard/EdgePanel";
import { JulesPanel } from "./JulesPanel";
import { TrackGenerator } from "./TrackGenerator";
import { TaskDecomposerPanel } from "./TaskDecomposerPanel";
import { TrackProgressWidget } from "./TrackProgress";
import { TestResultsWidget } from "./TestResultsWidget";
import { SuggestedTasksWidget } from "./SuggestedTasksWidget";

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Mission Control", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "management", label: "Agents", icon: Sparkles },
  { id: "decomposer", label: "Decompose", icon: Network },
  { id: "tracks", label: "Tracks", icon: Rocket },
  { id: "incubator", label: "Incubator", icon: FlaskConical },
  { id: "knowledge", label: "Knowledge", icon: Brain },
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "edge", label: "Edge", icon: Cloud },
  { id: "suggested-tasks", label: "Todos", icon: FileText },
  { id: "tests", label: "Tests", icon: FlaskConical },
  { id: "robotkez", label: "Robotkéz", icon: Activity },
  { id: "tasks", label: "Tasks", icon: History },
  { id: "inventory", label: "Assets", icon: Box },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

const DEFAULT_MEMORY_CONTEXT: MemoryFile[] = [
  { id: "1", name: "project_context.md", size: "12kb", type: "text/markdown" },
  { id: "2", name: "api_specs.yaml", size: "45kb", type: "application/yaml" },
  {
    id: "3",
    name: "user_preferences.json",
    size: "2kb",
    type: "application/json",
  },
];

interface MemoryFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

type AgentStatus = "working" | "idle" | "error" | "offline";

const N8N_URL = "http://localhost:5678";
const LANGFLOW_URL = "http://localhost:3000";

export function MissionControlLayout() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [viewMode, setViewMode] = useState<"list" | "graph">("graph");
  const [registryAgents, setRegistryAgents] = useState<RegistryAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const { logs, agents, isConnected } = useSocket();

  useEffect(() => {
    setIsLoadingAgents(true);
    getRegistry()
      .then((r) => setRegistryAgents(r.agents || []))
      .catch(() => setRegistryAgents([]))
      .finally(() => setIsLoadingAgents(false));
  }, []);

  const socketStatusMap = new Map<
    string,
    { status: string; taskDescription?: string }
  >(
    Array.from(agents.entries()).map(([name, data]: [string, any]) => [
      name,
      data,
    ]),
  );
  const agentsToShow = registryAgents;

  const handleExecuteAgent = async (agentName: string, task: string) => {
    try {
      toast.info(`${agentName} futtatása...`);
      const result = await executeAgent(agentName, task);
      toast.success(
        typeof result === "string"
          ? result.slice(0, 100) + (result.length > 100 ? "..." : "")
          : "Kész",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Hiba");
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground antialiased overflow-hidden flex flex-col">
      <CommandMenu setActiveTab={setActiveTab} activeTab={activeTab} />

      {/* Header */}
      <header className="flex h-14 items-center gap-4 border-b bg-background/50 px-6 backdrop-blur-lg lg:h-[60px]">
        <div className="flex flex-1 items-center gap-2 font-semibold">
          <span className="text-primary">Brunella</span>
          <span className="text-muted-foreground">/</span>
          <span>Mission Control</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[60px] lg:w-[240px] border-r bg-background/50 backdrop-blur-lg flex flex-col">
          <div className="flex-1 py-4">
            <nav className="grid gap-1 px-2">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted",
                    activeTab === item.id &&
                      "bg-muted text-primary font-medium",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Center Content */}
        <main className="flex-1 overflow-auto p-6 scroll-smooth">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_320px]">
            {/* Primary Column */}
            <div className="space-y-6">
              {activeTab === "dashboard" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-space font-bold text-foreground">
                      <Activity size={20} className="text-primary" />
                      Active Neural Agents ({agentsToShow.length})
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode("list")}
                        className={cn(
                          "px-3 py-1 text-xs rounded-md border transition-colors",
                          viewMode === "list"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        List
                      </button>
                      <button
                        onClick={() => setViewMode("graph")}
                        className={cn(
                          "px-3 py-1 text-xs rounded-md border transition-colors",
                          viewMode === "graph"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        Graph
                      </button>
                    </div>
                  </div>

                  {viewMode === "graph" ? (
                    <AgentGraph />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {isLoadingAgents ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="space-y-3">
                            <Skeleton className="h-[125px] w-full rounded-xl" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-[250px]" />
                              <Skeleton className="h-4 w-[200px]" />
                            </div>
                          </div>
                        ))
                      ) : agentsToShow.length > 0 ? (
                        agentsToShow.map((agent) => {
                          const socketData = socketStatusMap.get(agent.name);
                          return (
                            <div
                              key={agent.name}
                              className="hover:scale-[1.02] transition-transform duration-200"
                            >
                              <AgentStatusCard
                                agent={agent}
                                status={(socketData?.status as any) || "idle"}
                                taskDescription={socketData?.taskDescription}
                                onExecute={handleExecuteAgent}
                                allAgents={registryAgents}
                              />
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full p-8 text-center glass-panel rounded-xl border-dashed border-2 border-white/10">
                          <Brain
                            size={48}
                            className="mx-auto text-muted-foreground/20 mb-4"
                          />
                          <h3 className="text-lg font-medium text-muted-foreground">
                            No Agents Online
                          </h3>
                          <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto mt-2">
                            Start an agent from the CLI or check your
                            configuration.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <JulesPanel />
                    <div className="glass-card rounded-xl p-1 h-full">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
                        <Terminal size={18} className="text-muted-foreground" />
                        <h2 className="text-sm font-medium text-muted-foreground">
                          System Terminals
                        </h2>
                      </div>
                      <div className="p-2">
                        <TerminalLog logs={logs} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "developer" && <DeveloperPanel />}
              {activeTab === "edge" && <EdgePanel />}
              {activeTab === "decomposer" && <TaskDecomposerPanel />}
              {activeTab === "tracks" && <TrackGenerator />}
              {activeTab === "inventory" && <InventoryCatalog />}
              {activeTab === "chat" && <NeuralLinkChat />}
              {activeTab === "incubator" && <IncubatorPanel />}
              {activeTab === "n8n" && (
                <EmbeddedWorkflow
                  title="n8n Automation"
                  url={N8N_URL}
                  icon={<Workflow size={20} className="text-[#FF6D5A]" />}
                />
              )}
              {activeTab === "langflow" && (
                <EmbeddedWorkflow
                  title="Langflow Orchestration"
                  url={LANGFLOW_URL}
                  icon={<Sparkles size={20} className="text-violet-500" />}
                />
              )}
              {activeTab === "factory" && <AgentFactory />}
              {activeTab === "management" && <AgentManagementPanel />}
              {activeTab === "robotkez" && <RobotkezPanel />}
              {activeTab === "tasks" && <TaskQueueMonitor />}
              {activeTab === "providers" && <LLMProvidersPanel />}
              {activeTab === "knowledge" && <KnowledgeBasePanel />}
              {activeTab === "files" && <FileExplorer />}
              {activeTab === "tests" && <TestResultsWidget />}
              {activeTab === "suggested-tasks" && <SuggestedTasksWidget />}
              {activeTab === "settings" && <SettingsPanel />}
            </div>

            {/* Right Column: Widgets */}
            <div className="space-y-6 lg:sticky lg:top-6 h-fit">
              <SystemHealthCard />

              <TrackProgressWidget />

              <Card className="glass-card border-white/10 overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-muted-foreground">
                    <Brain size={16} className="text-cyan-400" />
                    Short-term Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <ul className="divide-y divide-border/50">
                      {DEFAULT_MEMORY_CONTEXT.map((file: MemoryFile) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText
                              size={16}
                              className="text-muted-foreground group-hover:text-primary transition-colors"
                            />
                            <span className="truncate text-sm font-mono text-foreground/80 group-hover:text-foreground transition-colors">
                              {file.name}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-mono text-muted-foreground">
                            {file.size}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
