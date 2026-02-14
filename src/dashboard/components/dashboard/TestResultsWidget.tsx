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
import { apiService } from "@/lib/apiService";

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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Teszt Ütemezés (Test Scheduler)</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats();
              fetchRecentRuns();
            }}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Frissítés
          </Button>
          <Button
            onClick={handleTriggerRun}
            disabled={triggering}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Play className="h-4 w-4 mr-2" />
            {triggering ? "Futtatás..." : "Tesztek Futtatása"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Összes Futás
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalRuns}</div>
              <p className="text-xs text-gray-500 mt-1">lifetime</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pass Rate (7d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.sevenDayPassRate}
              </div>
              <p className="text-xs text-gray-500 mt-1">most recent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Átlagos Futási Idő
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                {stats.averageDuration}
              </div>
              <p className="text-xs text-gray-500 mt-1">avg duration</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Utolsó Futás
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {stats.lastRunStatus === "passed" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="capitalize">{stats.lastRunStatus}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{stats.lastRunTime}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Pass Rate Trend (7 nap)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" label={{ value: "Pass Rate (%)", angle: -90, position: "insideLeft" }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: "Test Count", angle: 90, position: "insideRight" }} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="passRate"
                stroke="#10b981"
                strokeWidth={2}
                name="Sikeres arány (%)"
              />
              <Bar yAxisId="right" dataKey="passed" fill="#3b82f6" name="Sikeres" />
              <Bar yAxisId="right" dataKey="failed" fill="#ef4444" name="Sikertelen" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Utolsó 10 Futás</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-4 font-medium">Státusz</th>
                  <th className="text-left py-2 px-4 font-medium">Sikeres</th>
                  <th className="text-left py-2 px-4 font-medium">Sikertelen</th>
                  <th className="text-left py-2 px-4 font-medium">Futási Idő</th>
                  <th className="text-left py-2 px-4 font-medium">Időpont</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-gray-500">
                      Nincs korábbi futás
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr key={run.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            run.status === "passed"
                              ? "bg-green-100 text-green-800"
                              : run.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-green-600 font-medium">
                          {run.passed}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-red-600 font-medium">
                          {run.failed}
                        </span>
                      </td>
                      <td className="py-2 px-4">{run.duration}</td>
                      <td className="py-2 px-4 text-gray-500 text-xs">
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
