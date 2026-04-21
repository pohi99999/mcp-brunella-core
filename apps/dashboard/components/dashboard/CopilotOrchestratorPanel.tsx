import { useState, useEffect, useCallback } from "react";
import {
    Activity, AlertCircle, ArrowRight, Bot, Brain, CheckCircle2,
    Clock, Cpu, RefreshCw, Rocket, Workflow, XCircle, Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

// ── Types ─────────────────────────────────────────────────────────

type StepStatus = "running" | "success" | "error" | "skipped";

interface OrchestratorStep {
    id: string;
    step: string;
    status: StepStatus;
    detail?: string;
    delegateTo?: string;
    confidence?: number;
    model?: string;
    startedAt: number;
    completedAt?: number;
}

interface OrchStats {
    totalSessions: number;
    activeSessions: number;
    totalSteps: number;
    successSteps: number;
    errorSteps: number;
}

// ── Helpers ───────────────────────────────────────────────────────

const STATUS_META: Record<StepStatus, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
    running: { label: "Running", color: "text-cyan-400", Icon: Cpu },
    success: { label: "Done", color: "text-emerald-400", Icon: CheckCircle2 },
    error: { label: "Error", color: "text-red-400", Icon: XCircle },
    skipped: { label: "Skipped", color: "text-slate-500", Icon: Clock },
};

function relativeTime(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function durationMs(step: OrchestratorStep): string {
    if (!step.completedAt) return "…";
    return `${step.completedAt - step.startedAt}ms`;
}

// ── Main Component ────────────────────────────────────────────────

export function CopilotOrchestratorPanel() {
    const [stats, setStats] = useState<OrchStats | null>(null);
    const [steps, setSteps] = useState<OrchestratorStep[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, stepsRes] = await Promise.all([
                fetch("/api/v1/copilot-orchestrator/stats"),
                fetch("/api/v1/copilot-orchestrator/steps?limit=40"),
            ]);
            if (!statsRes.ok || !stepsRes.ok) throw new Error("API error");
            const [statsData, stepsData] = await Promise.all([statsRes.json(), stepsRes.json()]);
            setStats(statsData as OrchStats);
            setSteps(stepsData as OrchestratorStep[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch orchestrator data");
        } finally {
            setLoading(false);
        }
    }, []);

    // Poll every 5 s while visible
    useEffect(() => {
        void fetchData();
        const timer = setInterval(() => void fetchData(), 5000);
        return () => clearInterval(timer);
    }, [fetchData]);

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header stat cards */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                    { label: "Sessions", value: stats?.totalSessions ?? "–", tone: "text-white", Icon: Rocket },
                    { label: "Active", value: stats?.activeSessions ?? "–", tone: "text-cyan-300", Icon: Activity },
                    { label: "Total Steps", value: stats?.totalSteps ?? "–", tone: "text-white", Icon: Workflow },
                    { label: "Completed", value: stats?.successSteps ?? "–", tone: "text-emerald-300", Icon: CheckCircle2 },
                    { label: "Errors", value: stats?.errorSteps ?? "–", tone: "text-red-300", Icon: AlertCircle },
                ].map(({ label, value, tone, Icon }) => (
                    <Card key={label} className="border-white/10 bg-slate-950/70 shadow-lg shadow-black/20 backdrop-blur-xl">
                        <CardHeader className="p-3 md:pb-2">
                            <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                                <Icon size={12} />
                                {label}
                            </CardDescription>
                            <CardTitle className={`text-xl md:text-2xl font-bold ${tone}`}>{value}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            {/* Main panel */}
            <Card className="border-border/40 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Bot className="h-5 w-5 text-cyan-400" />
                            Copilot CLI Orchestrator
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Model-agnostic top-level orchestrator — real-time delegation log
                        </CardDescription>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-white/5 text-xs text-slate-200"
                        onClick={() => void fetchData()}
                        disabled={loading}
                    >
                        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </CardHeader>

                <CardContent className="p-4 md:p-6">
                    {error && (
                        <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {steps.length === 0 && !loading && (
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center text-sm text-slate-500">
                            <Brain className="mx-auto mb-3 h-8 w-8 opacity-30" />
                            No orchestration activity yet.<br />
                            Invoke the <code className="text-cyan-400">@copilot-cli-orchestrator</code> agent in Copilot Chat to begin.
                        </div>
                    )}

                    {steps.length > 0 && (
                        <div className="space-y-2">
                            {steps.map((step) => {
                                const meta = STATUS_META[step.status];
                                const StatusIcon = meta.Icon;
                                return (
                                    <article
                                        key={step.id}
                                        className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-cyan-400/20 hover:bg-white/[0.04]"
                                    >
                                        <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="truncate text-sm font-medium text-white">{step.step}</span>
                                                <Badge
                                                    variant="secondary"
                                                    className={`border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.15em] ${meta.color}`}
                                                >
                                                    {meta.label}
                                                </Badge>
                                                {step.model && (
                                                    <Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">
                                                        {step.model}
                                                    </Badge>
                                                )}
                                            </div>

                                            {step.detail && (
                                                <p className="mt-1 truncate text-xs text-slate-400">{step.detail}</p>
                                            )}

                                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                                                {step.delegateTo && (
                                                    <span className="flex items-center gap-1">
                                                        <ArrowRight size={10} />
                                                        <span className="text-cyan-500">{step.delegateTo}</span>
                                                    </span>
                                                )}
                                                {step.confidence !== undefined && (
                                                    <span className={`flex items-center gap-1 ${step.confidence >= 0.7 ? "text-emerald-500" : "text-amber-500"}`}>
                                                        <Zap size={10} />
                                                        {Math.round(step.confidence * 100)}% conf.
                                                    </span>
                                                )}
                                                <span>{relativeTime(step.startedAt)}</span>
                                                {step.completedAt && (
                                                    <span>{durationMs(step)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick-reference fast-path commands */}
            <Card className="border-border/40 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Cpu className="h-4 w-4 text-cyan-400" />
                        Fast-Path CLI Commands
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                        Invoke from the Copilot CLI or terminal to interact with BAS
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                    <div className="grid gap-3 md:grid-cols-2">
                        {[
                            {
                                label: "Health Check",
                                cmd: "curl http://localhost:3000/api/health",
                                desc: "Full system health status",
                            },
                            {
                                label: "Agent Status",
                                cmd: "curl http://localhost:3000/api/agents/status",
                                desc: "All agent idle/working states",
                            },
                            {
                                label: "Active Tracks",
                                cmd: "curl http://localhost:3000/api/v1/tracks/status",
                                desc: "Conductor track overview",
                            },
                            {
                                label: "Delegate Task",
                                cmd: 'curl -X POST localhost:3000/api/v1/orchestrator/delegate -H "Content-Type: application/json" -d \'{"task":"…"}\'',
                                desc: "Delegate to Brunella orchestrator",
                            },
                            {
                                label: "Route Task",
                                cmd: 'node scripts/copilot-route.js "<task>"',
                                desc: "Confidence-based agent routing",
                            },
                            {
                                label: "Log Step",
                                cmd: 'curl -X POST localhost:3000/api/v1/copilot-orchestrator/log -d \'{"step":"…","status":"running"}\'',
                                desc: "Push step to this panel",
                            },
                        ].map(({ label, cmd, desc }) => (
                            <div
                                key={label}
                                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                            >
                                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{label}</p>
                                <p className="mb-2 text-xs text-slate-500">{desc}</p>
                                <code className="block overflow-x-auto rounded bg-black/30 px-2.5 py-1.5 text-[10px] text-cyan-300">
                                    {cmd}
                                </code>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
