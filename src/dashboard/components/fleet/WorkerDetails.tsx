/**
 * Worker Details Component
 * Path: src/dashboard/components/fleet/WorkerDetails.tsx
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Worker } from './types.js';

interface WorkerDetailsProps {
  workers: Worker[];
  onRemove?: (workerId: string) => void;
  onStatusChange?: (workerId: string, status: Worker['status']) => void;
  isLoading?: boolean;
}

export const WorkerDetails: React.FC<WorkerDetailsProps> = ({
  workers,
  onRemove,
  onStatusChange,
  isLoading
}) => {
  const getStatusColor = (status: Worker['status']) => {
    switch (status) {
      case 'active': return 'green';
      case 'paused': return 'yellow';
      case 'draining': return 'orange';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workers ({workers.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">Név</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">URL</th>
                <th className="text-center py-2">Errors</th>
                <th className="text-center py-2">Requests</th>
                <th className="text-left py-2">Last Heartbeat</th>
                <th className="text-center py-2">Akciók</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-b hover:bg-gray-50">
                  <td className="py-3">{w.name}</td>
                  <td className="py-3">
                    <Badge color={getStatusColor(w.status)}>{w.status}</Badge>
                  </td>
                  <td className="py-3 text-xs truncate max-w-xs">{w.url}</td>
                  <td className="text-center py-3 text-red-600">{w.error_count}</td>
                  <td className="text-center py-3">{w.requests_total}</td>
                  <td className="text-xs py-3">
                    {w.last_heartbeat ? new Date(w.last_heartbeat).toLocaleString('hu-HU') : '—'}
                  </td>
                  <td className="text-center py-3">
                    <select
                      value={w.status}
                      onChange={(e) => onStatusChange?.(w.id, e.target.value as Worker['status'])}
                      disabled={isLoading}
                      className="text-xs p-1 border rounded"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="draining">Draining</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
