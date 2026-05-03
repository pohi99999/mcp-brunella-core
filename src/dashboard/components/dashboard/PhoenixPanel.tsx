/**
 * Gold Protocol G7.2 UI: Phoenix Panel
 *
 * Checkpoint + recovery log viewer
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle, ArrowClockwise, Cpu, HardDrive } from '@phosphor-icons/react';

interface Checkpoint {
  id?: number;
  taskId: string;
  step: string;
  timestamp: string;
  state: any;
}

interface RecoveryEvent {
  timestamp: string;
  taskId: string;
  step: string;
  reason: string;
}

interface SystemHealth {
  cpu: { usage: number };
  memory: { used: number; total: number };
  uptime: number;
}

export function PhoenixPanel() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [recoveryLog, setRecoveryLog] = useState<RecoveryEvent[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000); // Auto-refresh 5s
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [cpRes, logRes, healthRes] = await Promise.all([
        fetch('/api/phoenix/checkpoints'),
        fetch('/api/phoenix/recovery-log'),
        fetch('/api/phoenix/health'),
      ]);
      const cpData = await cpRes.json();
      const logData = await logRes.json();
      const healthData = await healthRes.json();
      setCheckpoints(cpData.checkpoints || []);
      setRecoveryLog(logData.events || []);
      setHealth(healthData);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch Phoenix data:', e);
      setLoading(false);
    }
  };

  const clearCheckpointsForTask = async (taskId: string) => {
    try {
      await fetch(`/api/phoenix/checkpoints/${taskId}`, { method: 'DELETE' });
      fetchAll();
    } catch (e) {
      console.error('Failed to clear checkpoints:', e);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phoenix Protocol</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Active Checkpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Active Checkpoints ({checkpoints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {checkpoints.map((cp, idx) => (
              <div key={idx} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <Badge className="bg-blue-500">{cp.taskId}</Badge>
                  <Button size="sm" variant="outline" onClick={() => clearCheckpointsForTask(cp.taskId)}>
                    Clear
                  </Button>
                </div>
                <div className="text-xs text-gray-600">
                  Step: <span className="font-mono">{cp.step}</span>
                </div>
                <div className="text-xs text-gray-500">{new Date(cp.timestamp).toLocaleString()}</div>
              </div>
            ))}
            {checkpoints.length === 0 && (
              <div className="text-gray-500 text-sm">No active checkpoints</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Log + Health */}
      <div className="space-y-4">
        {/* System Health */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">CPU Usage</div>
                  <div className="text-2xl font-bold">{health.cpu.usage.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Memory</div>
                  <div className="text-2xl font-bold">
                    {((health.memory.used / health.memory.total) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">
                    {(health.memory.used / 1024 / 1024).toFixed(0)} MB / {(health.memory.total / 1024 / 1024).toFixed(0)} MB
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Uptime: {(health.uptime / 3600).toFixed(1)} hours
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recovery Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowClockwise className="w-5 h-5" />
              Recovery Log ({recoveryLog.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recoveryLog.map((event, idx) => (
                <div key={idx} className="p-3 border rounded-lg border-orange-300 bg-orange-50 dark:bg-orange-900/10">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className="bg-orange-500">{event.taskId}</Badge>
                    <span className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Step: <span className="font-mono">{event.step}</span>
                  </div>
                  <div className="text-xs text-red-600 mt-1">Reason: {event.reason}</div>
                </div>
              ))}
              {recoveryLog.length === 0 && (
                <div className="text-gray-500 text-sm">No recovery events</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
