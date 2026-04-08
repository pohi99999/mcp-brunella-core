import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDocsConfigHealth, type DocsConfigHealthResponse } from "@/lib/apiService";

function badgeVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "high") return "default";
  if (priority === "medium") return "outline";
  return "secondary";
}

export function ConfigHealthPanel() {
  const [snapshot, setSnapshot] = useState<DocsConfigHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = async () => {
    try {
      const response = await getDocsConfigHealth();
      setSnapshot(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Config health betöltési hiba: ${message}`);
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

  const configReport = snapshot?.config;
  const docsReport = snapshot?.docs;
  const missingFromDocs = useMemo(() => configReport?.missingFromDocs ?? [], [configReport]);
  const missingFromExample = useMemo(() => configReport?.missingFromExample ?? [], [configReport]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Config Guardian</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Configuration Health</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Runtime env coverage, example drift, and PAIOS YAML bindings compared against the live Brunella source model.
          </p>
        </div>
        <Button onClick={() => void loadSnapshot()} variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Config score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
              {configReport?.summary.score ?? 0}
              {(configReport?.summary.status ?? "critical") === "healthy" ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Status: {configReport?.summary.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Docs coverage</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{configReport?.summary.docsCoveragePercent ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Runtime keys documented in canonical docs</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Example coverage</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{configReport?.summary.exampleCoveragePercent ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Runtime keys represented in .env.example</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Drift</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{configReport?.yamlBindingsMissingFromRuntime.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">PAIOS YAML bindings without a runtime match</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="glass-card border-white/10 xl:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <AlertTriangle className="w-4 h-4 text-amber-300" /> Coverage gaps
            </CardTitle>
            <CardDescription className="text-zinc-500">Keys that need docs or .env.example alignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Missing from docs</div>
              <div className="space-y-2">
                {missingFromDocs.length === 0 ? (
                  <div className="text-sm text-emerald-400">No docs gaps.</div>
                ) : (
                  missingFromDocs.map((entry) => (
                    <div key={entry.key} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-zinc-100">{entry.key}</div>
                        <Badge variant="outline">{entry.sources.join(", ") || "-"}</Badge>
                      </div>
                      <div className="text-xs text-zinc-500">Docs hits: {entry.inDocs.join(", ") || "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Missing from .env.example</div>
              <div className="space-y-2">
                {missingFromExample.length === 0 ? (
                  <div className="text-sm text-emerald-400">No example gaps.</div>
                ) : (
                  missingFromExample.map((entry) => (
                    <div key={entry.key} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-zinc-100">{entry.key}</div>
                        <Badge variant="outline">{entry.sources.join(", ") || "-"}</Badge>
                      </div>
                      <div className="text-xs text-zinc-500">Docs hits: {entry.inDocs.join(", ") || "-"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-300" /> YAML drift
              </CardTitle>
              <CardDescription className="text-zinc-500">Bindings that the runtime does not currently advertise.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {snapshot?.config.yamlBindingsMissingFromRuntime.length === 0 ? (
                <div className="text-sm text-emerald-400">No YAML drift detected.</div>
              ) : (
                snapshot?.config.yamlBindingsMissingFromRuntime.map((key) => (
                  <div key={key} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {key}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(configReport?.recommendations ?? []).length === 0 ? (
                <div className="text-sm text-emerald-400">No recommendations.</div>
              ) : (
                configReport?.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{recommendation.title}</div>
                      <Badge variant={badgeVariant(recommendation.priority)}>{recommendation.priority}</Badge>
                    </div>
                    <div className="text-xs text-zinc-500">{recommendation.rationale}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Docs report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-300">
              <div>Docs report status: <span className="text-zinc-100">{docsReport?.summary.status ?? "unknown"}</span></div>
              <div>Canonical docs: <span className="text-zinc-100">{docsReport?.summary.requiredPresent ?? 0}/{docsReport?.summary.requiredTotal ?? 0}</span></div>
              <div>Managed blocks: <span className="text-zinc-100">{docsReport?.summary.managedHealthy ?? 0}/{docsReport?.summary.managedTotal ?? 0}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

