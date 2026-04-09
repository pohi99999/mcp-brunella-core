import { useEffect, useMemo, useState } from "react";
import { Archive, AlertTriangle, CheckCircle2, ClipboardList, RefreshCcw, GitMerge, Layers3, FileWarning } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgentRegistryGovernanceSnapshot, type AgentRegistryGovernanceSnapshot } from "@/lib/apiService";

function badgeVariantForHealth(status: "healthy" | "warning" | "critical" | "unknown"): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "default";
  if (status === "critical") return "destructive";
  if (status === "warning") return "outline";
  return "secondary";
}

function badgeVariantForPriority(priority: "critical" | "high" | "medium" | "low"): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "default";
  if (priority === "medium") return "outline";
  return "secondary";
}

function badgeVariantForStatus(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "loaded" || status === "healthy" || status === "active") return "default";
  if (status === "error") return "destructive";
  if (status === "stale" || status === "never-used" || status === "warning") return "outline";
  return "secondary";
}

export function AgentRegistryHealthPanel() {
  const [snapshot, setSnapshot] = useState<AgentRegistryGovernanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = async () => {
    try {
      const response = await getAgentRegistryGovernanceSnapshot();
      setSnapshot(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Registry governance betöltési hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const audit = snapshot?.audit;
  const summary = audit?.summary;
  const duplicateNames = audit?.duplicateNames ?? [];
  const staleAgents = audit?.staleAgents ?? [];
  const loadErrors = audit?.loadErrors ?? [];
  const recommendations = snapshot?.recommendations ?? [];
  const explorerAgents = useMemo(() => {
    return [...(audit?.perAgentHealth ?? [])].sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }, [audit?.perAgentHealth]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Agent Governance</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Agent Registry Health</h2>
          <p className="mt-1 text-sm text-zinc-500">Canonical read-only audit snapshot for registry hygiene, consolidation, and documentation coverage.</p>
        </div>
        <Button onClick={() => void loadSnapshot()} variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Registry score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100" data-testid="registry-governance-score">
              {summary?.score ?? 0}
              {summary?.overallStatus === "critical" ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500" data-testid="registry-governance-status">{summary?.overallStatus ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Duplicate names</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="registry-governance-duplicate-names">{summary?.duplicateNameCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Potential routing collisions</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Stale agents</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="registry-governance-stale-agents">{summary?.staleAgentCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Never-used or inactive agents</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Load errors</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100" data-testid="registry-governance-load-errors">{summary?.loadErrorCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Agents that failed to load</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Doc coverage</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{audit?.documentCoverage?.coveragePercent ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">{audit?.documentCoverage?.agentsReferenced ?? 0} / {summary?.totalAgents ?? 0} agents referenced</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6 xl:col-span-1">
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <GitMerge className="w-4 h-4 text-cyan-300" /> Duplicate names
              </CardTitle>
              <CardDescription className="text-zinc-500">Registry entries that share the same canonical name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicateNames.length === 0 ? (
                <div className="text-sm text-emerald-400">No duplicate names detected.</div>
              ) : (
                duplicateNames.map((group) => (
                  <div key={group.name} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2" data-testid={`duplicate-name-${group.name}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{group.name}</div>
                      <Badge variant="outline">{group.count}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {group.agents.map((agent, index) => (
                        <Badge key={`${group.name}-${agent}-${index}`} variant="secondary">{agent}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <Archive className="w-4 h-4 text-violet-300" /> Stale agents
              </CardTitle>
              <CardDescription className="text-zinc-500">Never-used or stale agents flagged by the audit engine.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {staleAgents.length === 0 ? (
                <div className="text-sm text-emerald-400">No stale agents detected.</div>
              ) : (
                staleAgents.map((agent) => (
                  <div key={agent.name} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2" data-testid={`stale-agent-${agent.name}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{agent.name}</div>
                      <Badge variant={badgeVariantForStatus(agent.usageStatus)}>{agent.usageStatus}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500">{agent.reason}</div>
                    <div className="text-xs text-zinc-500">Success: {agent.successCount} · Errors: {agent.errorCount}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <FileWarning className="w-4 h-4 text-amber-300" /> Recommendations
              </CardTitle>
              <CardDescription className="text-zinc-500">Actionable governance recommendations derived from the audit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.length === 0 ? (
                <div className="text-sm text-emerald-400">No recommendations generated.</div>
              ) : (
                recommendations.slice(0, 6).map((recommendation) => (
                  <div key={recommendation.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2" data-testid={`recommendation-${recommendation.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{recommendation.title}</div>
                      <Badge variant={badgeVariantForPriority(recommendation.priority)}>{recommendation.priority}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500">{recommendation.rationale}</div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <Badge variant="outline">{recommendation.type}</Badge>
                      {recommendation.targets.map((target) => (
                        <Badge key={`${recommendation.id}-${target}`} variant="secondary">{target}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-white/10 xl:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Layers3 className="w-4 h-4 text-cyan-300" /> Registry explorer
            </CardTitle>
            <CardDescription className="text-zinc-500">Per-agent health, load status, documentation coverage, and overlap flags.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[760px]">
              <div className="divide-y divide-border/50">
                {loading && !snapshot ? (
                  <div className="p-4 text-zinc-500">Loading registry governance snapshot...</div>
                ) : explorerAgents.length === 0 ? (
                  <div className="p-4 text-zinc-500">No registry agents available.</div>
                ) : (
                  explorerAgents.map((agent, index) => (
                    <div key={`${agent.name}-${index}`} className="p-4 space-y-3" data-testid={`registry-agent-${agent.name}-${index}`}>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold">{agent.name}</div>
                          <div className="text-xs text-zinc-500">{agent.title ?? "No title"} · {agent.category ?? "uncategorized"}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={badgeVariantForHealth(agent.health)}>{agent.health}</Badge>
                          <Badge variant={badgeVariantForStatus(agent.loadStatus)}>{agent.loadStatus}</Badge>
                          <Badge variant={badgeVariantForStatus(agent.runtimeStatus)}>{agent.runtimeStatus}</Badge>
                          <Badge variant={badgeVariantForStatus(agent.usageStatus)}>{agent.usageStatus}</Badge>
                          <Badge variant="outline">{agent.score}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                          <div className="font-medium flex items-center gap-2"><ClipboardList className="w-4 h-4 text-cyan-400" /> Health signals</div>
                          <div><span className="text-zinc-500">Documented:</span> {agent.documented ? "yes" : "no"}</div>
                          <div><span className="text-zinc-500">Duplicate name:</span> {agent.duplicateName ? "yes" : "no"}</div>
                          <div><span className="text-zinc-500">Overlaps:</span> {agent.duplicateCapabilityGroupIds.length > 0 ? agent.duplicateCapabilityGroupIds.join(", ") : "-"}</div>
                        </div>
                        <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                          <div className="font-medium">Runtime details</div>
                          <div><span className="text-zinc-500">Success:</span> {agent.successCount}</div>
                          <div><span className="text-zinc-500">Errors:</span> {agent.errorCount}</div>
                          <div><span className="text-zinc-500">Last task:</span> {agent.lastTask ?? "-"}</div>
                          <div><span className="text-zinc-500">Last run:</span> {agent.lastTaskAt ?? "-"}</div>
                        </div>
                      </div>

                      {agent.issues.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Issues</div>
                          <div className="flex flex-wrap gap-2">
                            {agent.issues.map((issue) => (
                              <Badge key={`${agent.name}-${issue}`} variant="outline">{issue}</Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

