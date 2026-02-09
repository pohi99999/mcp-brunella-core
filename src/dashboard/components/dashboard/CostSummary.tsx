/**
 * Gold Protocol G7.5: Cost Summary Component
 *
 * Összesző dashboard az LLM költségekről
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CurrencyDollar, TrendUp, TrendDown } from '@phosphor-icons/react';

interface CostData {
  today: { cost: number; tokens: number };
  week: { cost: number; tokens: number };
  month: { cost: number; tokens: number };
  byModel: Record<string, { cost: number; tokens: number }>;
}

export function CostSummary() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCost();
    const interval = setInterval(fetchCost, 15000); // Auto-refresh 15s
    return () => clearInterval(interval);
  }, []);

  const fetchCost = async () => {
    try {
      const res = await fetch('/api/telemetry/cost');
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch cost:', e);
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CurrencyDollar className="w-5 h-5" />
          LLM Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Today */}
          <div className="p-3 border rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Today</div>
            <div className="text-2xl font-bold">${data.today.cost.toFixed(4)}</div>
            <div className="text-xs text-gray-600">{data.today.tokens.toLocaleString()} tokens</div>
          </div>

          {/* Week */}
          <div className="p-3 border rounded-lg">
            <div className="text-xs text-gray-500 mb-1">This Week</div>
            <div className="text-2xl font-bold">${data.week.cost.toFixed(4)}</div>
            <div className="text-xs text-gray-600">{data.week.tokens.toLocaleString()} tokens</div>
          </div>

          {/* Month */}
          <div className="p-3 border rounded-lg">
            <div className="text-xs text-gray-500 mb-1">This Month</div>
            <div className="text-2xl font-bold">${data.month.cost.toFixed(4)}</div>
            <div className="text-xs text-gray-600">{data.month.tokens.toLocaleString()} tokens</div>
          </div>
        </div>

        {/* By Model Breakdown */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Cost by Model</h4>
          <div className="space-y-2">
            {Object.entries(data.byModel).map(([model, stats]) => (
              <div key={model} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500 text-white">{model}</Badge>
                  <span className="text-xs text-gray-600">{stats.tokens.toLocaleString()} tokens</span>
                </div>
                <div className="font-semibold text-sm">${stats.cost.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
