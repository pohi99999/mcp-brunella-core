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
  Layers,
  Zap,
  Shield,
  Gauge,
  Ghost,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentStatusCard } from "@/components/dashboard/AgentStatusCard";
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { SystemHealthCard } from "@/components/dashboard/SystemHealthCard";
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
import { RobotkezV2Chat } from "@/components/dashboard/RobotkezV2Chat";
import { AgentManagementPanel } from "@/components/dashboard/AgentManagementPanel";
import { TaskQueueMonitor } from "@/components/dashboard/TaskQueueMonitor";
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
import { InvoiceSyncWidget } from "./InvoiceSyncWidget";
import { CEANLayout } from "@/components/cean/CEANLayout";
import { CloudflareDeployment } from "@/pages/CloudflareDeployment";
import FleetManager from "@/pages/FleetManager";
import { SystemBootSequence } from "@/components/SystemBootSequence";

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Mission Control", icon: LayoutDashboard },
  { id: "cean", label: "CEAN Orchestrator", icon: Rocket },
  { id: "cloudflare", label: "Cloudflare Deploy", icon: Cloud },
  { id: "fleet_manager", label: "Fleet Manager", icon: Cpu },
  { id: "chat", label: "Neural Chat", icon: MessageSquare },
  { id: "management", label: "Agent Roster", icon: Sparkles },
  { id: "decomposer", label: "Decompose", icon: Network },
  { id: "tracks", label: "Tracks", icon: History },
  { id: "incubator", label: "Incubator", icon: FlaskConical },
  { id: "knowledge", label: "Neural Knowledge", icon: Brain },
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "edge", label: "Edge", icon: Cloud },
  { id: "suggested-tasks", label: "Suggested", icon: FileText },
  { id: "tests", label: "Precision Tests", icon: Gauge },
  { id: "robotkez", label: "Robotkéz", icon: Activity },
  { id: "tasks", label: "Task Queue", icon: History },
  { id: "inventory", label: "Assets", icon: Box },
  { id: "files", label: "Filesystem", icon: FolderOpen },
  { id: "settings", label: "System Config", icon: Settings },
];

