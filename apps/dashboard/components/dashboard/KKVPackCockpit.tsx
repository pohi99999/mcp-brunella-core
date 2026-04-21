import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  PackageSearch,
  RefreshCcw,
  Sparkles,
  Terminal,
  Truck,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getKkvPackSnapshot,
  kkvPackDomainLabels,
  kkvPackStatusLabels,
  kkvPackSurfaceKindLabels,
  type KkvPackResponse,
} from "@/lib/apiService";
import { KKVPackStatus } from "@/components/dashboard/KKVPackStatus";

type PackSurface = {
  kind: string;
  ref: string;
  description: string;
};

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy" || status === "ready") return "default";
  if (status === "critical" || status === "blocked") return "destructive";
  if (status === "warning" || status === "pilot") return "outline";
  return "secondary";
}

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "outline";
  if (priority === "medium") return "secondary";
  return "default";
}

function surfaceIcon(kind: string) {
  if (kind === "route") return <Truck className="h-4 w-4 text-cyan-300" />;
  if (kind === "cli") return <Terminal className="h-4 w-4 text-violet-300" />;
  if (kind === "dashboard") return <Boxes className="h-4 w-4 text-emerald-300" />;
  if (kind === "agent") return <Workflow className="h-4 w-4 text-amber-300" />;
  return <Sparkles className="h-4 w-4 text-fuchsia-300" />;
}

export function KKVPackCockpit() {
  const [response, setResponse] = useState<KkvPackResponse | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>("finance-core");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const snapshot = await getKkvPackSnapshot(selectedPackId);
      setResponse(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`KKV pack cockpit hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedPackId]);

  useEffect(() => {
    void loadSnapshot();
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadSnapshot]);

  const snapshot = response?.snapshot;
  const selectedPack = snapshot?.selectedPack;
  const surfaceGroups = useMemo(() => {
    const groups = new Map<string, PackSurface[]>();
    for (const surface of selectedPack?.surfaces ?? []) {
      const current = groups.get(surface.kind) ?? [];
      current.push(surface);
      groups.set(surface.kind, current);
    }
    return Array.from(groups.entries()).map(([kind, surfaces]) => ({ kind, surfaces }));
  }, [selectedPack]);

  if (loading && !snapshot) {
    return <div className="p-6 text-center text-zinc-400">KKV pack snapshot betoltese...</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-4 text-red-300">
          Hiba: {error}
          <button onClick={() => void loadSnapshot()} className="ml-4 underline">
            Ujraprobalas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">KKV Pack</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Productization Cockpit</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Read-only pack boundary for finance, inventory, and logistics with a shared brief layer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="kkv-pack-select" className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              Selected pack
            </label>
            <select
              id="kkv-pack-select"
              aria-label="Select KKV pack"
              value={selectedPackId}
              onChange={(event) => setSelectedPackId(event.target.value)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 outline-none"
            >
              {snapshot?.packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.title}
                </option>
              ))}
            </select>
          </div>
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

      <KKVPackStatus snapshot={snapshot ?? null} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-card overflow-hidden border-white/10 xl:col-span-2">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <PackageSearch className="h-4 w-4 text-cyan-300" /> Selected pack
            </CardTitle>
            <CardDescription className="text-zinc-500">Boundary, contract set, and product brief for the chosen pack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedPack ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(selectedPack.status)}>{kkvPackStatusLabels[selectedPack.status]}</Badge>
                  <Badge variant="outline">{kkvPackDomainLabels[selectedPack.domain]}</Badge>
                  <Badge variant="secondary">{selectedPack.score}/100</Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-lg font-semibold text-zinc-100">{selectedPack.title}</div>
                  <p className="text-sm text-zinc-400">{selectedPack.valuePromise}</p>
                  <div className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {selectedPack.boundary}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Target users</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPack.targetUsers.map((user) => (
                      <Badge key={user} variant="outline">
                        {user}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Contracts</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPack.contracts.map((contract) => (
                      <Badge key={contract} variant="secondary">
                        {contract}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Pilot criteria</div>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {selectedPack.pilotCriteria.map((criterion) => (
                      <li key={criterion} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">Surfaces</div>
                  <div className="space-y-4">
                    {surfaceGroups.map((group) => (
                      <div key={group.kind} className="rounded-md border border-border/50 bg-background/40 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                          {surfaceIcon(group.kind)}
                          {kkvPackSurfaceKindLabels[group.kind as keyof typeof kkvPackSurfaceKindLabels] ?? group.kind}
                        </div>
                        <div className="space-y-2">
                          {group.surfaces.map((surface) => (
                            <div key={`${group.kind}-${surface.ref}`} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                              <div className="font-mono text-zinc-100">{surface.ref}</div>
                              <div className="text-zinc-400">{surface.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-500">No pack selected.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <ClipboardList className="h-4 w-4 text-emerald-300" /> Pack matrix
              </CardTitle>
              <CardDescription className="text-zinc-500">All pack states in a single boundary-first view.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[280px]">
                <div className="divide-y divide-border/50">
                  {snapshot?.packs.map((pack) => (
                    <div key={pack.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-100">{pack.title}</div>
                          <div className="text-xs text-zinc-500">{pack.boundary}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={badgeVariant(pack.status)}>{kkvPackStatusLabels[pack.status]}</Badge>
                          <Badge variant="secondary">{pack.score}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <Sparkles className="h-4 w-4 text-fuchsia-300" /> Product brief
              </CardTitle>
              <CardDescription className="text-zinc-500">Shared brief for the selected pack.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-300">
              {selectedPack ? (
                <>
                  <div className="font-medium text-zinc-100">{selectedPack.brief.headline}</div>
                  <div>{selectedPack.brief.promise}</div>
                  <div className="rounded-md border border-border/50 bg-background/40 p-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Pilot scope</div>
                    <div className="mt-1 text-zinc-300">{selectedPack.brief.pilotScope}</div>
                  </div>
                  <div className="rounded-md border border-border/50 bg-background/40 p-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Guardrail</div>
                    <div className="mt-1 text-zinc-300">{selectedPack.brief.guardrail}</div>
                  </div>
                </>
              ) : (
                <div className="text-zinc-500">No brief available.</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> Warnings & recommendations
              </CardTitle>
              <CardDescription className="text-zinc-500">Guardrails that should stay visible while the pack matures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {(snapshot?.warnings ?? []).map((warning) => (
                  <div key={warning} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {warning}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {snapshot?.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-zinc-100">{recommendation.title}</div>
                      <Badge variant={priorityVariant(recommendation.priority)}>{recommendation.priority}</Badge>
                    </div>
                    <div className="mt-1 text-zinc-400">{recommendation.rationale}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
