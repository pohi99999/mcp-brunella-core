/**
 * Enterprise Analytics Widget
 * Phase 3: D1-powered analytics dashboard component
 * 
 * Displays:
 * - Enterprise event statistics
 * - Event type distribution
 * - Priority breakdown
 * - Recent events timeline
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { safeJson } from '../../lib/apiService';

interface EnterpriseStats {
  totalEvents: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  last24h: number;
  last7d: number;
}

interface EnterpriseEvent {
  id: string;
  type: string;
  priority: string;
  status: string;
  source_module: string;
  created_at: string;
}

interface StatsResponse {
  status: string;
  source: string;
  stats: EnterpriseStats;
}

interface EventsResponse {
  status: string;
  source: string;
  events: EnterpriseEvent[];
  total: number;
}

export function EnterpriseAnalyticsWidget() {
  const [stats, setStats] = useState<EnterpriseStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<EnterpriseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats
      const statsRes = await fetch('/api/v1/enterprise/analytics/stats');
      if (!statsRes.ok) throw new Error(`Stats fetch failed: ${statsRes.status}`);
      const statsData = await safeJson<StatsResponse>(statsRes);
      if (statsData.status === 'success') {
        setStats(statsData.stats);
      }

      // Fetch recent events (last 10)
      const eventsRes = await fetch('/api/v1/enterprise/analytics/events?limit=10&days=7');
      if (!eventsRes.ok) throw new Error(`Events fetch failed: ${eventsRes.status}`);
      const eventsData = await safeJson<EventsResponse>(eventsRes);
      if (eventsData.status === 'success') {
        setRecentEvents(eventsData.events);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Enterprise analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'processing': return 'bg-blue-600';
      case 'pending': return 'bg-yellow-600';
      case 'failed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  }

  if (loading && !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enterprise Analytics</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enterprise Analytics</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-sm">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enterprise Analytics</CardTitle>
        <CardDescription>D1 Cloud Storage • Real-time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalEvents}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.last24h}</div>
              <div className="text-xs text-muted-foreground">Last 24h</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.last7d}</div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
          </div>

          {/* Priority Distribution */}
          <div>
            <div className="text-sm font-medium mb-2">Priority Distribution</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.byPriority).map(([priority, count]) => (
                <Badge key={priority} className={getPriorityColor(priority)}>
                  {priority}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Status Distribution */}
          <div>
            <div className="text-sm font-medium mb-2">Status</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <Badge key={status} className={getStatusColor(status)}>
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <div className="text-sm font-medium mb-2">Recent Events</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No events in the last 7 days
                </div>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between text-xs border-b pb-2"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{event.type}</div>
                      <div className="text-muted-foreground">{event.source_module}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(event.priority)} variant="outline">
                        {event.priority}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatTimestamp(event.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Types Summary */}
          {Object.keys(stats.byType).length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Event Types</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(stats.byType)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between border-b pb-1">
                      <span className="truncate">{type}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
