import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDocsConfigHealth, type DocsConfigHealthResponse } from "@/lib/apiService";

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy") return "default";
  if (status === "critical") return "destructive";
  if (status === "warning") return "outline";
  return "secondary";
}

export function DocsSotPanel() {
  const [snapshot, setSnapshot] = useState<DocsConfigHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = async () => {
    try {
      const response = await getDocsConfigHealth();
      setSnapshot(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Docs/config SOT hiba: ${message}`);
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

  const docsReport = snapshot?.docs;
  const configReport = snapshot?.config;
  const documents = snapshot?.snapshot.documents.surfaces ?? [];
  const canonicalDocs = useMemo(
    () => documents.filter((surface) => surface.kind === "doc"),
    [documents],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Docs Fabric</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Documentation / Config SOT</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Canonical, read-only snapshot for Brunella docs surfaces, generated blocks, and runtime config coverage.
          </p>
        </div>
        <Button onClick={() => void loadSnapshot()} variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Overall score</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
              {snapshot?.snapshot.summary.score ?? 0}
              {(snapshot?.snapshot.summary.status ?? "critical") === "healthy" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Unified SOT status: {snapshot?.snapshot.summary.status ?? "unknown"}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Docs coverage</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.snapshot.documents.coveragePercent ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {snapshot?.snapshot.documents.presentRequiredCount ?? 0} / {snapshot?.snapshot.documents.requiredCount ?? 0} canonical docs present
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Managed docs</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.snapshot.documents.managedCoveragePercent ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {snapshot?.snapshot.documents.managedHealthyCount ?? 0} / {snapshot?.snapshot.documents.managedCount ?? 0} generated blocks healthy
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">Runtime keys</CardDescription>
            <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot?.snapshot.config.runtimeKeys.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">{snapshot?.snapshot.config.yamlBindingsMissingFromRuntime.length ?? 0} YAML bindings drift</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="glass-card border-white/10 xl:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
              <FileText className="w-4 h-4 text-cyan-300" /> Canonical documents
            </CardTitle>
            <CardDescription className="text-zinc-500">Source-of-truth docs and their generated marker blocks.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[760px]">
              <div className="divide-y divide-border/50">
                {loading && !snapshot ? (
                  <div className="p-4 text-zinc-500">Loading docs/config snapshot...</div>
                ) : canonicalDocs.length === 0 ? (
                  <div className="p-4 text-zinc-500">No canonical documents found.</div>
                ) : (
                  canonicalDocs.map((surface) => (
                    <div key={surface.path} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-100">{surface.name}</div>
                          <div className="text-xs text-zinc-500">{surface.path}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={surface.present ? "default" : "destructive"}>{surface.present ? "present" : "missing"}</Badge>
                          <Badge variant={surface.matchedMarkers.length > 0 ? "default" : "outline"}>
                            {surface.matchedMarkers.length > 0 ? "generated" : "marker missing"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">
                        {surface.lines} lines · {surface.characters} chars · expected markers: {surface.expectedMarkers.join(", ") || "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-300" /> Docs findings
              </CardTitle>
              <CardDescription className="text-zinc-500">Unifier findings and repair recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(docsReport?.findings ?? []).length === 0 ? (
                <div className="text-sm text-emerald-400">No docs findings.</div>
              ) : (
                docsReport?.findings.map((finding) => (
                  <div key={finding.id} className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{finding.message}</div>
                      <Badge variant={badgeVariant(finding.severity)}>{finding.severity}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {finding.surfaces.map((surface) => (
                        <Badge key={`${finding.id}-${surface}`} variant="outline">{surface}</Badge>
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
                <AlertTriangle className="w-4 h-4 text-amber-300" /> Health notes
              </CardTitle>
              <CardDescription className="text-zinc-500">Combined docs/config warnings from the current snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(snapshot?.snapshot.warnings ?? []).length === 0 ? (
                <div className="text-sm text-emerald-400">No warnings.</div>
              ) : (
                snapshot?.snapshot.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm text-zinc-300">
                    {warning}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Config summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-300">
              <div>Docs health: <span className="text-zinc-100">{docsReport?.summary.status ?? "unknown"}</span></div>
              <div>Config health: <span className="text-zinc-100">{configReport?.summary.status ?? "unknown"}</span></div>
              <div>Example coverage: <span className="text-zinc-100">{configReport?.summary.exampleCoveragePercent ?? 0}%</span></div>
              <div>Missing from docs: <span className="text-zinc-100">{configReport?.missingFromDocs.length ?? 0}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

