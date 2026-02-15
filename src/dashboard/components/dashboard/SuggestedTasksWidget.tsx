import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  RefreshCw,
  Zap,
  Filter,
  X,
  AlertTriangle,
} from "lucide-react";

interface SuggestedTask {
  id: string;
  file_path: string;
  line_number: number;
  todo_text: string;
  confidence_score: number;
  status: "pending" | "in_progress" | "completed" | "archived";
  assigned_to?: string;
  created_at: string;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  critical: number; // confidence >= 0.8
  avg_confidence: number;
}

type ConfidenceFilter = "all" | "80+" | "60-80" | "40-60" | "0-40";
type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "archived";

export function SuggestedTasksWidget() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [allTasks, setAllTasks] = useState<SuggestedTask[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<SuggestedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  interface ChartData {
    range?: string;
    count?: number;
    name?: string;
    value?: number;
    color?: string;
  }

  const [confidenceChart, setConfidenceChart] = useState<ChartData[]>([]);
  const [statusChart, setStatusChart] = useState<ChartData[]>([]);

  // Filters
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const STATUS_COLORS: Record<string, string> = {
    pending: "#ef4444",
    in_progress: "#f59e0b",
    completed: "#10b981",
    archived: "#6b7280",
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/suggested-tasks");
      if (!response.ok) throw new Error("Failed to fetch tasks");

      const data = await response.json();
      const tasks = data.data || [];
      setAllTasks(tasks);

      // Compute stats
      const computedStats = {
        total: tasks.length,
        pending: tasks.filter((t: SuggestedTask) => t.status === "pending").length,
        in_progress: tasks.filter((t: SuggestedTask) => t.status === "in_progress")
          .length,
        completed: tasks.filter((t: SuggestedTask) => t.status === "completed").length,
        critical: tasks.filter((t: SuggestedTask) => t.confidence_score >= 0.8).length,
        avg_confidence:
          tasks.length > 0
            ? (
                tasks.reduce((sum: number, t: SuggestedTask) => sum + t.confidence_score, 0) /
                tasks.length
              ).toFixed(2)
            : 0,
      };

      setStats(computedStats);

      // Confidence distribution
      const confidenceBuckets = [
        { range: "80-100%", count: 0 },
        { range: "60-79%", count: 0 },
        { range: "40-59%", count: 0 },
        { range: "0-39%", count: 0 },
      ];

      tasks.forEach((t: SuggestedTask) => {
        const score = t.confidence_score * 100;
        if (score >= 80) confidenceBuckets[0].count++;
        else if (score >= 60) confidenceBuckets[1].count++;
        else if (score >= 40) confidenceBuckets[2].count++;
        else confidenceBuckets[3].count++;
      });

      setConfidenceChart(confidenceBuckets);

      // Status distribution
      setStatusChart([
        {
          name: "Pending",
          value: computedStats.pending,
          color: STATUS_COLORS.pending,
        },
        {
          name: "In Progress",
          value: computedStats.in_progress,
          color: STATUS_COLORS["in_progress"],
        },
        {
          name: "Completed",
          value: computedStats.completed,
          color: STATUS_COLORS.completed,
        },
      ]);

      // Apply initial filters
      applyFilters(tasks, "all", "all");
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : "Failed to load tasks";
      toast.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (
    tasks: SuggestedTask[],
    confFilter: ConfidenceFilter,
    statFilter: StatusFilter
  ) => {
    let result = [...tasks];

    // Confidence filter
    if (confFilter !== "all") {
      result = result.filter((t) => {
        const score = t.confidence_score;
        switch (confFilter) {
          case "80+":
            return score >= 0.8;
          case "60-80":
            return score >= 0.6 && score < 0.8;
          case "40-60":
            return score >= 0.4 && score < 0.6;
          case "0-40":
            return score < 0.4;
          default:
            return true;
        }
      });
    }

    // Status filter
    if (statFilter !== "all") {
      result = result.filter((t) => t.status === statFilter);
    }

    // Sort by confidence
    result.sort((a, b) => b.confidence_score - a.confidence_score);
    setFilteredTasks(result.slice(0, 15)); // Top 15
  };

  const handleConfidenceFilterChange = (newFilter: ConfidenceFilter) => {
    setConfidenceFilter(newFilter);
    applyFilters(allTasks, newFilter, statusFilter);
  };

  const handleStatusFilterChange = (newFilter: StatusFilter) => {
    setStatusFilter(newFilter);
    applyFilters(allTasks, confidenceFilter, newFilter);
  };

  const clearFilters = () => {
    setConfidenceFilter("all");
    setStatusFilter("all");
    applyFilters(allTasks, "all", "all");
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      const response = await fetch("/api/v1/suggested-tasks/scan", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Scan failed");

      const data = await response.json();
      toast.success(`Found ${data.data.count} TODOs`);
      await fetchStats();
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : "Scan failed";
      toast.error(error);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Suggested Tasks (TODOs)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Suggested Tasks
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total} TODOs/FIXMEs detected
            </p>
          </div>
          <Button
            onClick={handleScan}
            disabled={scanning}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
            Scan Now
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={confidenceFilter} onValueChange={handleConfidenceFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="80+">Critical (80%+)</SelectItem>
              <SelectItem value="60-80">High (60-80%)</SelectItem>
              <SelectItem value="40-60">Medium (40-60%)</SelectItem>
              <SelectItem value="0-40">Low (0-40%)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {(confidenceFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-xl font-bold text-blue-700">{stats.in_progress}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-xl font-bold text-green-700">{stats.completed}</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-xs text-muted-foreground">Critical (≥80%)</p>
            <p className="text-xl font-bold text-red-700">{stats.critical}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Confidence Distribution */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Confidence Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confidenceChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusChart}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filtered Tasks List */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">
              Tasks ({filteredTasks.length})
            </h3>
            <span className="text-xs text-muted-foreground">
              Avg Confidence: {(stats.avg_confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tasks match filters</p>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2 p-2 rounded border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {task.file_path}:{task.line_number}
                    </p>
                    <p className="text-sm truncate">{task.todo_text}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge
                        variant={
                          task.confidence_score >= 0.8
                            ? "destructive"
                            : task.confidence_score >= 0.65
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {(task.confidence_score * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                  {task.confidence_score >= 0.8 && (
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-1" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
