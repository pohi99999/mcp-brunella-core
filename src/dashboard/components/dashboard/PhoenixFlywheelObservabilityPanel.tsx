import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Flame,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getPhoenixFlywheelObservabilitySnapshot,
  type PhoenixFlywheelObservabilityResponse,
} from "@/lib/apiService";

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "default";
  if (status === "critical") return "destructive";
  if (status === "warning") return "outline";
  return "secondary";
}

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "outline";
  if (priority === "medium") return "secondary";
  return "default";
}

function scoreIcon(status: string) {
  if (status === "healthy") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  }

  return <AlertTriangle className="h-5 w-5 text-amber-400" />;
}

export function PhoenixFlywheelObservabilityPanel() {
  const [snapshotResponse, setSnapshotResponse] = useState<PhoenixFlywheelObservabilityResponse | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await getPhoenixFlywheelObservabilitySnapshot(windowHours);
      setSnapshotResponse(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Phoenix/Flywheel observability hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [windowHours]);

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadSnapshot]);

  const snapshot = snapshotResponse?.snapshot;
  const phoenix = snapshot?.phoenix;
  const flywheel = snapshot?.flywheel;

  const chartData = useMemo(() => ({
    phoenixEvents: phoenix?.eventBus.breakdown.slice(0, 8) ?? [],
    phoenixTimeline: phoenix?.eventBus.timeline ?? [],
    flywheelStates: flywheel?.trend.sampleStateBreakdown ?? [],
    trainingStatus: flywheel?.trend.trainingRunStatusBreakdown ?? [],
    sourceBreakdown: flywheel?.golden.sourceBreakdown.slice(0, 6) ?? [],
  }), [flywheel, phoenix]);
  const maxSourceValue = useMemo(
    () => Math.max(...chartData.sourceBreakdown.map((item) => item.value), 1),
    [chartData.sourceBreakdown],
  );

  const latestSignals = phoenix?.eventBus.recentSignals ?? [];
  const recentRuns = flywheel?.learningLoop.latestTrainingRuns ?? [];
  const recentPhoenixRuns = phoenix?.remediation.recentRuns ?? [];
  const recommendations = snapshot?.recommendations ?? [];
  const mitigationTracks = snapshot?.mitigationTracks ?? [];

  if (loading && !snapshot) {
    return <div className="p-6 text-center text-zinc-400">Betöltés...</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">
          Hiba: {error}
          <button onClick={() => void loadSnapshot()} className="ml-4 underline">
            Újrapróbálás
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Phoenix / Flywheel</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Observability & Self-Healing</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Combined Phoenix Protocol and data flywheel snapshot with recovery, training and mitigation guidance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={windowHours}
            onChange={(event) => setWindowHours(Number(event.target.value))}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <Button
            onClick={() => void loadSnapshot()}
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Overall score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
              {snapshot?.summary.score ?? 0}
              {scoreIcon(snapshot?.summary.status ?? "critical")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Snapshot status: {snapshot?.summary.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Phoenix score</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.phoenixScore ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Heartbeat: {phoenix?.heartbeat.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Flywheel score</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.flywheelScore ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Active reflex: {flywheel?.learningLoop.activeReflexModel ?? "n/a"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Failure signals</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.failureSignals ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Recovery signals: {snapshot?.summary.recoverySignals ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Approvals</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.pendingFinalApproval ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Pending final approval</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Curated review</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.pendingCuratedReview ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Samples waiting for review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Flame className="h-4 w-4 text-orange-300" /> Phoenix event distribution
            </CardTitle>
            <CardDescription className="text-zinc-500">Event types from the shared Phoenix event bus.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {chartData.phoenixEvents.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.phoenixEvents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" stroke="#888" />
                  <YAxis stroke="#888" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }} />
                  <Bar dataKey="value" fill="#ef4444" name="Events" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No Phoenix events yet." />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Rocket className="h-4 w-4 text-cyan-300" /> Phoenix timeline
            </CardTitle>
            <CardDescription className="text-zinc-500">Hourly event, failure and recovery trend for the selected window.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {chartData.phoenixTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData.phoenixTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="hour" stroke="#888" tickFormatter={(value: string) => value.slice(11, 16)} />
                  <YAxis stroke="#888" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }} />
                  <Line type="monotone" dataKey="events" stroke="#3b82f6" name="Events" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failures" stroke="#ef4444" name="Failures" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="recoveries" stroke="#10b981" name="Recoveries" strokeWidth={2} dot={false} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No Phoenix timeline data yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Sparkles className="h-4 w-4 text-emerald-300" /> Flywheel sample states
            </CardTitle>
            <CardDescription className="text-zinc-500">Approved, pending and rejected curated sample counts.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {chartData.flywheelStates.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.flywheelStates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" stroke="#888" />
                  <YAxis stroke="#888" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }} />
                  <Bar dataKey="value" fill="#10b981" name="Samples" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No curated samples yet." />
            )}
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Workflow className="h-4 w-4 text-violet-300" /> Learning run statuses
            </CardTitle>
            <CardDescription className="text-zinc-500">Latest training runs by status.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {chartData.trainingStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.trainingStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" stroke="#888" />
                  <YAxis stroke="#888" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333" }} />
                  <Bar dataKey="value" fill="#8b5cf6" name="Runs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No training runs yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-card overflow-hidden border-white/10 xl:col-span-2">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Recommendations
            </CardTitle>
            <CardDescription className="text-zinc-500">Operational fixes and mitigation work items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="text-sm text-emerald-400">No active recommendations.</div>
            ) : (
              recommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-100">{recommendation.title}</div>
                    <Badge variant={priorityVariant(recommendation.priority)}>{recommendation.priority}</Badge>
                  </div>
                  <div className="text-sm text-zinc-400">{recommendation.rationale}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {recommendation.evidence.map((item) => (
                      <Badge key={`${recommendation.id}-${item}`} variant="outline">{item}</Badge>
                    ))}
                  </div>
                  <ul className="space-y-1 text-sm text-zinc-300">
                    {recommendation.actions.map((action) => (
                      <li key={`${recommendation.id}-${action}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-500" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Clock3 className="h-4 w-4 text-cyan-300" /> Mitigation tracks
            </CardTitle>
            <CardDescription className="text-zinc-500">Track drafts generated from the highest-priority recommendations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mitigationTracks.length === 0 ? (
              <div className="text-sm text-emerald-400">No mitigation tracks suggested.</div>
            ) : (
              mitigationTracks.map((track) => (
                <div key={track.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-100">{track.title}</div>
                    <Badge variant={priorityVariant(track.priority)}>{track.priority}</Badge>
                  </div>
                  <div className="text-sm text-zinc-400">{track.rationale}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {track.scope.map((scopeItem) => (
                      <Badge key={`${track.id}-${scopeItem}`} variant="outline">{scopeItem}</Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Flame className="h-4 w-4 text-orange-300" /> Recent Phoenix signals
            </CardTitle>
            <CardDescription className="text-zinc-500">The most recent events on the Phoenix bus.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[360px]">
              <div className="divide-y divide-border/50">
                {latestSignals.length === 0 ? (
                  <div className="p-4 text-zinc-500">No Phoenix signals recorded yet.</div>
                ) : (
                  latestSignals.map((signal) => (
                    <div key={`${signal.event}-${signal.timestamp}`} className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-zinc-100">{signal.event}</div>
                        <div className="text-xs text-zinc-500">{signal.timestamp.slice(0, 19)}</div>
                      </div>
                      <div className="text-sm text-zinc-400">{signal.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <BarChart3 className="h-4 w-4 text-violet-300" /> Flywheel details
            </CardTitle>
            <CardDescription className="text-zinc-500">Top sources, latest learning runs and current quality notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Top sources</div>
              <div className="space-y-2">
                {chartData.sourceBreakdown.length === 0 ? (
                  <div className="text-sm text-zinc-500">No source breakdown yet.</div>
                ) : (
                  chartData.sourceBreakdown.map((source) => (
                    <div key={source.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-200">{source.label}</span>
                        <span className="text-zinc-500">{source.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-cyan-400"
                          style={{ width: `${Math.min(100, source.value === 0 ? 0 : (source.value / maxSourceValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Latest training runs</div>
              <div className="space-y-2">
                {recentRuns.length === 0 ? (
                  <div className="text-sm text-zinc-500">No training runs recorded yet.</div>
                ) : (
                  recentRuns.map((run) => (
                    <div key={run.runId} className="rounded-md border border-border/50 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-zinc-100">{run.runId}</div>
                        <Badge variant={badgeVariant(run.status)}>{run.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {run.completedAt ?? run.startedAt ?? "unknown"} · {run.snapshotId ?? "no snapshot"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Recent remediation runs</div>
              <div className="space-y-2">
                {recentPhoenixRuns.length === 0 ? (
                  <div className="text-sm text-zinc-500">No remediation runs yet.</div>
                ) : (
                  recentPhoenixRuns.map((run) => (
                    <div key={run.id} className="rounded-md border border-border/50 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-zinc-100">{run.repositoryName}</div>
                        <Badge variant={badgeVariant(run.status)}>{run.status}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {run.updatedAt.slice(0, 19)} · {run.workflowRunId ?? "no workflow run"}
                      </div>
                      {run.failureReason ? <div className="mt-1 text-sm text-red-300">{run.failureReason}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-zinc-600">{text}</div>
  );
}
