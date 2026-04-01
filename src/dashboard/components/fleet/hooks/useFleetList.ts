/**
 * Hook for fetching all fleets with health status
 * Path: src/dashboard/components/fleet/hooks/useFleetList.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { Fleet, FleetHealth } from '../types.js';
import { useCEANSocket } from '../../cean/hooks/useCEANSocket.js';

interface UseFleetListResult {
  fleets: Fleet[];
  healthData: Record<string, FleetHealth>;
  totalWorkers: number;
  totalErrors: number;
  avgLatency: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFleetList(): UseFleetListResult {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [healthData, setHealthData] = useState<Record<string, FleetHealth>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useCEANSocket();

  const fetchFleets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch fleet list
      const fleetsResponse = await fetch('/api/fleet/list');
      if (!fleetsResponse.ok) {
        throw new Error(`Fleet list fetch failed: ${fleetsResponse.statusText}`);
      }
      const fleetsData = await fleetsResponse.json();
      const fleetsList = fleetsData.data || [];
      setFleets(fleetsList);

      // Fetch health summary for each fleet
      const healthMap: Record<string, FleetHealth> = {};

      for (const fleet of fleetsList) {
        try {
          const healthResponse = await fetch(`/api/metrics/fleet/${fleet.id}/summary`);
          if (healthResponse.ok) {
            const healthDataPayload = await healthResponse.json();
            healthMap[fleet.id] = healthDataPayload.data || {
              total_workers: 0,
              healthy_workers: 0,
              error_rate: 0,
              avg_latency: 0,
              p95_latency: 0,
              rps: 0,
            };
          }
        } catch (err) {
          console.warn(`Failed to fetch health for fleet ${fleet.id}:`, err);
          healthMap[fleet.id] = {
            total_workers: 0,
            healthy_workers: 0,
            error_rate: 0,
            avg_latency: 0,
            p95_latency: 0,
            rps: 0,
          };
        }
      }

      setHealthData(healthMap);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setFleets([]);
      setHealthData({});
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFleets();

    // Auto-refetch every 10 seconds
    const interval = setInterval(fetchFleets, 10000);

    return () => clearInterval(interval);
  }, [fetchFleets]);

  // Listen for fleet updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleFleetScaled = (data: any) => {
      setHealthData((prev) => ({
        ...prev,
        [data.fleet_id]: {
          ...prev[data.fleet_id],
          total_workers: data.new_worker_count,
        },
      }));
    };

    const handleMetricsUpdated = (data: any) => {
      if (!data?.fleet_id) return;
      setHealthData((prev) => ({
        ...prev,
        [data.fleet_id]: data,
      }));
    };

    socket.on('fleet_scaled', handleFleetScaled);
    socket.on('metrics_updated', handleMetricsUpdated);

    return () => {
      socket.off('fleet_scaled', handleFleetScaled);
      socket.off('metrics_updated', handleMetricsUpdated);
    };
  }, [socket]);

  // Calculate aggregates
  const totalWorkers = Object.values(healthData).reduce(
    (sum, h) => sum + (h.total_workers || 0),
    0
  );
  const totalErrors = Object.values(healthData).reduce(
    (sum, h) => sum + Math.round((h.error_rate || 0) * 100),
    0
  );
  const avgLatency =
    Object.values(healthData).length > 0
      ? Math.round(
          Object.values(healthData).reduce((sum, h) => sum + (h.avg_latency || 0), 0) /
            Object.values(healthData).length
        )
      : 0;

  return {
    fleets,
    healthData,
    totalWorkers,
    totalErrors,
    avgLatency,
    loading,
    error,
    refetch: fetchFleets,
  };
}
