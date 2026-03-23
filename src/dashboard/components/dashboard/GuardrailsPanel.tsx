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

const API_BASE = "http://localhost:3000";

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

  if (loading) return <div className="p-4 text-muted-foreground">Guardrails statisztikák betöltése...</div>;

  const total = (stats?.validationsPassed ?? 0) + (stats?.validationsFailed ?? 0);
  const passRate = total > 0 ? ((stats?.validationsPassed ?? 0) / total * 100).toFixed(1) : '—';

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          Guardrails & Evaluáció
        </h2>
        <button onClick={fetchStats} className="p-2 hover:bg-accent rounded-md">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" /> Validáció OK
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.validationsPassed ?? 0}</div>
            <p className="text-xs text-muted-foreground">Átment: {passRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" /> Validáció Hiba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.validationsFailed ?? 0}</div>
            <p className="text-xs text-muted-foreground">Schema eltérés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-4 w-4 text-blue-500" /> Átl. Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.avgConfidence ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Küszöb: {stats?.confidenceThreshold ?? 0.6}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Lock className="h-4 w-4 text-red-500" /> PII Redakció
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.redactionsTriggered ?? 0}</div>
            <p className="text-xs text-muted-foreground">Automatikus törlés</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Konfiguráció</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Strict Mode:</span>
            <span className={stats?.strictMode ? 'text-red-500 font-bold' : 'text-green-500'}>
              {stats?.strictMode ? 'BE (hard-fail)' : 'KI (soft-fail)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confidence Küszöb:</span>
            <span>{stats?.confidenceThreshold ?? 0.6}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PII Redakció:</span>
            <span className="text-green-500">Aktív</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
