import { useMemo, useState } from "react";
import { Activity, AlertCircle, BarChart3, Cpu, Database, RefreshCw, Send, Terminal, Users, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface BridgeCommand {
    id: string;
    domain: string;
    action: string;
    status: "pending" | "running" | "success" | "error";
}

const QUICK_COMMANDS = [
    { label: "Health Check", icon: Activity, endpoint: "/api/health", description: "Rendszer állapot lekérése" },
    { label: "Agent Lista", icon: Users, endpoint: "/api/agents/status", description: "Összes agent állapota" },
    { label: "Task Queue", icon: BarChart3, endpoint: "/api/tasks/queue", description: "Feladat sor állapota" },
    { label: "MCP Tools", icon: Zap, endpoint: "/api/tools", description: "Elérhető MCP eszközök" },
    { label: "LLM Status", icon: Cpu, endpoint: "/api/llm/status", description: "LLM provider állapot" },
    { label: "Memory Stats", icon: Database, endpoint: "/api/memory/stats", description: "Memória statisztika" },
    { label: "Phoenix Events", icon: AlertCircle, endpoint: "/api/phoenix/events", description: "Utolsó phoenix események" },
    { label: "Track Status", icon: BarChart3, endpoint: "/api/tracks/status", description: "Aktív trackek" },
];

export function CopilotCommanderPanel() {
    const [commands, setCommands] = useState<BridgeCommand[]>([
        { id: "cmd-1", domain: "core", action: "health", status: "success" },
        { id: "cmd-2", domain: "agents", action: "status", status: "running" },
        { id: "cmd-3", domain: "tasks", action: "queue", status: "pending" },
    ]);

    const stats = useMemo(() => ({
        total: commands.length,
        success: commands.filter((command) => command.status === "success").length,
        active: commands.filter((command) => command.status === "running").length,
        pending: commands.filter((command) => command.status === "pending").length,
    }), [commands]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Összes parancs", value: stats.total, tone: "text-white" },
                    { label: "Sikeres", value: stats.success, tone: "text-emerald-300" },
                    { label: "Futó", value: stats.active, tone: "text-cyan-300" },
                    { label: "Várakozó", value: stats.pending, tone: "text-amber-300" },
                ].map((item) => (
                    <Card key={item.label} className="border-white/10 bg-slate-950/70 shadow-lg shadow-black/20 backdrop-blur-xl">
                        <CardHeader className="p-3 md:pb-2">
                            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{item.label}</CardDescription>
                            <CardTitle className={`text-xl md:text-2xl font-bold ${item.tone}`}>{item.value}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Card className="border-border/40 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
                <CardHeader className="border-b border-white/5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Terminal className="h-5 w-5 text-cyan-400" />
                        Copilot Commander
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Quick command surface for dashboard health and orchestration shortcuts.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 md:p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {QUICK_COMMANDS.map((command) => {
                            const Icon = command.icon;
                            return (
                                <article key={command.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.05]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{command.label}</p>
                                            <p className="text-sm text-slate-300">{command.description}</p>
                                        </div>
                                        <Icon className="h-4 w-4 text-cyan-300" />
                                    </div>
                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <code className="text-xs text-slate-400">{command.endpoint}</code>
                                        <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-xs text-slate-200">
                                            <Send className="mr-2 h-3.5 w-3.5" />
                                            Run
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        {commands.map((command) => (
                            <div key={command.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{command.domain}</p>
                                    <p className="text-sm text-white">{command.action}</p>
                                </div>
                                <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-200">
                                    {command.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
