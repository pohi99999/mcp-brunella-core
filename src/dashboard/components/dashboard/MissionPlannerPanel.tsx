import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  RefreshCcw,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getDevExPlannerSnapshot,
  missionSurfaceLabels,
  missionSurfaceValues,
  type DevExPlannerResponse,
  type MissionSurface,
} from "@/lib/apiService";

function scoreVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "default";
  if (status === "warning") return "outline";
  return "destructive";
}

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "outline";
  if (priority === "medium") return "secondary";
  return "default";
}

function statusIcon(status: string) {
  if (status === "healthy") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  }

  return <AlertTriangle className="h-5 w-5 text-amber-400" />;
}

export function MissionPlannerPanel() {
  const [snapshotResponse, setSnapshotResponse] = useState<DevExPlannerResponse | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [surface, setSurface] = useState<MissionSurface | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await getDevExPlannerSnapshot(
        templateId || undefined,
        surface || undefined,
      );
      setSnapshotResponse(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Mission planner hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [surface, templateId]);

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadSnapshot]);

  const snapshot = snapshotResponse?.snapshot;
  const selectedTemplate = snapshot?.selectedTemplate;
  const templates = snapshot?.templates ?? [];
  const mission = snapshot?.mission;
  const recommendations = snapshot?.recommendations ?? [];

  const templateOptions = useMemo(
    () => templates.map((template) => (
      <option key={template.id} value={template.id}>
        {template.title}
      </option>
    )),
    [templates],
  );

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

  const activeTemplateId = templateId || selectedTemplate?.id || "";
  const activeSurface = surface || snapshot?.summary.selectedSurface || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">DevEx</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Mission Planner</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Shared mission template snapshot with steps, artifacts, and the current execution surface.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeTemplateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="min-w-56 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            <option value="" disabled>
              Select a mission template
            </option>
            {templateOptions}
          </select>
          <select
            value={activeSurface}
            onChange={(event) => setSurface(event.target.value as MissionSurface)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            <option value="" disabled>
              Select a surface
            </option>
            {missionSurfaceValues.map((value) => (
              <option key={value} value={value}>
                {missionSurfaceLabels[value]}
              </option>
            ))}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Overall score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
              {snapshot?.summary.score ?? 0}
              {statusIcon(snapshot?.summary.status ?? "critical")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Snapshot status: {snapshot?.summary.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Mission score</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.missionScore ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Template library: {snapshot?.summary.templateCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Cadence score</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.summary.cadenceScore ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              Default tier: {snapshot?.testCadence.defaultTier ?? "unknown"}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Warnings</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.warnings.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Selected surface: {missionSurfaceLabels[snapshot?.summary.selectedSurface ?? "api"]}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-card overflow-hidden border-white/10 xl:col-span-2">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Workflow className="h-4 w-4 text-cyan-300" /> Selected mission
            </CardTitle>
            <CardDescription className="text-zinc-500">The currently selected template, its steps, and expected outputs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-zinc-100">{mission?.title ?? "No template selected"}</div>
                  <div className="text-sm text-zinc-500">{mission?.description}</div>
                </div>
                <Badge variant={scoreVariant(snapshot?.summary.status ?? "critical")}>
                  {snapshot?.summary.status ?? "unknown"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{mission?.surface ? missionSurfaceLabels[mission.surface] : "Surface unknown"}</Badge>
                <Badge variant="outline">{mission?.category ?? "n/a"}</Badge>
                <Badge variant="outline">{selectedTemplate?.id ?? "n/a"}</Badge>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Goal</div>
              <div className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                {mission?.goal ?? "No mission goal loaded."}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Steps</div>
              <ol className="space-y-2">
                {(mission?.steps ?? []).map((step, index) => (
                  <li key={`${mission?.templateId ?? "step"}-${index}`} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    <span className="mr-2 font-mono text-cyan-300">{index + 1}.</span>
                    {step}
                  </li>
                ))}
                {mission?.steps.length === 0 ? <li className="text-sm text-zinc-500">No steps loaded.</li> : null}
              </ol>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Commands</div>
                <div className="space-y-2">
                  {(mission?.commands ?? []).map((command) => (
                    <div key={command} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                      <code>{command}</code>
                    </div>
                  ))}
                  {mission?.commands.length === 0 ? <div className="text-sm text-zinc-500">No commands declared.</div> : null}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Artifacts</div>
                <div className="space-y-2">
                  {(mission?.artifacts ?? []).map((artifact) => (
                    <Badge key={artifact} variant="outline" className="mr-2 mb-2">
                      {artifact}
                    </Badge>
                  ))}
                  {mission?.artifacts.length === 0 ? <div className="text-sm text-zinc-500">No artifacts declared.</div> : null}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Related tracks</div>
              <div className="space-y-2">
                {(mission?.trackRefs ?? []).map((trackRef) => (
                  <div key={trackRef} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    <code>{trackRef}</code>
                  </div>
                ))}
                {mission?.trackRefs.length === 0 ? <div className="text-sm text-zinc-500">No related tracks listed.</div> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <ClipboardList className="h-4 w-4 text-emerald-300" /> Template library
              </CardTitle>
              <CardDescription className="text-zinc-500">The available mission templates loaded from /missions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                <div className="divide-y divide-border/50">
                  {templates.length === 0 ? (
                    <div className="p-4 text-zinc-500">No templates loaded.</div>
                  ) : (
                    templates.map((template) => (
                      <div key={template.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-zinc-100">{template.title}</div>
                            <div className="text-xs text-zinc-500">{template.description}</div>
                          </div>
                          <Badge variant={template.id === mission?.templateId ? "default" : "outline"}>
                            {template.id === mission?.templateId ? "selected" : template.id}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">{missionSurfaceLabels[template.surface]}</Badge>
                          <Badge variant="outline">{template.category}</Badge>
                          <Badge variant="outline">{template.tags.join(", ") || "untagged"}</Badge>
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
                <Sparkles className="h-4 w-4 text-violet-300" /> Mission recommendations
              </CardTitle>
              <CardDescription className="text-zinc-500">High-signal suggestions for tightening the selected template.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.filter((item) => item.target !== "cadence").length === 0 ? (
                <div className="text-sm text-emerald-400">No mission recommendations.</div>
              ) : (
                recommendations
                  .filter((item) => item.target !== "cadence")
                  .map((recommendation) => (
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
                <Rocket className="h-4 w-4 text-orange-300" /> Notes
              </CardTitle>
              <CardDescription className="text-zinc-500">Snapshot warnings for the current mission selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot?.warnings.length === 0 ? (
                <div className="text-sm text-emerald-400">No warnings.</div>
              ) : (
                snapshot?.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {warning}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
