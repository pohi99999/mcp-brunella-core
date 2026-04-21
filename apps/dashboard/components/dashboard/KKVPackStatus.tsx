import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type KkvPackSnapshot } from "@/lib/apiService";

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "healthy" || status === "ready") return "default";
  if (status === "critical" || status === "blocked") return "destructive";
  if (status === "warning" || status === "pilot") return "outline";
  return "secondary";
}

export function KKVPackStatus({ snapshot }: { snapshot: KkvPackSnapshot | null }) {
  if (!snapshot) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="glass-card overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
          <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Overall score</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
            {snapshot.summary.score}
            {snapshot.summary.status === "healthy" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Snapshot status: {snapshot.summary.status}</p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
          <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Ready packs</CardDescription>
          <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot.summary.readyPacks}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Stable boundaries already available for inspection.</p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
          <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Pilot packs</CardDescription>
          <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot.summary.pilotPacks}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-zinc-500">Intentionally bounded product briefs.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={badgeVariant(snapshot.selectedPack.status)}>{snapshot.selectedPack.title}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
          <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Warnings</CardDescription>
          <CardTitle className="text-2xl font-mono text-zinc-100">{snapshot.warnings.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Boundary or launch guardrails still in force.</p>
        </CardContent>
      </Card>
    </div>
  );
}
