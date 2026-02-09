/**
 * Gold Protocol G7.10: Gold Status Widget
 *
 * Main dashboard összefoglaló widget — 6 pillér státusza
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  FileText,
  ArrowClockwise,
  Broadcast,
  Database,
  ChartLine,
  ShieldCheck,
} from '@phosphor-icons/react';

interface PillarStatus {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'active' | 'idle' | 'warning';
  metric: string;
  link: string;
}

export function GoldStatusWidget() {
  const [pillars, setPillars] = useState<PillarStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 20000); // Auto-refresh 20s
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      // Párhuzamosan fetch minden pillar adatot
      const [specs, checkpoints, models, memory, telemetry, audit] = await Promise.all([
        fetch('/api/specs').then((r) => r.json()),
        fetch('/api/phoenix/checkpoints').then((r) => r.json()),
        fetch('/api/router/decisions').then((r) => r.json()),
        fetch('/api/memory/stats').then((r) => r.json()),
        fetch('/api/telemetry/usage-summary').then((r) => r.json()),
        fetch('/api/audit/stats').then((r) => r.json()),
      ]);

      setPillars([
        {
          id: 'spec',
          name: 'Spec Management',
          icon: <FileText className="w-6 h-6" />,
          status: specs.tracks?.some((t: any) => t.spec_status === 'pending_approval') ? 'warning' : 'active',
          metric: `${specs.tracks?.filter((t: any) => t.spec_status === 'approved').length || 0} approved`,
          link: '/gold/specs',
        },
        {
          id: 'phoenix',
          name: 'Phoenix Protocol',
          icon: <ArrowClockwise className="w-6 h-6" />,
          status: checkpoints.checkpoints?.length > 0 ? 'active' : 'idle',
          metric: `${checkpoints.checkpoints?.length || 0} checkpoints`,
          link: '/gold/phoenix',
        },
        {
          id: 'router',
          name: 'Model Router',
          icon: <Broadcast className="w-6 h-6" />,
          status: 'active',
          metric: `${models.decisions?.length || 0} recent`,
          link: '/gold/router',
        },
        {
          id: 'memory',
          name: 'Cognitive Memory',
          icon: <Database className="w-6 h-6" />,
          status: 'active',
          metric: `${memory.golden?.count || 0} samples`,
          link: '/gold/memory',
        },
        {
          id: 'observability',
          name: 'Observability',
          icon: <ChartLine className="w-6 h-6" />,
          status: telemetry.totalSpans > 0 ? 'active' : 'idle',
          metric: `${telemetry.totalSpans || 0} traces`,
          link: '/gold/observability',
        },
        {
          id: 'audit',
          name: 'Audit',
          icon: <ShieldCheck className="w-6 h-6" />,
          status: audit.deniedCount > 0 ? 'warning' : 'active',
          metric: `${audit.deniedCount || 0} denied`,
          link: '/gold/audit',
        },
      ]);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch Gold Protocol status:', e);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gold Protocol Status</CardTitle>
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
        <CardTitle className="flex items-center justify-between">
          <span>Gold Protocol Status</span>
          <Badge className="bg-yellow-500 text-black">🏆 ACTIVE</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pillars.map((pillar) => (
            <a
              key={pillar.id}
              href={pillar.link}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                pillar.status === 'active'
                  ? 'border-green-300 bg-green-50 dark:bg-green-900/10'
                  : pillar.status === 'warning'
                  ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/10'
                  : 'border-gray-300 bg-gray-50 dark:bg-gray-900/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {pillar.icon}
                <Badge
                  className={
                    pillar.status === 'active'
                      ? 'bg-green-500'
                      : pillar.status === 'warning'
                      ? 'bg-orange-500'
                      : 'bg-gray-500'
                  }
                >
                  {pillar.status.toUpperCase()}
                </Badge>
              </div>
              <div className="text-sm font-semibold mb-1">{pillar.name}</div>
              <div className="text-xs text-gray-600">{pillar.metric}</div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
