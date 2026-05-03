/**
 * GuardrailsPanel — Guardrails & Evaluation Dashboard
 * Track: guardrails_evaluation_20260323 Phase 4
 *
 * Megjelenít: Schema validációs statisztikák, Confidence score eloszlás,
 * PII redakció napló, Guardrails konfiguráció.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle, Lock, BarChart3, RefreshCw } from "lucide-react";

// Same-origin: works via Vite proxy in dev and directly in production.
const API_BASE = "";

interface GuardrailsStats {
  validationsPassed: number;
  validationsFailed: number;
  avgConfidence: number;
  redactionsTriggered: number;
  strictMode: boolean;
  confidenceThreshold: number;
}

export function GuardrailsPanel() {
  const [stats, setStats] = useState<GuardrailsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/guardrails/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // API nem elérhető — alapértelmezett adatok
      setStats({
        validationsPassed: 0,
        validationsFailed: 0,
        avgConfidence: 0,
        redactionsTriggered: 0,
        strictMode: process.env.GUARDRAILS_STRICT === 'true',
        confidenceThreshold: 0.6,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <Card className="glass-card border-white/10"><CardContent className="p-4 text-zinc-500">Guardrails statisztikák betöltése...</CardContent></Card>;

  const total = (stats?.validationsPassed ?? 0) + (stats?.validationsFailed ?? 0);
  const passRate = total > 0 ? ((stats?.validationsPassed ?? 0) / total * 100).toFixed(1) : '—';

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Safety / Eval</p>
          <h2 className="text-2xl font-semibold flex items-center gap-2 text-zinc-100">
            <Shield className="h-5 w-5 text-emerald-300" />
          Guardrails & Evaluáció
          </h2>
        </div>
        <button onClick={fetchStats} className="p-2 hover:bg-white/[0.05] rounded-md border border-white/[0.05]">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-emerald-300" /> Validáció OK
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{stats?.validationsPassed ?? 0}</div>
            <p className="text-xs text-zinc-500">Átment: {passRate}%</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-300" /> Validáció Hiba
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{stats?.validationsFailed ?? 0}</div>
            <p className="text-xs text-zinc-500">Schema eltérés</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <BarChart3 className="h-4 w-4 text-violet-300" /> Átl. Confidence
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{(stats?.avgConfidence ?? 0).toFixed(2)}</div>
            <p className="text-xs text-zinc-500">Küszöb: {stats?.confidenceThreshold ?? 0.6}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400 flex items-center gap-1">
              <Lock className="h-4 w-4 text-red-300" /> PII Redakció
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold font-mono text-zinc-100">{stats?.redactionsTriggered ?? 0}</div>
            <p className="text-xs text-zinc-500">Automatikus törlés</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Konfiguráció</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 p-4">
          <div className="flex justify-between">
            <span className="text-zinc-500">Strict Mode:</span>
            <span className={stats?.strictMode ? 'text-red-500 font-bold' : 'text-green-500'}>
              {stats?.strictMode ? 'BE (hard-fail)' : 'KI (soft-fail)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Confidence Küszöb:</span>
            <span>{stats?.confidenceThreshold ?? 0.6}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">PII Redakció:</span>
            <span className="text-green-500">Aktív</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
