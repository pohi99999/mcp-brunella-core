import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  FlaskConical,
  Gauge,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDevExPlannerSnapshot,
  missionSurfaceLabels,
  missionSurfaceValues,
  testCadenceTierLabels,
  testCadenceTierValues,
  type DevExPlannerResponse,
  type MissionSurface,
  type TestCadenceTier,
} from "@/lib/apiService";

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

export function TestPlanPanel() {
  const [snapshotResponse, setSnapshotResponse] = useState<DevExPlannerResponse | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [surface, setSurface] = useState<MissionSurface | "">("");
  const [tier, setTier] = useState<TestCadenceTier | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await getDevExPlannerSnapshot(
        templateId || undefined,
        surface || undefined,
        tier || undefined,
      );
      setSnapshotResponse(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Test cadence hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [surface, templateId, tier]);

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadSnapshot]);

  const snapshot = snapshotResponse?.snapshot;
  const templates = snapshot?.templates ?? [];
  const mission = snapshot?.mission;
  const cadence = snapshot?.testCadence;
  const cadenceRecommendations = (snapshot?.recommendations ?? []).filter((recommendation) => recommendation.target !== "mission");

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

  const activeTemplateId = templateId || snapshot?.selectedTemplate.id || "";
  const activeSurface = surface || snapshot?.summary.selectedSurface || "";
  const activeTier = tier || cadence?.selectedTier || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">DevEx</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Test Cadence</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Surface-aware test planning with minimal, recommended, and full validation tiers.
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
          <select
            value={activeTier}
            onChange={(event) => setTier(event.target.value as TestCadenceTier)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
          >
            <option value="" disabled>
              Select a tier
            </option>
            {testCadenceTierValues.map((value) => (
              <option key={value} value={value}>
                {testCadenceTierLabels[value]}
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
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Cadence score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
              {snapshot?.summary.cadenceScore ?? 0}
              {statusIcon(cadence?.status ?? "critical")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Snapshot status: {snapshot?.summary.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Selected tier</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{cadence?.selectedTier ?? "n/a"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Default tier: {cadence?.defaultTier ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Warnings</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{cadence?.warnings.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Recommended commands: {cadence?.recommendedCommands.length ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="glass-card overflow-hidden border-white/10">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
            <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Surface</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{mission ? missionSurfaceLabels[mission.surface] : "n/a"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Selected template: {snapshot?.selectedTemplate.title ?? "n/a"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-card overflow-hidden border-white/10 xl:col-span-2">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <Gauge className="h-4 w-4 text-cyan-300" /> Cadence matrix
            </CardTitle>
            <CardDescription className="text-zinc-500">Minimal, recommended, and full tiers for the selected surface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cadence?.tiers.map((tierItem) => (
              <div
                key={tierItem.tier}
                className={`rounded-md border p-4 ${tierItem.tier === cadence.selectedTier ? "border-cyan-400/40 bg-cyan-400/10" : "border-border/50 bg-background/40"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-100">{tierItem.title}</div>
                    <div className="text-sm text-zinc-400">{tierItem.rationale}</div>
                  </div>
                  <Badge variant={tierItem.tier === cadence.selectedTier ? "default" : "outline"}>
                    {tierItem.tier === cadence.selectedTier ? "selected" : tierItem.tier}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {tierItem.commands.map((command) => (
                    <div key={`${tierItem.tier}-${command}`} className="rounded-md border border-white/5 bg-black/20 p-2 text-sm text-zinc-300">
                      <code>{command}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <FlaskConical className="h-4 w-4 text-emerald-300" /> Recommended commands
              </CardTitle>
              <CardDescription className="text-zinc-500">The command set that matches the selected tier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(cadence?.recommendedCommands ?? []).map((command) => (
                <div key={command} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                  <code>{command}</code>
                </div>
              ))}
              {cadence?.recommendedCommands.length === 0 ? (
                <div className="text-sm text-zinc-500">No commands selected.</div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <Sparkles className="h-4 w-4 text-violet-300" /> Warnings
              </CardTitle>
              <CardDescription className="text-zinc-500">Surface or tier notes that should be visible in the run note.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {cadence?.warnings.length === 0 ? (
                <div className="text-sm text-emerald-400">No warnings.</div>
              ) : (
                cadence?.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {warning}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <Sparkles className="h-4 w-4 text-violet-300" /> Recommendations
              </CardTitle>
              <CardDescription className="text-zinc-500">Mission and cadence advice for the current selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cadenceRecommendations.length === 0 ? (
                <div className="text-sm text-emerald-400">No recommendations.</div>
              ) : (
                cadenceRecommendations.map((recommendation) => (
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
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Selected mission context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-300">
              <div>Template: <span className="text-zinc-100">{snapshot?.selectedTemplate.title ?? "n/a"}</span></div>
              <div>Surface: <span className="text-zinc-100">{snapshot?.summary.selectedSurface ? missionSurfaceLabels[snapshot.summary.selectedSurface] : "n/a"}</span></div>
              <div>Mission score: <span className="text-zinc-100">{snapshot?.summary.missionScore ?? 0}</span></div>
              <div>Template count: <span className="text-zinc-100">{snapshot?.summary.templateCount ?? 0}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
