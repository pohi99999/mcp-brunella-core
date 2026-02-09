/**
 * Gold Protocol G7.3 UI: Model Router Panel
 *
 * Model routing decisions és profile viewer
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Broadcast, ChartBar } from '@phosphor-icons/react';

interface ModelProfile {
  model: string;
  specialties: string[];
  costPerToken: number;
  fallback?: string;
}

interface RoutingDecision {
  timestamp: string;
  task: string;
  category: string;
  selectedModel: string;
  reason: string;
}

interface RouterStats {
  byModel: Record<string, number>;
  byCategory: Record<string, Record<string, number>>;
}

export function ModelRouterPanel() {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000); // Auto-refresh 8s
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [modelsRes, decisionsRes, statsRes] = await Promise.all([
        fetch('/api/router/models'),
        fetch('/api/router/decisions'),
        fetch('/api/router/stats'),
      ]);
      const modelsData = await modelsRes.json();
      const decisionsData = await decisionsRes.json();
      const statsData = await statsRes.json();
      setModels(modelsData.models || []);
      setDecisions(decisionsData.decisions || []);
      setStats(statsData);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch router data:', e);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Router</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Model Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Broadcast className="w-5 h-5" />
            Model Profiles ({models.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <div key={model.model} className="p-4 border rounded-lg">
                <div className="font-semibold text-lg mb-2">{model.model}</div>
                <div className="text-xs text-gray-600 mb-2">
                  Cost: <span className="font-mono">${model.costPerToken}</span>/token
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {model.specialties.map((spec) => (
                    <Badge key={spec} className="bg-blue-500 text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
                {model.fallback && (
                  <div className="text-xs text-gray-500">Fallback: {model.fallback}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Decisions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBar className="w-5 h-5" />
            Recent Routing Decisions ({decisions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {decisions.map((dec, idx) => (
              <div key={idx} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">{dec.selectedModel}</Badge>
                    <Badge variant="outline">{dec.category}</Badge>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(dec.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-600 font-mono mb-1">{dec.task.slice(0, 100)}...</div>
                <div className="text-xs text-blue-600">{dec.reason}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Router Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By Model */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Usage by Model</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byModel).map(([model, count]) => (
                    <div key={model} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{model}</span>
                      <Badge>{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Category */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Usage by Category</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byCategory).map(([category, modelCounts]) => (
                    <div key={category} className="p-2 border rounded">
                      <div className="text-sm font-semibold mb-1">{category}</div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(modelCounts).map(([model, count]) => (
                          <Badge key={model} variant="outline" className="text-xs">
                            {model}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
