import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { logInfo, logError } from '@/utils/logger';

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  tasksCompleted: number;
  tasksFailed: number;
  avgDuration: number;
  lastExecuted: string | null;
  uptime: number; // percentage
  memory: number; // percentage
  cpu: number; // percentage
}

/**
 * AgentStatusPanel Component
 * Displays individual agent health and performance metrics
 *
 * Features:
 * - Agent status indicator (active/idle/error)
 * - Task completion statistics
 * - Performance metrics (CPU, Memory, Uptime)
 * - Last execution timestamp
 */
export const AgentStatusPanel = () => {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const fetchAgentStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        'https://cean-orchestrator.iam-dd1.workers.dev/agents'
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch agent status: ${response.statusText}`);
      }

      const data = (await response.json()) as AgentStatus[];
      setAgents(data);
      logInfo('AgentStatusPanel', `Loaded status for ${data.length} agents`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      logError('AgentStatusPanel', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentStatus();

    const interval = setInterval(() => {
      fetchAgentStatus();
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Aktív
          </div>
        );
      case 'idle':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-700 dark:text-gray-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            Tétlen
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Hiba
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <CheckCircle2 className="w-5 h-5 text-green-500 animate-pulse" />
        );
      case 'idle':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />;
      default:
        return null;
    }
  };

  if (isLoading && agents.length === 0) {
    return (
      <div className="w-full p-8 text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Ügynök státusz betöltésben...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-500" />
          Ügynök Státusz
        </h2>
        <button
          onClick={fetchAgentStatus}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 transition text-xs font-medium disabled:opacity-50"
        >
          🔄 Frissítés
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-lg transition cursor-pointer"
            onClick={() =>
              setExpandedAgent(
                expandedAgent === agent.id ? null : agent.id
              )
            }
          >
            {/* Card Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    ID: {agent.id.slice(0, 8)}...
                  </p>
                </div>
                {getStatusIcon(agent.status)}
              </div>
              {getStatusBadge(agent.status)}
            </div>

            {/* Quick Stats */}
            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sikeresen befejezett
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {agent.tasksCompleted}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sikertelen
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {agent.tasksFailed}
                </p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="px-4 space-y-2">
              {/* Uptime */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Üzemidő
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {agent.uptime}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${agent.uptime}%` }}
                  ></div>
                </div>
              </div>

              {/* CPU */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    CPU
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {agent.cpu}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      agent.cpu > 80
                        ? 'bg-red-500'
                        : agent.cpu > 50
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${agent.cpu}%` }}
                  ></div>
                </div>
              </div>

              {/* Memory */}
              <div className="pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Memória
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {agent.memory}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      agent.memory > 80
                        ? 'bg-red-500'
                        : agent.memory > 50
                          ? 'bg-amber-500'
                          : 'bg-purple-500'
                    }`}
                    style={{ width: `${agent.memory}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedAgent === agent.id && (
              <div className="px-4 py-4 space-y-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Átl. végrehajtási idő
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {agent.avgDuration}ms
                    </p>
                  </div>
                </div>

                {agent.lastExecuted && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Utolsó végrehajtás
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {new Date(
                          agent.lastExecuted
                        ).toLocaleString('hu-HU')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Siker ráta
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {agent.tasksCompleted +
                        agent.tasksFailed >
                      0
                        ? Math.round(
                            ((agent.tasksCompleted /
                              (agent.tasksCompleted +
                                agent.tasksFailed)) *
                              100)
                          )
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {agents.length === 0 && !isLoading && (
        <div className="p-8 text-center rounded-lg bg-gray-50 dark:bg-gray-800">
          <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Nincsenek elérhető ügynökök
          </p>
        </div>
      )}
    </div>
  );
};
