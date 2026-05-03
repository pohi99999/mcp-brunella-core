import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, BarChart3, Cpu, Database, RefreshCw, Send, Terminal, Users, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface BridgeCommand {
    id: string;
    timestamp?: string;
    domain: string;
    action: string;
    status: "pending" | "running" | "success" | "error";
    error?: string;
    durationMs?: number;
}

interface BridgeStats {
    totalCommands: number;
    successCount: number;
    errorCount: number;
    lastCommandAt: string | null;
    activeDispatches: number;
    uptimeSince: string;
}

const QUICK_COMMANDS = [
    { label: "Health Check", icon: Activity, endpoint: "/api/v1/health", description: "Rendszer állapot lekérése" },
    { label: "Agent Lista", icon: Users, endpoint: "/api/v1/agents/status", description: "Összes agent állapota" },
    { label: "Task Queue", icon: BarChart3, endpoint: "/api/v1/tasks?limit=20", description: "Feladat sor állapota" },
    { label: "MCP Runtime", icon: Zap, endpoint: "/api/v1/mcp/servers", description: "MCP szerver runtime állapot" },
    { label: "LLM Readiness", icon: Cpu, endpoint: "/api/v1/llm/orchestration-readiness", description: "Fő LLM és fallback készenlét" },
    { label: "Memory Stats", icon: Database, endpoint: "/api/v1/memory/stats", description: "Memória statisztika" },
    { label: "Phoenix Events", icon: AlertCircle, endpoint: "/api/v1/phoenix/event-bus/history?limit=20", description: "Utolsó phoenix események" },
    { label: "Track Status", icon: BarChart3, endpoint: "/api/v1/tracks/status", description: "Aktív trackek" },
];

export function CopilotCommanderPanel() {
    const [commands, setCommands] = useState<BridgeCommand[]>([]);
    const [bridgeStats, setBridgeStats] = useState<BridgeStats | null>(null);
    const [runningEndpoint, setRunningEndpoint] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<string>("Válassz egy gyorsparancsot a valós endpoint ellenőrzéséhez.");
    const [bridgeError, setBridgeError] = useState<string | null>(null);

    const stats = useMemo(() => ({
        total: bridgeStats?.totalCommands ?? commands.length,
        success: bridgeStats?.successCount ?? commands.filter((command) => command.status === "success").length,
        active: commands.filter((command) => command.status === "running").length,
        errors: bridgeStats?.errorCount ?? commands.filter((command) => command.status === "error").length,
        dispatches: bridgeStats?.activeDispatches ?? 0,
    }), [bridgeStats, commands]);

    const refreshBridge = useCallback(async () => {
        try {
            const [statsResponse, commandsResponse] = await Promise.all([
                fetch("/api/v1/copilot-bridge/stats"),
                fetch("/api/v1/copilot-bridge/commands?limit=20"),
            ]);

            if (!statsResponse.ok || !commandsResponse.ok) {
                throw new Error(`Bridge API error: stats=${statsResponse.status}, commands=${commandsResponse.status}`);
            }

            const [statsPayload, commandPayload] = await Promise.all([
                statsResponse.json() as Promise<BridgeStats>,
                commandsResponse.json() as Promise<BridgeCommand[]>,
            ]);

            setBridgeStats(statsPayload);
            setCommands(commandPayload);
            setBridgeError(null);
        } catch (error: unknown) {
            setBridgeError(error instanceof Error ? error.message : String(error));
        }
    }, []);

    useEffect(() => {
        void refreshBridge();
    }, [refreshBridge]);

    const runQuickCommand = async (endpoint: string, label: string) => {
        setRunningEndpoint(endpoint);
        setLastResult(`${label}: futtatás folyamatban...`);
        const startedAt = performance.now();
        let commandId: string | null = null;

        try {
            const bridgeResponse = await fetch("/api/v1/copilot-bridge/commands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain: "dashboard",
                    action: label,
                    params: { endpoint },
                    status: "running",
                }),
            });
            if (bridgeResponse.ok) {
                const command = await bridgeResponse.json() as BridgeCommand;
                commandId = command.id;
                await refreshBridge();
            } else {
                setBridgeError(`Bridge command log failed: HTTP ${bridgeResponse.status}`);
            }
        } catch (error: unknown) {
            setBridgeError(error instanceof Error ? error.message : String(error));
            commandId = null;
        }

        try {
            const response = await fetch(endpoint);
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
            }
            setLastResult(`${label}: OK (${response.status}) ${text.slice(0, 220)}`);
            if (commandId) {
                const updateResponse = await fetch(`/api/v1/copilot-bridge/commands/${commandId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "success",
                        result: { status: response.status, preview: text.slice(0, 220) },
                        durationMs: Math.round(performance.now() - startedAt),
                    }),
                });
                if (!updateResponse.ok) {
                    setBridgeError(`Bridge command update failed: HTTP ${updateResponse.status}`);
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setLastResult(`${label}: ${message}`);
            if (commandId) {
                const updateResponse = await fetch(`/api/v1/copilot-bridge/commands/${commandId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        status: "error",
                        error: message,
                        durationMs: Math.round(performance.now() - startedAt),
                    }),
                });
                if (!updateResponse.ok) {
                    setBridgeError(`Bridge command update failed: HTTP ${updateResponse.status}`);
                }
            }
        } finally {
            await refreshBridge();
            setRunningEndpoint(null);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: "Összes parancs", value: stats.total, tone: "text-white" },
                    { label: "Sikeres", value: stats.success, tone: "text-emerald-300" },
                    { label: "Futó", value: stats.active, tone: "text-cyan-300" },
                    { label: "Hibás", value: stats.errors, tone: "text-red-300" },
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
                        Valós Copilot Bridge parancsnapló dashboard health és orchestration gyorsparancsokhoz.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 md:p-6">
                    {bridgeError && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-xs text-amber-200">
                            Bridge állapot nem elérhető: {bridgeError}
                        </div>
                    )}

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
                                        <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-xs text-slate-200" disabled={runningEndpoint === command.endpoint} onClick={() => void runQuickCommand(command.endpoint, command.label)}>
                                            {runningEndpoint === command.endpoint ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                                            Run
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Legutóbbi bridge parancsok</p>
                            <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-xs text-slate-200" onClick={() => void refreshBridge()}>
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </div>
                        {commands.length === 0 && (
                            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs text-slate-500">
                                Nincs még Copilot Bridge parancs. Futtass egy gyorsparancsot, vagy küldj eseményt a CLI bridge-en keresztül.
                            </div>
                        )}
                        <div className="grid gap-3 md:grid-cols-3">
                            {commands.map((command) => (
                                <div key={command.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{command.domain}</p>
                                        <p className="text-sm text-white">{command.action}</p>
                                        {command.durationMs !== undefined && (
                                            <p className="text-[10px] text-slate-500">{command.durationMs}ms</p>
                                        )}
                                        {command.error && (
                                            <p className="text-[10px] text-red-300">{command.error}</p>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-200">
                                        {command.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
                        {lastResult}
                    </div>
                    {bridgeStats && (
                        <div className="text-[11px] text-slate-500">
                            Bridge uptime: {new Date(bridgeStats.uptimeSince).toLocaleString()} · aktív dispatch: {stats.dispatches}
                            {bridgeStats.lastCommandAt ? ` · utolsó parancs: ${new Date(bridgeStats.lastCommandAt).toLocaleString()}` : ""}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
