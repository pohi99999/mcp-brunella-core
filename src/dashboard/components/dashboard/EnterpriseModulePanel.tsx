import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@radix-ui/themes';

/**
 * EnterpriseModulePanel
 * Dashboard component for managing and monitoring all 14 enterprise modules
 * 
 * Features:
 * - List all modules by category
 * - Execute tasks via the orchestrator
 * - Monitor module health
 * - View execution history
 */

interface Module {
  name: string;
  category: string;
  keywords: string[];
  priority: number;
}

interface ExecutionResult {
  taskId: string;
  targetModules: string[];
  status: string;
  executedAt: string;
  totalExecutionTime: number;
}

export const EnterpriseModulePanel: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [stats, setStats] = useState({ totalModules: 0, byCategory: {} });

  // Load modules on mount
  useEffect(() => {
    loadModules();
    loadStats();
  }, []);

  /**
   * Load all enterprise modules
   */
  const loadModules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/enterprise/modules');
      const data = await response.json();
      
      if (data.status === 'success') {
        setModules(data.modules);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load module statistics
   */
  const loadStats = async () => {
    try {
      const response = await fetch('/api/enterprise/stats');
      const data = await response.json();
      
      if (data.status === 'success') {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  /**
   * Get modules filtered by category
   */
  const getFilteredModules = () => {
    if (selectedCategory === 'all') {
      return modules;
    }
    return modules.filter((m) => m.category === selectedCategory);
  };

  /**
   * Execute a task against the enterprise suite
   */
  const executeTask = async () => {
    if (!taskInput.trim()) {
      alert('Please enter a task description');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/enterprise/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskInput,
          priority: 'medium'
        })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setExecutionHistory([data.result, ...executionHistory]);
        setTaskInput('');
        alert('Task executed successfully!');
      } else {
        alert('Task execution failed: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to execute task:', error);
      alert('Failed to execute task');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'sales', 'finance', 'hr', 'logistics'];
  const filteredModules = getFilteredModules();

  return (
    <div className="w-full space-y-6 p-4">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Enterprise Suite Master</h1>
        <p className="text-gray-600">
          Manage and monitor all {stats.totalModules} enterprise modules
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalModules}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.byCategory?.sales || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.byCategory?.finance || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>HR & Logistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {(stats.byCategory?.hr || 0) + (stats.byCategory?.logistics || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Executor */}
      <Card>
        <CardHeader>
          <CardTitle>Execute Enterprise Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe your task (e.g., 'Generate sales leads in tech industry')"
            className="w-full p-3 border border-gray-300 rounded text-sm"
            rows={4}
          />
          <button
            onClick={executeTask}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Execute'}
          </button>
        </CardContent>
      </Card>

      {/* Module Browser */}
      <Card>
        <CardHeader>
          <CardTitle>Module Browser</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-sm ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Modules List */}
          {loading ? (
            <div className="text-center py-8">Loading modules...</div>
          ) : filteredModules.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No modules found in this category
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModules.map((module) => (
                <div
                  key={module.name}
                  className="p-4 border border-gray-200 rounded bg-gray-50"
                >
                  <h3 className="font-bold text-sm">{module.name}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Category: <span className="font-mono">{module.category}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Priority: <span className="font-bold">{module.priority}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {module.keywords.slice(0, 3).map((kw) => (
                      <span key={kw} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {kw}
                      </span>
                    ))}
                    {module.keywords.length > 3 && (
                      <span className="text-xs text-gray-500">+{module.keywords.length - 3}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {executionHistory.slice(0, 5).map((exec) => (
                <div key={exec.taskId} className="p-3 border-l-4 border-green-500 bg-green-50">
                  <p className="text-sm font-mono">{exec.taskId}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Modules: {exec.targetModules.join(', ')}
                  </p>
                  <p className="text-xs text-gray-600">
                    Time: {exec.totalExecutionTime}ms | {exec.executedAt}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnterpriseModulePanel;
