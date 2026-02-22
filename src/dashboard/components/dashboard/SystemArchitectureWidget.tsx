/**
 * SystemArchitectureWidget
 * Track: bas_orchestration_chain_20260221 / Phase 3 / Task 3.1
 *
 * A 4 réteg (Ingestion, Knowledge, Orchestration, Security) valós idejű státusza.
 * 10 másodpercenként frissül automatikusan.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Brain,
  Network,
  Shield,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { getArchitectureStatus, type ArchitectureStatus } from "@/lib/apiService";

const POLL_INTERVAL_MS = 10_000;

function StatusBadge({ status }: { status: string }) {
  const isOk = status === "healthy" || status === "hardened";
  return (
    <Badge
      variant={isOk ? "default" : "destructive"}
      className={`text-xs ${isOk ? "bg-emerald-600/80" : "bg-red-600/80"}`}
    >
      {isOk ? (
        <CheckCircle size={10} className="mr-1 inline" />
      ) : (
        <AlertTriangle size={10} className="mr-1 inline" />
      )}
      {status}
    </Badge>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center text-sm py-0.5">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-100 font-mono">{value}</span>
    </div>
  );
}

export function SystemArchitectureWidget() {
  const [data, setData] = useState<ArchitectureStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const status = await getArchitectureStatus();
      setData(status);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">System Architecture</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Glass Box — 4 réteg valós idejű státusza
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              {lastUpdated.toLocaleTimeString("hu-HU")}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-7 px-2"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-700/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 1. Ingestion Layer */}
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Database size={14} className="text-blue-400" />
                Ingestion
              </span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                data && <StatusBadge status={data.ingestion.status} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-8 w-full" />
            ) : data ? (
              <>
                <MetricRow label="LanceDB rekordok" value={data.ingestion.lancedbRows} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* 2. Knowledge Layer */}
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Brain size={14} className="text-purple-400" />
                Knowledge
              </span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                data && <StatusBadge status={data.knowledge.status} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : data ? (
              <>
                <MetricRow label="Pending task" value={data.knowledge.sqliteTasksPending} />
                <MetricRow label="Kész task" value={data.knowledge.sqliteTasksDone} />
                <MetricRow label="Hibás task" value={data.knowledge.sqliteTasksFailed} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* 3. Orchestration Layer */}
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Network size={14} className="text-emerald-400" />
                Orchestration
              </span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                data && <StatusBadge status={data.orchestration.status} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : data ? (
              <>
                <MetricRow label="Összes agent" value={data.orchestration.totalAgents} />
                <MetricRow label="Aktív" value={data.orchestration.activeAgents} />
                <MetricRow label="Tétlen" value={data.orchestration.idleAgents} />
                <MetricRow
                  label="Chaining"
                  value={data.orchestration.chainEnabled ? "BE" : "KI"}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* 4. Security Layer */}
        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-zinc-200">
              <span className="flex items-center gap-1.5">
                <Shield size={14} className="text-amber-400" />
                Security
              </span>
              {loading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                data && <StatusBadge status={data.security.status} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : data ? (
              <>
                <MetricRow
                  label="E2B Sandbox"
                  value={data.security.sandboxEnabled ? "BE" : "KI"}
                />
                <MetricRow
                  label="Guardrails"
                  value={data.security.guardrailsEnabled ? "BE" : "KI"}
                />
                <MetricRow label="Golden minták" value={data.security.goldenSamples} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
