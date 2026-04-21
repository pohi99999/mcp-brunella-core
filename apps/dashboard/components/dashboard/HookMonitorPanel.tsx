import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCcw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getHookObservabilitySnapshot, type HookObservabilityResponse } from "@/lib/apiService";

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "fired" || status === "healthy" || status === "closed") return "default";
  if (status === "failed" || status === "open") return "destructive";
  if (status === "blocked" || status === "retrying" || status === "half-open") return "outline";
  return "secondary";
}

function statusIcon(status: string) {
  if (status === "fired" || status === "healthy" || status === "closed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }

  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

export function HookMonitorPanel() {
  const [snapshotResponse, setSnapshotResponse] = useState<HookObservabilityResponse | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getHookObservabilitySnapshot(windowHours);
      setSnapshotResponse(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Hook observability hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [windowHours]);

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 20_000);

    return () => clearInterval(interval);
  }, [loadSnapshot]);

  const snapshot = snapshotResponse?.snapshot;
  const summary = snapshot?.summary;
  const registry = snapshot?.registry ?? [];
  const executions = snapshot?.executions ?? [];
  const dlq = snapshot?.dlq ?? [];
  const circuits = snapshot?.circuits ?? [];

  const failureRate = useMemo(() => {
    const rate = summary?.audit.failureRate ?? 0;
    return `${(rate * 100).toFixed(1)}%`;
  }, [summary?.audit.failureRate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Hook Engine</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Hook Monitor</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Central snapshot for lifecycle hooks, audit trail, dead-letter queue, and circuit state.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Execution count</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="hook-summary-total">
              {summary?.audit.total ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Window: last {summary?.windowHours ?? windowHours}h</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Failure rate</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-mono text-zinc-100" data-testid="hook-summary-failure-rate">
              {failureRate}
              {summary?.audit.failed ? <AlertTriangle className="h-5 w-5 text-amber-400" /> : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">{summary?.audit.failed ?? 0} failed / {summary?.audit.total ?? 0} total</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Registry</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="hook-summary-registry-size">
              {summary?.registrySize ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">{summary?.registeredHandlers ?? 0} handlers registered</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Open circuits</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="hook-summary-circuits">
              {summary?.circuitOpenCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Blocking failing hooks</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">DLQ entries</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="hook-summary-dlq">
              {summary?.dlqCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Waiting for replay</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Workflow className="h-4 w-4 text-cyan-300" /> Registry snapshot
            </CardTitle>
            <CardDescription className="text-zinc-500">Registered hooks and their current activation state.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px]">
              <div className="divide-y divide-border/50">
                {loading && !snapshot ? (
                  <div className="p-4 text-zinc-500">Loading hook snapshot...</div>
                ) : registry.length === 0 ? (
                  <div className="p-4 text-zinc-500">No hook registrations yet.</div>
                ) : (
                  registry.map((entry) => (
                    <div key={entry.event} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-100">{entry.event}</div>
                          <div className="text-xs text-zinc-500">{entry.description}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={badgeVariant(entry.enabled ? 'closed' : 'blocked')}>
                            {entry.enabled ? 'enabled' : 'disabled'}
                          </Badge>
                          <Badge variant="outline">{entry.category}</Badge>
                          <Badge variant="secondary">p{entry.priority}</Badge>
                          <Badge variant="secondary">{entry.handlerCount} handlers</Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {entry.handlers.slice(0, 5).map((handler) => (
                          <Badge key={handler.id} variant={badgeVariant(handler.enabled ? 'closed' : 'blocked')}>
                            {handler.handlerName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <Activity className="h-4 w-4 text-orange-300" /> Recent executions
              </CardTitle>
              <CardDescription className="text-zinc-500">Latest hook results from the audit trail.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <div className="divide-y divide-border/50">
                  {executions.length === 0 ? (
                    <div className="p-4 text-zinc-500">No executions recorded yet.</div>
                  ) : (
                    executions.map((execution) => (
                      <div key={execution.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium text-zinc-100">{execution.event}</div>
                          <div className="text-xs text-zinc-500">{execution.handlerName} · {execution.createdAt}</div>
                          {execution.error ? <div className="text-xs text-amber-300">{execution.error}</div> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={badgeVariant(execution.status)}>{execution.status}</Badge>
                          <Badge variant="secondary">{execution.durationMs}ms</Badge>
                        </div>
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
                <Database className="h-4 w-4 text-violet-300" /> Dead letter queue
              </CardTitle>
              <CardDescription className="text-zinc-500">Hook retries waiting for replay.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <div className="divide-y divide-border/50">
                  {dlq.length === 0 ? (
                    <div className="p-4 text-zinc-500">DLQ is empty.</div>
                  ) : (
                    dlq.map((entry) => (
                      <div key={entry.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium text-zinc-100">{entry.event}</div>
                          <div className="text-xs text-zinc-500">{entry.reason}</div>
                          <div className="text-[11px] text-zinc-500">
                            Attempts: {entry.attempts} · Retry at: {entry.nextRetryAt}
                          </div>
                        </div>
                        <Badge variant={badgeVariant(entry.status)}>{entry.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass-card overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
          <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Circuit state
          </CardTitle>
          <CardDescription className="text-zinc-500">Current breaker state for each tracked hook.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[240px]">
            <div className="divide-y divide-border/50">
              {circuits.length === 0 ? (
                <div className="p-4 text-zinc-500">No circuit state recorded yet.</div>
              ) : (
                circuits.map((circuit) => (
                  <div key={circuit.event} className="p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-zinc-100">{circuit.event}</div>
                      <div className="text-xs text-zinc-500">
                        Failures: {circuit.failures} · Cooldown: {Math.round(circuit.coolDownMs / 1000)}s
                      </div>
                      {circuit.nextTrialAt ? (
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock3 className="h-3 w-3" /> Next trial: {circuit.nextTrialAt}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant={badgeVariant(circuit.state)}>
                      {statusIcon(circuit.state)}
                      <span className="ml-2">{circuit.state}</span>
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
