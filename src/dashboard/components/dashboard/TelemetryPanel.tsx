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

  if (loading) return <div className="p-4 text-muted-foreground">Telemetria betöltése...</div>;

  const formatTokens = (n: number) => n > 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const formatMs = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Telemetria & Traces
        </h2>
        <button onClick={fetchStats} className="p-2 hover:bg-accent rounded-md">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-4 w-4 text-orange-500" /> Aktív Spanek
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSpans ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Timer className="h-4 w-4 text-green-500" /> Befejezett
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedSpans ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Cpu className="h-4 w-4 text-purple-500" /> Input Tokenek
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(stats?.totalInputTokens ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-yellow-500" /> Output Tokenek
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(stats?.totalOutputTokens ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Traces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legutóbbi Trace-ek</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentTraces && stats.recentTraces.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats.recentTraces.slice(0, 20).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.status === 'success' ? 'bg-green-500' : t.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="font-medium">{t.agentName}</span>
                    <span className="text-muted-foreground">{t.operation}</span>
                  </div>
                  <span className="text-muted-foreground">{formatMs(t.duration)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Még nincs trace adat.</p>
          )}
        </CardContent>
      </Card>

      {/* Token Usage by Model */}
      {stats?.tokensByModel && Object.keys(stats.tokensByModel).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Token Használat Modell Szerint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.tokensByModel).map(([model, usage]) => (
                <div key={model} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{model}</span>
                  <span className="text-muted-foreground">
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
