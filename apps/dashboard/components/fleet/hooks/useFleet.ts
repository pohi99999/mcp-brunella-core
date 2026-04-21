/**
 * Hook for fetching a single fleet
 * Path: src/dashboard/components/fleet/hooks/useFleet.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { Fleet } from '../types.js';
import { useCEANSocket } from '../../cean/hooks/useCEANSocket.js';

interface UseFleetResult {
  fleet: Fleet | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFleet(fleetId: string): UseFleetResult {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useCEANSocket();

  const fetchFleet = useCallback(async () => {
    if (!fleetId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/fleet/${fleetId}`);
      if (!response.ok) {
        throw new Error(`Fleet fetch failed: ${response.statusText}`);
      }
      const data = await response.json();
      setFleet(data.data || null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setFleet(null);
    } finally {
      setLoading(false);
    }
  }, [fleetId]);

  // Initial fetch
  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  // Listen for fleet updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleFleetUpdated = (data: any) => {
      if (data.fleet_id === fleetId) {
        setFleet(data);
      }
    };

    socket.on('fleet_updated', handleFleetUpdated);

    return () => {
      socket.off('fleet_updated', handleFleetUpdated);
    };
  }, [socket, fleetId]);

  return { fleet, loading, error, refetch: fetchFleet };
}
