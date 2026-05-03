import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@radix-ui/react-button';
import { AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';

interface LoadTestMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  throughput: number;
  errorRate: number;
  startTime: number;
  endTime: number;
  duration: number;
  costEstimate: number;
  memoryPeak: number;
  summary: string;
}

interface LoadTestConfig {
  pipelines: number;
  concurrency: number;
  minNodes: number;
  maxNodes: number;
  rampUp: boolean;
}

const LoadTestingDashboard: React.FC = () => {
  const [config, setConfig] = useState<LoadTestConfig>({
    pipelines: 100,
    concurrency: 10,
    minNodes: 3,
    maxNodes: 10,
    rampUp: false
  });

  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<LoadTestMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<LoadTestMetrics[]>([]);

  const handleConfigChange = (key: keyof LoadTestConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const runLoadTest = async () => {
    try {
      setIsRunning(true);
      setError(null);
      setProgress(0);
      setMetrics(null);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 30, 95));
      }, 1000);

      const queryParams = new URLSearchParams({
        pipelines: config.pipelines.toString(),
        concurrency: config.concurrency.toString(),
        minNodes: config.minNodes.toString(),
        maxNodes: config.maxNodes.toString(),
        rampUp: config.rampUp.toString()
      });

      const response = await fetch(
        `https://cean-orchestrator.your-domain.workers.dev/load-test/run?${queryParams}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`Load test failed: ${response.status}`);
      }

      const data = await response.json() as any;

      if (data.status === 'success') {
        setMetrics(data.metrics);
        setHistory(prev => [...prev, data.metrics]);
      } else {
        setError(data.error || 'Load test failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const resetMetrics = () => {
    setMetrics(null);
    setHistory([]);
    setProgress(0);
    setError(null);
  };

  // Prepare data for charts
  const latencyData = metrics ? [
    { name: 'Min', value: metrics.minLatency },
    { name: 'Avg', value: metrics.avgLatency },
    { name: 'P95', value: metrics.p95Latency },
    { name: 'P99', value: metrics.p99Latency },
    { name: 'Max', value: metrics.maxLatency }
  ] : [];

  const throughputData = history.map((m, idx) => ({
    run: idx + 1,
    throughput: m.throughput.toFixed(2),
    successRate: ((m.totalSucceeded / m.totalExecuted) * 100).toFixed(2)
  }));

  return (
    <div className="space-y-6 p-6 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">🧪 Load Testing Suite</h2>
        <p className="text-slate-400">Test CEAN orchestrator with multiple concurrent pipelines</p>
      </div>

      {/* Configuration Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Pipelines</label>
          <input
            type="number"
            value={config.pipelines}
            onChange={e => handleConfigChange('pipelines', parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Concurrency</label>
          <input
            type="number"
            value={config.concurrency}
            onChange={e => handleConfigChange('concurrency', parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Min Nodes</label>
          <input
            type="number"
            value={config.minNodes}
            onChange={e => handleConfigChange('minNodes', parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Max Nodes</label>
          <input
            type="number"
            value={config.maxNodes}
            onChange={e => handleConfigChange('maxNodes', parseInt(e.target.value))}
            disabled={isRunning}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 disabled:opacity-50"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.rampUp}
              onChange={e => handleConfigChange('rampUp', e.target.checked)}
              disabled={isRunning}
              className="w-4 h-4"
            />
            <span className="text-sm">Ramp Up</span>
          </label>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={runLoadTest}
          disabled={isRunning}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running...' : 'Start Load Test'}
        </Button>

        <Button
          onClick={resetMetrics}
          disabled={isRunning}
          className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-600 text-white px-4 py-2 rounded"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="space-y-2">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-slate-400 text-center">{progress.toFixed(0)}% Complete</p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 bg-red-900/30 border border-red-700 rounded p-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Error</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Results */}
      {metrics && (
        <div className="space-y-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-700 p-4 rounded">
              <p className="text-slate-400 text-sm">Total Executed</p>
              <p className="text-2xl font-bold text-green-400">{metrics.totalExecuted}</p>
            </div>
            <div className="bg-slate-700 p-4 rounded">
              <p className="text-slate-400 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-blue-400">
                {((metrics.totalSucceeded / metrics.totalExecuted) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-slate-700 p-4 rounded">
              <p className="text-slate-400 text-sm">Throughput</p>
              <p className="text-2xl font-bold text-amber-400">{metrics.throughput.toFixed(2)}/s</p>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Avg Latency</p>
              <p className="text-lg font-semibold text-white">{metrics.avgLatency.toFixed(0)}ms</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">P95 Latency</p>
              <p className="text-lg font-semibold text-white">{metrics.p95Latency.toFixed(0)}ms</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">P99 Latency</p>
              <p className="text-lg font-semibold text-white">{metrics.p99Latency.toFixed(0)}ms</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Error Rate</p>
              <p className="text-lg font-semibold text-red-400">{metrics.errorRate.toFixed(2)}%</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Duration</p>
              <p className="text-lg font-semibold text-white">{(metrics.duration / 1000).toFixed(1)}s</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Cost (Est.)</p>
              <p className="text-lg font-semibold text-green-400">${metrics.costEstimate.toFixed(4)}</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Memory (Peak)</p>
              <p className="text-lg font-semibold text-white">{metrics.memoryPeak}MB</p>
            </div>
            <div className="bg-slate-700 p-3 rounded">
              <p className="text-xs text-slate-400">Failed</p>
              <p className="text-lg font-semibold text-red-400">{metrics.totalFailed}</p>
            </div>
          </div>

          {/* Latency Distribution Chart */}
          {latencyData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Latency Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: any) => `${value.toFixed(0)}ms`}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Throughput Trend */}
          {throughputData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Throughput Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="run" stroke="#94a3b8" />
                  <YAxis yAxisId="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="throughput" stroke="#3b82f6" name="Throughput (pipelines/s)" />
                  <Line yAxisId="right" type="monotone" dataKey="successRate" stroke="#10b981" name="Success Rate (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Text */}
          <div className="bg-slate-700 p-4 rounded border-l-4 border-blue-500">
            <p className="text-slate-300">{metrics.summary}</p>
          </div>
        </div>
      )}

      {/* No Results Yet */}
      {!metrics && !isRunning && (
        <div className="text-center py-12 text-slate-400">
          <p>👈 Configure and run load test to see metrics</p>
        </div>
      )}
    </div>
  );
};

export default LoadTestingDashboard;
