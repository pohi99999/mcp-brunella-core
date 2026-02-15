/**
 * Fleet Overview Component
 * Path: src/dashboard/components/fleet/FleetOverview.tsx
 * 
 * Displays list of fleets with health status and quick actions
 * Integrated with useFleetList() and useScaling() hooks
 */

import React, { useState } from 'react';
import { useFleetList } from './hooks/useFleetList.js';
import { useScaling } from './hooks/useScaling.js';

interface FleetOverviewProps {
  fleetId?: string;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({ fleetId }) => {
  const { fleets, healthData, loading, error } = useFleetList();
  const { executeScale } = useScaling(fleetId);
  const [selectedFleet, setSelectedFleet] = useState<string | null>(null);

  const getHealthColor = (errorRate: number) => {
    if (errorRate < 1) return 'bg-green-600';
    if (errorRate < 5) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getHealthTextColor = (errorRate: number) => {
    if (errorRate < 1) return 'text-green-600';
    if (errorRate < 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
        <p>❌ Hiba: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fleets.map((fleet) => {
          const health = healthData[fleet.id];
          const isSelected = selectedFleet === fleet.id;

          return (
            <div
              key={fleet.id}
              className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
              }`}
              onClick={() => setSelectedFleet(fleet.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{fleet.name}</h3>
                  <p className="text-sm text-gray-500">{fleet.region}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    fleet.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {fleet.enabled ? 'Aktív' : 'Inaktív'}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-gray-500">Workers</p>
                  <p className="text-xl font-bold">{health?.worker_count || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Aktív</p>
                  <p className="text-xl font-bold text-green-600">
                    {health?.active_workers || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Error Rate</p>
                  <p className={`text-xl font-bold ${getHealthTextColor(health?.avg_error_rate || 0)}`}>
                    {(health?.avg_error_rate || 0).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Latency (p95)</p>
                  <p className="text-xl font-bold">
                    {health?.avg_latency_p95?.toFixed(0) || 0}ms
                  </p>
                </div>
              </div>

              {/* Health Bar */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Health Status</p>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${getHealthColor(
                      health?.avg_error_rate || 0
                    )}`}
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mb-4">
                <button
                  className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    void executeScale(fleet.id, 'up');
                  }}
                  disabled={loading || !fleet.enabled}
                >
                  ↑ Scale Up
                </button>
                <button
                  className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    void executeScale(fleet.id, 'down');
                  }}
                  disabled={loading || !fleet.enabled}
                >
                  ↓ Scale Down
                </button>
              </div>

              {/* Stats Footer */}
              <div className="text-xs text-gray-500 border-t pt-2">
                <p>{health?.total_requests || 0} requests • {health?.total_errors || 0} errors</p>
              </div>
            </div>
          );
        })}
      </div>

      {fleets.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p>Nincsenek flotta-k. Kezdj az első fleet létrehozásával!</p>
        </div>
      )}

      {loading && fleets.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
          <p>⏳ Flotta-k betöltése...</p>
        </div>
      )}
    </div>
  );
};
