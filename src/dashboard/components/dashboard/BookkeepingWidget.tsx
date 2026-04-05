import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { executeAgent, getBookkeepingStatus } from "@/lib/apiService";
import type { BookkeepingStatusResponse } from "@/lib/apiService";
import { toast } from "sonner";
import {
  BarChart3,
  Database,
  Scale,
  RefreshCcw,
  ArrowRightLeft,
} from "lucide-react";

type BookkeepingStatus = "idle" | "ingesting" | "matching" | "success" | "error";

/** Live status refresh interval — 30 seconds */
const REFRESH_INTERVAL_MS = 30_000;

export function BookkeepingWidget() {
  const [status, setStatus] = useState<BookkeepingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ matched: number; total: number; manual: number } | null>(
    null,
  );
  const [liveStatus, setLiveStatus] = useState<BookkeepingStatusResponse | null>(null);

  /**
   * Fetches the current bookkeeping status from the API and stores it in state.
   * Wrapped in useCallback so the identity is stable across re-renders.
   */
  const loadStatus = useCallback(async () => {
    try {
      const data = await getBookkeepingStatus();
      setLiveStatus(data);
    } catch {
      // Status fetch failures are silent — widget degrades gracefully
    }
  }, []);

  // Load on mount and refresh periodically
  useEffect(() => {
    void loadStatus();
    const id = setInterval(loadStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadStatus]);

  const startReconciliation = async () => {
    setStatus("ingesting");
    setProgress(10);
    toast.info("Könyvelési adatok ingesztálása elindult...");

    try {
      // 1. Ingest NAV
      await executeAgent("NavAgent", "Process NAV invoices from samples");
      setProgress(40);

      // 2. Ingest Bank
      await executeAgent("BankAgent", "Process bank transactions from samples");
      setProgress(70);

      setStatus("matching");
      toast.info("Intelligens párosítás folyamatban...");

      // 3. Match
      const matchRes = await executeAgent("MatchingAgent", "Match all PENDING bank transactions");

      if (matchRes.success) {
        setStats(matchRes.data);
        setStatus("success");
        setProgress(100);
        toast.success("A könyvelési egyeztetés sikeresen lefutott.");

        // Refresh live status to reflect the completed run
        await loadStatus();
      } else {
        throw new Error(matchRes.message || "Hiba a párosítás során.");
      }
    } catch (error: unknown) {
      setStatus("error");
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Sikertelen folyamat: ${msg}`);
    }
  };

  const pendingCount = liveStatus?.pendingTransactions ?? 0;
  const exceptionCount = liveStatus?.snapshot?.exceptions?.length ?? 0;
  const totalCount = liveStatus?.summary?.total;
  const readiness = liveStatus?.readiness;
  const readinessValue = readiness
    ? Math.round((readiness.summary.ready / Math.max(readiness.summary.total, 1)) * 100)
    : 0;

  return (
    <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl h-full flex flex-col">
      <CardHeader className="p-4 border-b border-white/[0.04]">
        <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
          <span className="flex items-center gap-2">
            <BarChart3 size={16} className="text-purple-400" />
            Könyvelés Automatizálás
          </span>
          <Badge
            variant={
              status === "success" ? "default" : status === "error" ? "destructive" : "secondary"
            }
          >
            {status.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Live Status Panel */}
          {liveStatus && (
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.04] space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                Élő állapot
              </p>
              <div className="flex gap-4 text-xs font-mono text-white">
                <span>{totalCount}</span>
                <span>Várakozó tételek: {pendingCount}</span>
                <span>Kivételek: {exceptionCount}</span>
              </div>
            </div>
          )}

          {readiness && (
            <div
              className={`p-3 rounded-xl border space-y-2 ${
                readiness.status === "ready"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                  Phase 0 readiness
                </p>
                <Badge
                  variant={readiness.status === "ready" ? "default" : "secondary"}
                  className={
                    readiness.status === "ready"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                  }
                >
                  {readiness.status === "ready" ? "READY" : "BLOCKED"}
                </Badge>
              </div>
              <Progress value={readinessValue} className="h-1 bg-white/[0.04]" />
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
                <span>
                  {readiness.summary.ready}/{readiness.summary.total} kész
                </span>
                <span>{readiness.summary.blocked} hiányzik</span>
              </div>
              {readiness.missing.length > 0 ? (
                <p className="text-xs text-zinc-300">{readiness.missing.join(" · ")}</p>
              ) : (
                <p className="text-xs text-emerald-300">Minden előfeltétel rendben.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                Adatforrások
              </p>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className="text-[9px] bg-purple-500/5 border-purple-500/20 text-purple-400"
                >
                  XML (NAV)
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px] bg-blue-500/5 border-blue-500/20 text-blue-400"
                >
                  CSV (Bank)
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
              <span>Folyamat</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1 bg-white/[0.04]" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                progress >= 40
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-white/[0.02] border-white/[0.04] text-zinc-600"
              }`}
            >
              <Database size={12} />
              <span className="text-[8px] font-bold uppercase">Ingest</span>
            </div>
            <div
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                progress >= 70
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                  : "bg-white/[0.02] border-white/[0.04] text-zinc-600"
              }`}
            >
              <ArrowRightLeft size={12} />
              <span className="text-[8px] font-bold uppercase">Mapping</span>
            </div>
            <div
              className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                progress === 100
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-white/[0.02] border-white/[0.04] text-zinc-600"
              }`}
            >
              <Scale size={12} />
              <span className="text-[8px] font-bold uppercase">Matching</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {stats && (
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.04] space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[8px] text-zinc-500 uppercase font-mono">Összes</p>
                  <p className="text-sm font-bold text-white">{stats.total}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 uppercase font-mono">Páros</p>
                  <p className="text-sm font-bold text-emerald-400">{stats.matched}</p>
                </div>
                <div>
                  <p className="text-[8px] text-zinc-500 uppercase font-mono">Kézi</p>
                  <p className="text-sm font-bold text-yellow-400">{stats.manual}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={startReconciliation}
            disabled={status === "ingesting" || status === "matching"}
            className="w-full gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all hover:scale-[1.01]"
          >
            {status === "ingesting" || status === "matching" ? (
              <RefreshCcw size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
            Párosítás Futtatása
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
