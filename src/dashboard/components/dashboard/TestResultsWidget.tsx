import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Play, RefreshCw, Clock, Zap, CheckCircle, XCircle } from "lucide-react";

interface TestStats {
  totalRuns: number;
  passRate: string;
  averageDuration: string;
  lastRunStatus: string;
  lastRunTime: string;
  sevenDayPassRate: string;
}

interface TestRun {
  id: string;
  status: "passed" | "failed" | "running";
  duration: string;
  passed: number;
  failed: number;
  startedAt: string;
}

interface ChartData {
  date: string;
  passRate: number;
  passed: number;
  failed: number;
}

export function TestResultsWidget() {
  const [stats, setStats] = useState<TestStats | null>(null);
  const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch stats
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tests/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      
      const data = await response.json() as TestStats;
      setStats(data);

      // Parse pass rate percentage
      const passRateNum = parseFloat(data.passRate);
      setChartData([
        {
          date: "7d Trend",
          passRate: passRateNum,
          passed: 0,
          failed: 0,
        },
      ]);
    } catch (error) {
      toast.error("Failed to load test statistics");
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent runs
  const fetchRecentRuns = async () => {
    try {
      const response = await fetch("/api/tests/results?limit=10");
      if (!response.ok) throw new Error("Failed to fetch runs");
      
      const data = await response.json();
      setRecentRuns(data.runs || []);
    } catch (error) {
      toast.error("Failed to load recent test runs");
    }
  };

  // Trigger manual run
  const handleTriggerRun = async () => {
    try {
      setTriggering(true);
      const response = await fetch("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerReason: "Manual trigger from dashboard" }),
      });

      if (!response.ok) throw new Error("Failed to trigger test run");

      const data = await response.json();
      toast.success(`Test run triggered: ${data.runId}`);
      
      // Refresh data after a short delay
      setTimeout(() => {
        fetchStats();
        fetchRecentRuns();
      }, 1000);
    } catch (error) {
      toast.error("Failed to trigger test run");
    } finally {
      setTriggering(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchRecentRuns();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
      fetchRecentRuns();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Test Scheduler</p>
          <h2 className="text-xl font-semibold text-zinc-100">Teszt Ütemezés</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchRecentRuns();
            }}
            disabled={loading}
            aria-label="Tesztek frissítése"
            title="Tesztek frissítése"
            className="rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Frissítés
          </Button>
          <Button
            onClick={handleTriggerRun}
            disabled={triggering}
            className="rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            aria-label="Tesztek futtatása"
            title="Tesztek futtatása"
          >
            <Play className={`h-4 w-4 mr-2 ${triggering ? "animate-pulse" : ""}`} />
            {triggering ? "Futtatás..." : "Tesztek Futtatása"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Összes Futás
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-3xl font-semibold font-mono text-zinc-100">{stats.totalRuns}</div>
              <p className="text-xs text-zinc-500 mt-1">lifetime</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Pass Rate (7d)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-3xl font-semibold font-mono text-emerald-300">
                {stats.sevenDayPassRate}
              </div>
              <p className="text-xs text-zinc-500 mt-1">most recent</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Átlagos Futási Idő
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold flex items-center gap-2 text-zinc-100">
                <Clock className="h-5 w-5 text-amber-300" />
                {stats.averageDuration}
              </div>
              <p className="text-xs text-zinc-500 mt-1">avg duration</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">
                Utolsó Futás
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-2xl font-semibold flex items-center gap-2 text-zinc-100">
                {stats.lastRunStatus === "passed" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-300" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-300" />
                )}
                <span className="capitalize">{stats.lastRunStatus}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{stats.lastRunTime}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Pass Rate Trend (7 nap)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
              <YAxis yAxisId="left" stroke="rgba(255,255,255,0.5)" label={{ value: "Pass Rate (%)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.5)" }} />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.5)" label={{ value: "Test Count", angle: 90, position: "insideRight", fill: "rgba(255,255,255,0.5)" }} />
              <Tooltip contentStyle={{ background: "rgba(15, 23, 42, 0.96)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="passRate"
                stroke="#22c55e"
                strokeWidth={2}
                name="Sikeres arány (%)"
              />
              <Bar yAxisId="right" dataKey="passed" fill="#38bdf8" name="Sikeres" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="failed" fill="#f87171" name="Sikertelen" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Runs Table */}
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Utolsó 10 Futás</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.05] text-zinc-400">
                <tr>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-[0.18em] text-[10px]">Státusz</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-[0.18em] text-[10px]">Sikeres</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-[0.18em] text-[10px]">Sikertelen</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-[0.18em] text-[10px]">Futási Idő</th>
                  <th className="text-left py-3 px-4 font-medium uppercase tracking-[0.18em] text-[10px]">Időpont</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-zinc-500">
                      Nincs korábbi futás
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr key={run.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                      <td className="py-2 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            run.status === "passed"
                              ? "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20"
                              : run.status === "failed"
                                ? "bg-red-400/10 text-red-200 border border-red-400/20"
                                : "bg-amber-400/10 text-amber-200 border border-amber-400/20"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-emerald-300 font-medium">
                          {run.passed}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-red-300 font-medium">
                          {run.failed}
                        </span>
                      </td>
                      <td className="py-2 px-4">{run.duration}</td>
                      <td className="py-2 px-4 text-zinc-500 text-xs">
                        {new Date(run.startedAt).toLocaleString("hu-HU")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh Toggle */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id="auto-refresh"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="auto-refresh">
          Auto-frissítés 5 percenként
        </label>
      </div>
    </div>
  );
}
