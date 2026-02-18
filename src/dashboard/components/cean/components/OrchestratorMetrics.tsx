import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Zap, TrendingUp, RefreshCw, Clock } from 'lucide-react';
import { logInfo, logError } from '@/utils/logger';

interface MetricsData {
  status: 'healthy' | 'degraded' | 'offline';
  worker: string;
  timestamp: string;
  tasks_total: number;
}

interface TaskStats {
  agent_type: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  running_tasks: number;
}

/**
 * OrchestratorMetrics Component
 * Displays real-time metrics from CEAN Orchestrator
 * 
 * Features:
 * - Health status monitoring
 * - Task statistics (total, completed, running, failed)
 * - Cost tracking
 * - Auto-refresh every 10s
 */
export const OrchestratorMetrics = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [stats, setStats] = useState<TaskStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch health status
      const healthResponse = await fetch(
        'https://cean-orchestrator.iam-dd1.workers.dev/health'
      );
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.statusText}`);
      }
      const healthData = (await healthResponse.json()) as MetricsData;
      setMetrics(healthData);

      // Fetch stats
      const statsResponse = await fetch(
        'https://cean-orchestrator.iam-dd1.workers.dev/stats'
      );
      if (!statsResponse.ok) {
        throw new Error(`Stats fetch failed: ${statsResponse.statusText}`);
      }
      const statsData = (await statsResponse.json()) as TaskStats[];
      setStats(statsData);

      setLastUpdate(new Date());
      logInfo('OrchestratorMetrics', 'Metrics updated successfully');
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      logError('OrchestratorMetrics', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 border-green-500/30 text-green-700';
      case 'degraded':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700';
      case 'offline':
        return 'bg-red-500/10 border-red-500/30 text-red-700';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'offline':
        return '❌';
      default:
        return '❓';
    }
  };

  const totalTasks = stats.reduce((sum, s) => sum + (s.total_tasks || 0), 0);
  const completedTasks = stats.reduce(
    (sum, s) => sum + (s.completed_tasks || 0),
    0
  );
  const failedTasks = stats.reduce((sum, s) => sum + (s.failed_tasks || 0), 0);
  const runningTasks = stats.reduce((sum, s) => sum + (s.running_tasks || 0), 0);

  const successRate =
    totalTasks > 0 ? Math.round(((completedTasks / totalTasks) * 100) * 100) / 100 : 0;
  const errorRate =
    totalTasks > 0 ? Math.round(((failedTasks / totalTasks) * 100) * 100) / 100 : 0;

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              CEAN Orchestrator Metrics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time task monitoring and analytics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              autoRefresh
                ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                : 'bg-gray-500/20 text-gray-700 dark:text-gray-300'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
          </button>

          <button
            onClick={fetchMetrics}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 transition disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last updated: {lastUpdate.toLocaleTimeString('hu-HU')}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Health Status Card */}
      {metrics && (
        <div
          className={`p-6 rounded-lg border ${getStatusColor(metrics.status)}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                {getStatusIcon(metrics.status)} Worker Status
              </h3>
              <p className="text-sm opacity-75">{metrics.worker}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold capitalize">
                {metrics.status}
              </div>
              <div className="text-xs opacity-75 mt-1">
                {new Date(metrics.timestamp).toLocaleTimeString('hu-HU')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Tasks
            </span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {totalTasks}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            All time
          </p>
        </div>

        {/* Running Tasks */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Running
            </span>
            <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {runningTasks}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            In progress
          </p>
        </div>

        {/* Success Rate */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Success Rate
            </span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {successRate}%
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {completedTasks} completed
          </p>
        </div>

        {/* Error Rate */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Error Rate
            </span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {errorRate}%
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {failedTasks} failed
          </p>
        </div>
      </div>

      {/* Agent Statistics Table */}
      {stats.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Agent Statistics
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Agent Type
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Failed
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Running
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Success %
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, idx) => {
                  const total = stat.total_tasks || 0;
                  const success = total > 0 
                    ? Math.round(((stat.completed_tasks || 0) / total) * 100)
                    : 0;

                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {stat.agent_type}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                        {total}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-green-600 dark:text-green-400 font-medium">
                        {stat.completed_tasks || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-red-600 dark:text-red-400 font-medium">
                        {stat.failed_tasks || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-amber-600 dark:text-amber-400 font-medium">
                        {stat.running_tasks || 0}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <span
                          className={
                            success >= 90
                              ? 'text-green-600 dark:text-green-400'
                              : success >= 70
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {success}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !metrics && (
        <div className="p-8 text-center">
          <div className="inline-block">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Metrics betöltésben...
          </p>
        </div>
      )}
    </div>
  );
};
