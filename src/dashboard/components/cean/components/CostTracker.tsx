import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Calendar,
  AlertCircle,
  PieChart,
} from 'lucide-react';
import { logInfo, logError } from '@/utils/logger';

interface CostBreakdown {
  agentType: string;
  tasks: number;
  costUSD: number;
  costPerTask: number;
}

interface CostData {
  lastUpdated: string;
  period: 'hour' | 'day' | 'month';
  totalCost: number;
  averageCostPerTask: number;
  tasksExecuted: number;
  breakdown: CostBreakdown[];
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

/**
 * CostTracker Component
 * Displays cost metrics and breakdown by agent type
 *
 * Features:
 * - Total cost display
 * - Cost per task
 * - Cost breakdown by agent
 * - Trend analysis (up/down/stable)
 * - Time period selector (hour/day/month)
 */
export const CostTracker = () => {
  const [costs, setCosts] = useState<CostData | null>(null);
  const [period, setPeriod] = useState<'hour' | 'day' | 'month'>('day');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostData = async (selectedPeriod: 'hour' | 'day' | 'month') => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `https://cean-orchestrator.iam-dd1.workers.dev/costs?period=${selectedPeriod}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch cost data: ${response.statusText}`);
      }

      const data = (await response.json()) as CostData;
      setCosts(data);
      logInfo('CostTracker', `Loaded cost data for period: ${selectedPeriod}`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      logError('CostTracker', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData(period);
  }, [period]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return (
          <TrendingUp className="w-4 h-4 text-red-500 animate-bounce" />
        );
      case 'down':
        return (
          <TrendingDown className="w-4 h-4 text-green-500 animate-bounce" />
        );
      case 'stable':
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-red-600 dark:text-red-400';
      case 'down':
        return 'text-green-600 dark:text-green-400';
      case 'stable':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (isLoading && !costs) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Költség adatok betöltésben...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-500" />
          Költség Nyomonkövetés
        </h2>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {['hour', 'day', 'month'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as 'hour' | 'day' | 'month')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                period === p
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {p === 'hour'
                ? '1h'
                : p === 'day'
                  ? '24h'
                  : 'Hó'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {costs && (
        <>
          {/* Main Cost Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Cost */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Összes Költség
                </span>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                ${costs.totalCost.toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                {getTrendIcon(costs.trend)}
                <span
                  className={`text-sm font-medium ${getTrendColor(
                    costs.trend
                  )}`}
                >
                  {costs.percentChange > 0 ? '+' : ''}
                  {costs.percentChange}% compared to previous period
                </span>
              </div>
            </div>

            {/* Cost Per Task */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Költség/Feladat
                </span>
                <TrendingDown className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                ${costs.averageCostPerTask.toFixed(4)}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {costs.tasksExecuted} task(s) executed
              </p>
            </div>

            {/* Tasks Executed */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Végrehajtott Feladatok
                </span>
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {costs.tasksExecuted}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                in {period === 'hour' ? 'last hour' : period === 'day' ? 'last 24h' : 'this month'}
              </p>
            </div>
          </div>

          {/* Cost Breakdown Table */}
          {costs.breakdown.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Költség Bontás Ügynök Típus Szerint
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Ügynök Típus
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Feladatok
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Összes Költség
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Egy Feladat Költsége
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                        % Arány
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.breakdown.map((item, idx) => {
                      const percentage = costs.totalCost > 0 
                        ? ((item.costUSD / costs.totalCost) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {item.agentType}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                            {item.tasks}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                            ${item.costUSD.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">
                            ${item.costPerTask.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden max-w-xs">
                                <div
                                  className="h-full bg-blue-500 transition-all"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-12 text-right">
                                {percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
            Last updated:{' '}
            {new Date(costs.lastUpdated).toLocaleString('hu-HU')}
          </div>
        </>
      )}
    </div>
  );
};
