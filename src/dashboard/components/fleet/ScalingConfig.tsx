/**
 * Scaling Config Component
 * Path: src/dashboard/components/fleet/ScalingConfig.tsx
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@radix-ui/themes';
import { Button } from '@radix-ui/themes';
import { ScalingPolicy } from './types.js';

interface ScalingConfigProps {
  policy: ScalingPolicy | null;
  onSave?: (policy: ScalingPolicy) => void;
  isLoading?: boolean;
}

export const ScalingConfig: React.FC<ScalingConfigProps> = ({ policy, onSave, isLoading }) => {
  const [formData, setFormData] = useState<ScalingPolicy>(
    policy || {
      fleet_id: '',
      scale_up_threshold_latency_ms: 500,
      scale_up_threshold_error_rate: 5,
      scale_down_threshold_latency_ms: 100,
      scale_down_threshold_error_rate: 1,
      scale_down_duration_minutes: 5,
      cooldown_minutes: 5,
      min_workers: 2,
      max_workers: 10
    }
  );

  const handleChange = (key: keyof ScalingPolicy, value: any) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSave = () => {
    onSave?.(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto-Scaling Policy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Scale Up */}
          <div className="border-l-4 border-red-500 pl-4">
            <h3 className="font-bold mb-3">📈 Scale Up Thresholds</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Latency P95 (ms)</label>
                <input
                  type="number"
                  value={formData.scale_up_threshold_latency_ms}
                  onChange={(e) =>
                    handleChange('scale_up_threshold_latency_ms', parseInt(e.target.value))
                  }
                  className="w-full border rounded px-2 py-1"
                />
                <p className="text-xs text-gray-500">
                  Scale up when latency exceeds {formData.scale_up_threshold_latency_ms}ms
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Error Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.scale_up_threshold_error_rate}
                  onChange={(e) =>
                    handleChange('scale_up_threshold_error_rate', parseFloat(e.target.value))
                  }
                  className="w-full border rounded px-2 py-1"
                />
                <p className="text-xs text-gray-500">
                  Or when error rate exceeds {formData.scale_up_threshold_error_rate}%
                </p>
              </div>
            </div>
          </div>

          {/* Scale Down */}
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-bold mb-3">📉 Scale Down Thresholds</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Latency P95 (ms)</label>
                <input
                  type="number"
                  value={formData.scale_down_threshold_latency_ms}
                  onChange={(e) =>
                    handleChange('scale_down_threshold_latency_ms', parseInt(e.target.value))
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Error Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.scale_down_threshold_error_rate}
                  onChange={(e) =>
                    handleChange('scale_down_threshold_error_rate', parseFloat(e.target.value))
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.scale_down_duration_minutes}
                  onChange={(e) =>
                    handleChange('scale_down_duration_minutes', parseInt(e.target.value))
                  }
                  className="w-full border rounded px-2 py-1"
                />
                <p className="text-xs text-gray-500">
                  Scale down only if metrics stay low for {formData.scale_down_duration_minutes}m
                </p>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-bold mb-3">⚙️ Worker Limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Min Workers</label>
                <input
                  type="number"
                  value={formData.min_workers}
                  onChange={(e) => handleChange('min_workers', parseInt(e.target.value))}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Workers</label>
                <input
                  type="number"
                  value={formData.max_workers}
                  onChange={(e) => handleChange('max_workers', parseInt(e.target.value))}
                  className="w-full border rounded px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* Cooldown */}
          <div className="bg-gray-100 p-3 rounded">
            <label className="text-sm font-medium">Cooldown Between Scalings (min)</label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range"
                min="1"
                max="30"
                value={formData.cooldown_minutes}
                onChange={(e) => handleChange('cooldown_minutes', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-lg font-bold">{formData.cooldown_minutes} min</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Prevent rapid scaling by enforcing cooldown between events
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={isLoading}>
              💾 Save Policy
            </Button>
            <Button variant="outline" onClick={() => setFormData(policy || {})}>
              ↺ Reset
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
