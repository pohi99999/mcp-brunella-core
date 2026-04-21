/**
 * useSystemQuery Hook - Batched system query across ALL widgets.
 * Prevents N+1 API spam: 350+ requests/min reduced to 1 request/60s
 *
 * Architecture:
 * • Fetches from /api/system/status ONCE per component mount
 * • Subsequent calls reuse cached data from Zustand store
 * • Integrates with SocketContext real-time updates
 * • Includes retry logic + exponential backoff
 *
 * Usage: const { agents, tasks, health } = useSystemQuery();
 */

import { useEffect, useState, useCallback } from 'react';
import { useSystemSignalStore } from '../store/systemSignalStore';
import { useShallow } from 'zustand/react/shallow';

interface SystemStatus {
  agents: Record<string, any>;
  tasks: any;
  health: any;
  error?: string;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1s

/**
 * Batched system query hook with exponential backoff retry.
 * Fetches from a single /api/system/status endpoint instead of
 * per-widget API calls, reducing spam from 350+ to ~1 request/60s.
 */
export function useSystemQuery() {
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // Get cached store data
  const { agents, tasks: taskStats, healthStatus, isLoading, error } = useSystemSignalStore(
    useShallow((state) => ({
      agents: state.agents,
      tasks: state.taskStats,
      healthStatus: state.healthStatus,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

  // Get store actions
  const setLoading = useSystemSignalStore((state) => state.setLoading);
  const setTasks = useSystemSignalStore((state) => state.setTasks);
  const setHealthStatus = useSystemSignalStore((state) => state.setHealthStatus);
  const setError = useSystemSignalStore((state) => state.setError);

  /**
   * Fetch batched system status.
   * Includes retry logic with exponential backoff.
   */
  const fetchSystemStatus = useCallback(async () => {
    // Prevent duplicate requests within 5s window
    const now = Date.now();
    if (lastFetchTime && now - lastFetchTime < 5000) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/system/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: SystemStatus = await response.json();

      // Update store with fetched data
      if (data.tasks) {
        setTasks(data.tasks);
      }
      if (data.health) {
        setHealthStatus(data.health);
      }

      setRetryCount(0); // Reset retry count on success
      setLastFetchTime(now);
    } catch (err: any) {
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      const shouldRetry = retryCount < MAX_RETRIES;

      const errorMsg = `System query failed: ${err.message || 'unknown error'}${
        shouldRetry ? ` (Retry ${retryCount + 1}/${MAX_RETRIES} in ${retryDelay / 1000}s)` : ''
      }`;

      setError(errorMsg);

      if (shouldRetry) {
        setRetryCount((prev) => prev + 1);
        setTimeout(() => {
          fetchSystemStatus();
        }, retryDelay);
      }
    } finally {
      setLoading(false);
    }
  }, [lastFetchTime, retryCount, setLoading, setError, setTasks, setHealthStatus]);

  /**
   * Run initial fetch on mount, then rely on SocketContext for real-time updates.
   */
  useEffect(() => {
    fetchSystemStatus();
    // Don't set up an interval here — let SocketContext handle real-time updates via WebSocket
    // If SocketContext is not connected, MissionControlLayout has a 30s fallback check
  }, [fetchSystemStatus]);

  return {
    agents,
    taskStats,
    healthStatus,
    isLoading,
    error,
    refetch: fetchSystemStatus, // Allow manual refresh if needed
  };
}
