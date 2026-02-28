/**
 * Harvest Pipeline Widget — Mission Control
 *
 * Megjeleníti az adatgyűjtő pipeline (Tech-Harvester) státuszát:
 * - Utolsó harvest futás ideje és eredménye
 * - LanceDB rekordok száma
 * - Golden Dataset mérete
 * - Pipeline indítás gomb
 */

import { useEffect, useState, useCallback } from "react";
import { Database, RefreshCw, Play, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HarvestStatus {
  lastRun?: string;
  recordsIndexed?: number;
  goldenDatasetSize?: number;
  status: "idle" | "running" | "success" | "error";
  lastError?: string;
  mode?: string;
}

const API_BASE = "/api/v1/python-workers";

async function fetchHarvestStatus(): Promise<HarvestStatus> {
  try {
    const res = await fetch(`${API_BASE}/harvest-status`);
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch {
    return { status: "idle" };
  }
}

async function triggerHarvest(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/harvest-run`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

export function HarvestPipelineWidget() {
  const [status, setStatus] = useState<HarvestStatus>({ status: "idle" });
  const [isLoading, setIsLoading] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchHarvestStatus();
      setStatus(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // 1 perces frissítés
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRun = async () => {
    setIsTriggering(true);
    setStatus((prev) => ({ ...prev, status: "running" }));
    const ok = await triggerHarvest();
    if (!ok) {
      setStatus((prev) => ({ ...prev, status: "error", lastError: "Indítás sikertelen" }));
    }
    setIsTriggering(false);
    // 5mp után frissítünk
    setTimeout(refresh, 5000);
  };

  const statusIcon = {
    idle: <Clock size={14} className="text-zinc-500" />,
    running: <RefreshCw size={14} className="text-blue-400 animate-spin" />,
    success: <CheckCircle size={14} className="text-emerald-400" />,
    error: <AlertCircle size={14} className="text-red-400" />,
  }[status.status];

  const statusLabel = {
    idle: "Inaktív",
    running: "Fut...",
    success: "Sikeres",
    error: "Hiba",
  }[status.status];

  const statusColor = {
    idle: "text-zinc-500",
    running: "text-blue-400",
    success: "text-emerald-400",
    error: "text-red-400",
  }[status.status];

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Database size={14} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider">Harvest Pipeline</p>
            <p className="text-[10px] text-zinc-500 font-mono">DATA_FLYWHEEL</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-30"
          title="Frissítés"
        >
          <RefreshCw size={12} className={cn(isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-lg px-3 py-2 shrink-0">
        {statusIcon}
        <span className={cn("text-xs font-mono font-bold", statusColor)}>{statusLabel}</span>
        {status.lastRun && (
          <span className="text-[10px] text-zinc-600 ml-auto font-mono">
            {new Date(status.lastRun).toLocaleString("hu-HU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        <div className="bg-white/3 border border-white/5 rounded-lg p-3 flex flex-col justify-between">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">LanceDB</p>
          <div>
            <p className="text-xl font-bold text-white tabular-nums">
              {status.recordsIndexed != null ? status.recordsIndexed.toLocaleString("hu-HU") : "—"}
            </p>
            <p className="text-[10px] text-zinc-600">rekord indexelve</p>
          </div>
        </div>

        <div className="bg-white/3 border border-white/5 rounded-lg p-3 flex flex-col justify-between">
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Golden DS</p>
          <div>
            <p className="text-xl font-bold text-white tabular-nums">
              {status.goldenDatasetSize != null ? status.goldenDatasetSize.toLocaleString("hu-HU") : "—"}
            </p>
            <p className="text-[10px] text-zinc-600">sample</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {status.lastError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 shrink-0">
          <p className="text-[10px] text-red-400 font-mono truncate">{status.lastError}</p>
        </div>
      )}

      {/* Run button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleRun}
        disabled={isTriggering || status.status === "running"}
        className="w-full shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-mono gap-2 disabled:opacity-40"
      >
        <Play size={12} />
        {isTriggering ? "Indítás..." : "Harvest Futtatás"}
      </Button>
    </div>
  );
}
