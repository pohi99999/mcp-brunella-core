/**
 * Hook for fetching worker metrics with live updates
 * Path: src/dashboard/components/fleet/hooks/useWorkerMetrics.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { WorkerMetrics } from '../types.js';
import { useCEANSocket } from '../../cean/hooks/useCEANSocket.js';

interface UseWorkerMetricsResult {
  metrics: WorkerMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkerMetrics(workerId: string): UseWorkerMetricsResult {
  const [metrics, setMetrics] = useState<WorkerMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useCEANSocket();

  const fetchMetrics = useCallback(async () => {
    if (!workerId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/metrics/${workerId}/latest`);
      if (!response.ok) {
        throw new Error(`Metrics fetch failed: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data.data || null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();

    // Auto-refetch every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Listen for real-time metrics updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMetricsUpdated = (data: any) => {
      if (data.worker_id === workerId) {
        setMetrics(data);
      }
    };

    const handleWorkerStatusChanged = (data: any) => {
      if (data.worker_id === workerId) {
        setMetrics((prev) => ({
          ...prev,
          status: data.status,
          last_updated: new Date().toISOString(),
        } as WorkerMetrics));
      }
    };

    socket.on('metrics_updated', handleMetricsUpdated);
    socket.on('worker_status_changed', handleWorkerStatusChanged);

    return () => {
      socket.off('metrics_updated', handleMetricsUpdated);
      socket.off('worker_status_changed', handleWorkerStatusChanged);
    };
  }, [socket, workerId]);

  return { metrics, loading, error, refetch: fetchMetrics };
}
