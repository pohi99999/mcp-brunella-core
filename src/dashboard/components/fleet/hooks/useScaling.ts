/**
 * Hook for fetching and managing scaling policies
 * Path: src/dashboard/components/fleet/hooks/useScaling.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { ScalingPolicy } from '../types.js';
import { useCEANSocket } from '../../../cean/hooks/useCEANSocket.js';

interface UseScalingResult {
  policy: ScalingPolicy | null;
  policies: ScalingPolicy[];
  loading: boolean;
  error: string | null;
  executeScale: (fleetId: string, direction: 'up' | 'down') => Promise<void>;
  savePolicy: (policy: ScalingPolicy) => Promise<void>;
  fetchPolicy: () => Promise<void>;
}

export function useScaling(fleetId?: string): UseScalingResult {
  const [policy, setPolicy] = useState<ScalingPolicy | null>(null);
  const [policies, setPolicies] = useState<ScalingPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useCEANSocket();

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scaling/policies');
      if (!response.ok) {
        throw new Error(`Policies fetch failed: ${response.statusText}`);
      }
      const data = await response.json();
      const policiesList = data.data || [];
      setPolicies(policiesList);

      // If fleetId is provided, find its policy
      if (fleetId) {
        const fleetPolicy = policiesList.find((p: ScalingPolicy) => p.fleet_id === fleetId);
        setPolicy(fleetPolicy || null);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [fleetId]);

  // Initial fetch
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const executeScale = useCallback(
    async (targetFleetId: string, direction: 'up' | 'down') => {
      setError(null);

      try {
        const response = await fetch('/api/scaling/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fleet_id: targetFleetId,
            direction,
          }),
        });

        if (!response.ok) {
          throw new Error(`Scale trigger failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
          // Refetch policies to get updated worker counts
          await fetchPolicies();
        } else {
          throw new Error(data.error || 'Scaling failed');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [fetchPolicies]
  );

  const savePolicy = useCallback(async (newPolicy: ScalingPolicy) => {
    setError(null);

    try {
      const response = await fetch(`/api/scaling/policies/${newPolicy.fleet_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });

      if (!response.ok) {
        throw new Error(`Policy save failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPolicy(data.data || null);
        // Update policies list
        setPolicies((prev) =>
          prev.map((p) => (p.fleet_id === newPolicy.fleet_id ? data.data : p))
        );
      } else {
        throw new Error(data.error || 'Policy save failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Listen for scaling events
  useEffect(() => {
    if (!socket) return;

    const handleFleetScaled = (data: any) => {
      if (!fleetId || data.fleet_id === fleetId) {
        // Refetch on any scaling event
        fetchPolicies();
      }
    };

    socket.on('fleet_scaled', handleFleetScaled);

    return () => {
      socket.off('fleet_scaled', handleFleetScaled);
    };
  }, [socket, fleetId, fetchPolicies]);

  return {
    policy,
    policies,
    loading,
    error,
    executeScale,
    savePolicy,
    fetchPolicy: fetchPolicies,
  };
}