export function MissionControlLayout() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [viewMode, setViewMode] = useState<"list" | "graph">("graph");
  const [registryAgents, setRegistryAgents] = useState<RegistryAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isBooting, setIsBooting] = useState(true);
  const { logs, agents } = useSocket();

  useEffect(() => {
    setIsLoadingAgents(true);
    getRegistry()
      .then((r) => setRegistryAgents(r.agents || []))
      .catch(() => setRegistryAgents([]))
      .finally(() => setIsLoadingAgents(false));
  }, []);

  // useSocket's agents is Map<string, AgentStatusEntry>
  const socketStatusMap = agents;

  const handleExecuteAgent = async (agentName: string, task: string) => {
    try {
      toast.info(`${agentName} initiating protocol...`);
      await executeAgent(agentName, task);
      toast.success("Protocol execution verified");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "System failure");
    }
  };

  return (
    <>
      {isBooting && <SystemBootSequence onComplete={() => setIsBooting(false)} />}
      
      <div className={cn("min-h-screen max-h-screen flex flex-col overflow-hidden transition-opacity duration-1000 bg-[#020205] bg-grid-pattern", isBooting ? "opacity-0" : "opacity-100")}>
        <CommandMenu setActiveTab={setActiveTab} activeTab={activeTab} />

        {/* Top Header - Glass Submerged */}
        <header className="h-16 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30">
                <Zap size={18} className="text-primary animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tighter text-white uppercase italic">Brunella Cortex</span>
                <span className="text-[10px] font-mono text-primary/60 tracking-widest leading-none">NEURAL NETWORK OS v2.3.0</span>
              </div>
            </div>
            
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            
            <nav className="hidden md:flex items-center gap-1">
               <span className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer px-2 py-1 rounded">SYS_LOG</span>
               <span className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer px-2 py-1 rounded">NET_STAT</span>
               <span className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer px-2 py-1 rounded">DATA_FLUX</span>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
               <span className="text-[10px] font-mono font-bold text-zinc-400">CORE_SYNC_READY</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Global Body Container */}
        <div className="flex-1 flex overflow-hidden px-6 pb-4 pt-2 gap-6 relative z-0 min-h-0">
          
          {/* Cyber Sidebar */}
          <aside className="w-[64px] lg:w-[260px] flex flex-col gap-4 py-4 z-10 transition-all duration-300 shrink-0">
            <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden border-white/5">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                 <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase hidden lg:inline">Primary Menu</span>
                 <Layers size={14} className="text-zinc-500" />
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative",
                      activeTab === item.id 
                        ? "bg-primary/20 text-white border border-primary/30" 
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                    )}
                  >
                    <item.icon size={18} className={cn(
                      "shrink-0 transition-transform duration-300 group-hover:scale-110",
                      activeTab === item.id ? "text-primary" : "text-zinc-500"
                    )} />
                    <span className="hidden lg:inline text-xs font-medium font-space tracking-wide">{item.label}</span>
                    
                    {activeTab === item.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
                    <Shield size={14} className="text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0 hidden lg:flex">
                    <span className="text-[10px] font-bold text-white truncate uppercase">Master Admin</span>
                    <span className="text-[9px] font-mono text-emerald-500/80">AUTHORIZED</span>
                  </div>
                </div>
                <button className="w-full text-[10px] font-bold text-zinc-500 hover:text-white transition-colors flex items-center justify-between py-1 border-t border-white/5 pt-3">
                   <span>DISCONNECT</span>
                   <Ghost size={12} />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Area - Glass Floating */}
          <main className="flex-1 min-w-0 glass-panel rounded-2xl border-white/5 relative z-10 flex flex-col overflow-hidden bg-black/20">
            {/* Native Scrollable Wrapper with Key Reset */}
            <div 
              key={activeTab} 
              className={cn(
                "flex-1 overflow-y-auto custom-scrollbar scroll-smooth",
                activeTab === "chat" && "overflow-hidden" // Chat logic takes care of its own scrolling
              )}
            >
              <div className={cn(
                "mx-auto w-full max-w-[1800px]",
                activeTab === "chat" ? "h-full p-0" : "p-6 md:p-8"
              )}>
                {activeTab === "dashboard" && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
                      <div>
                        <h1 className="text-3xl font-space font-bold text-white tracking-tight flex items-center gap-3">
                          Mission Control
                          <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary align-middle">ONLINE</div>
                        </h1>
                        <p className="text-zinc-500 text-sm mt-1 font-space">Real-time neural agent synchronization and command interface.</p>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                          onClick={() => setViewMode("graph")}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all duration-300 rounded-md",
                            viewMode === "graph"
                              ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.4)]"
                              : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          <Network size={14} />
                          NEURAL_MAP
                        </button>
                        <button
                          onClick={() => setViewMode("list")}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all duration-300 rounded-md",
                            viewMode === "list"
                              ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.4)]"
                              : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          <Layers size={14} />
                          DATA_LIST
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        {viewMode === "graph" ? (
                          <div className="glass-card rounded-2xl border-white/5 p-1 h-[600px] relative group overflow-hidden">
                            <AgentGraph />
                          </div>
                        ) : (
                          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                            {isLoadingAgents ? (
                              Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-40 w-full rounded-2xl bg-white/5" />
                              ))
                            ) : (
                              registryAgents.map((agent: RegistryAgent) => {
                                const statusData = socketStatusMap.get(agent.name);
                                return (
                                  <AgentStatusCard
                                    key={agent.name}
                                    agent={agent}
                                    status={statusData?.status || "idle"}
                                    taskDescription={statusData?.taskDescription}
                                    onExecute={handleExecuteAgent}
                                    allAgents={registryAgents}
                                  />
                                );
                              })
                            )}
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <JulesPanel />
                           <div className="glass-card rounded-2xl border-white/5 flex flex-col h-[500px]">
                              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                                <Terminal size={16} className="text-primary" />
                                <span className="text-xs font-bold text-white tracking-widest uppercase">Kernel Logs</span>
                              </div>
                              <div className="flex-1 min-h-0">
                                <TerminalLog logs={logs} />
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <SystemHealthCard />
                        <InvoiceSyncWidget />
                        <TrackProgressWidget />
                        
                        <Card className="glass-card rounded-2xl border-white/5 flex flex-col overflow-hidden">
                          <CardHeader className="p-4 bg-white/5 border-b border-white/5">
                            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white">
                              <Brain size={16} className="text-cyan-400" />
                              Neural Memory
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                             <div className="p-3 space-y-3">
                                {[
                                  { n: "protocol_v3.md", s: "4.2kb", t: "NEURAL" },
                                  { n: "agent_nexus.json", s: "18kb", t: "CONFIG" },
                                  { n: "active_stream.log", s: "125kb", t: "STREAM" }
                                ].map((f, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 transition-colors group cursor-pointer">
                                     <div className="flex items-center gap-3">
                                        <FileText size={16} className="text-zinc-500 group-hover:text-primary transition-colors" />
                                        <span className="text-xs font-mono text-zinc-300">{f.n}</span>
                                     </div>
                                     <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-mono text-zinc-600">{f.s}</span>
                                        <span className="text-[8px] font-bold text-primary/50 uppercase">{f.t}</span>
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "chat" && <NeuralLinkChat />}
                {activeTab === "developer" && <DeveloperPanel />}
                {activeTab === "knowledge" && <KnowledgeBasePanel />}
                {activeTab === "incubator" && <IncubatorPanel />}
                {activeTab === "edge" && <EdgePanel />}
                {activeTab === "decomposer" && <TaskDecomposerPanel />}
                {activeTab === "tracks" && <TrackGenerator />}
                {activeTab === "management" && <AgentManagementPanel />}
                {activeTab === "robotkez" && <RobotkezV2Chat />}
                {activeTab === "cean" && <CEANLayout />}
                {activeTab === "cloudflare" && <CloudflareDeployment />}
                {activeTab === "fleet_manager" && <FleetManager />}
                {activeTab === "tasks" && <TaskQueueMonitor />}
                {activeTab === "inventory" && <InventoryCatalog />}
                {activeTab === "files" && <FileExplorer />}
                {activeTab === "tests" && <TestResultsWidget />}
                {activeTab === "suggested-tasks" && <SuggestedTasksWidget />}
                {activeTab === "settings" && <SettingsPanel />}
                {activeTab === "n8n" && (
                  <EmbeddedWorkflow
                    title="n8n Automation"
                    url={"http://localhost:5678"}
                    icon={<Workflow size={20} className="text-[#FF6D5A]" />}
                  />
                )}
                {activeTab === "langflow" && (
                  <EmbeddedWorkflow
                    title="Langflow Orchestration"
                    url={"http://localhost:3000"}
                    icon={<Sparkles size={20} className="text-violet-500" />}
                  />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
