/**
 * TelemetryPanel — OpenTelemetry & Observability Dashboard
 * Track: observability_opentelemetry_20260323 Phase 4
 *
 * Megjelenít: Agent trace-ek, LLM token használat, provider költségek,
 * aktív spanek, trace timeline.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, DollarSign, Timer, Layers, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "http://localhost:3000";

interface TelemetryStats {
  activeSpans: number;
  completedSpans: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokensByAgent: Record<string, { input: number; output: number }>;
  tokensByModel: Record<string, { input: number; output: number }>;
  recentTraces: Array<{
    traceId: string;
    agentName: string;
    operation: string;
    duration: number;
    status: string;
  }>;
}

export function TelemetryPanel() {
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/telemetry/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      setStats({
        activeSpans: 0,
        completedSpans: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        tokensByAgent: {},
        tokensByModel: {},
        recentTraces: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <Card className="glass-card border-white/10 overflow-hidden"><CardContent className="p-4 text-zinc-500">Telemetria betöltése...</CardContent></Card>;

  const formatTokens = (n: number) => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const formatMs = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400 flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" />
          Telemetria & Traces
        </h2>
        <button onClick={fetchStats} className="p-2 hover:bg-white/[0.05] rounded-full border border-white/[0.05] bg-white/[0.02]">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <Layers className="h-4 w-4 text-orange-300" /> Aktív Spanek
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{stats?.activeSpans ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <Timer className="h-4 w-4 text-emerald-300" /> Befejezett
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{stats?.completedSpans ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <Cpu className="h-4 w-4 text-violet-300" /> Input Tokenek
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{formatTokens(stats?.totalInputTokens ?? 0)}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-amber-300" /> Output Tokenek
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{formatTokens(stats?.totalOutputTokens ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Traces */}
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Legutóbbi Trace-ek</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {stats?.recentTraces && stats.recentTraces.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {stats.recentTraces.slice(0, 20).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", t.status === 'success' ? 'bg-emerald-400' : t.status === 'error' ? 'bg-red-400' : 'bg-amber-400')} />
                    <span className="font-medium text-zinc-100">{t.agentName}</span>
                    <span className="text-zinc-500">{t.operation}</span>
                  </div>
                  <span className="text-zinc-500">{formatMs(t.duration)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Még nincs trace adat.</p>
          )}
        </CardContent>
      </Card>

      {/* Token Usage by Model */}
      {stats?.tokensByModel && Object.keys(stats.tokensByModel).length > 0 && (
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Token Használat Modell Szerint</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {Object.entries(stats.tokensByModel).map(([model, usage]) => (
                <div key={model} className="flex items-center justify-between text-sm rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                  <span className="font-medium text-zinc-100">{model}</span>
                  <span className="text-zinc-500">
                    ↑{formatTokens(usage.input)} / ↓{formatTokens(usage.output)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
