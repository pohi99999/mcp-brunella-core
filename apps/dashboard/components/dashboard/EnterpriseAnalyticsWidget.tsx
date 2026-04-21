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

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { safeJson } from '../../lib/apiService';
import { AlertTriangle, Download, Trophy, TrendingUp } from 'lucide-react';
import { logError } from '@/utils/logger';

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
    payload: string;
    priority: string;
    status: string;
    source_module: string;
    created_at: number;
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
            const eventsRes = await fetch('/api/v1/enterprise/analytics/events?limit=200&days=30');
            if (!eventsRes.ok) throw new Error(`Events fetch failed: ${eventsRes.status}`);
            const eventsData = await safeJson<EventsResponse>(eventsRes);
            if (eventsData.status === 'success') {
                setRecentEvents(eventsData.events);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            logError('EnterpriseAnalyticsWidget', `Fetch error: ${msg}`);
        } finally {
            setLoading(false);
        }
    }

    const trendData = useMemo(() => {
        const buckets: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const key = day.toISOString().slice(0, 10);
            buckets[key] = 0;
        }
        for (const event of recentEvents) {
            const key = new Date(event.created_at).toISOString().slice(0, 10);
            if (key in buckets) buckets[key] += 1;
        }
        return Object.entries(buckets).map(([day, count]) => ({ day: day.slice(5), count }));
    }, [recentEvents]);

    const rankingData = useMemo(() => {
        const grouped: Record<string, { total: number; failed: number }> = {};
        for (const event of recentEvents) {
            const key = event.source_module || 'unknown';
            if (!grouped[key]) grouped[key] = { total: 0, failed: 0 };
            grouped[key].total += 1;
            if (String(event.status).toLowerCase().includes('fail')) grouped[key].failed += 1;
        }
        return Object.entries(grouped)
            .map(([agent, v]) => ({
                agent,
                total: v.total,
                successRate: v.total > 0 ? Math.round(((v.total - v.failed) / v.total) * 100) : 0,
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5);
    }, [recentEvents]);

    const anomalyFlags = useMemo(() => {
        const total = recentEvents.length;
        if (total === 0) return [] as string[];

        const failed = recentEvents.filter((e) => String(e.status).toLowerCase().includes('fail')).length;
        const failRate = (failed / total) * 100;
        const last24h = recentEvents.filter((e) => Date.now() - e.created_at < 24 * 60 * 60 * 1000).length;
        const baseline = total / 30;

        const flags: string[] = [];
        if (failRate >= 20) flags.push(`Magas hibaarány: ${failRate.toFixed(1)}%`);
        if (baseline > 0 && last24h > baseline * 2.5) flags.push(`Esemény spike az utóbbi 24h-ban: ${last24h}`);
        return flags;
    }, [recentEvents]);

    function exportJson(): void {
        const blob = new Blob([JSON.stringify(recentEvents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enterprise-events-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportCsv(): void {
        const headers = ['id', 'type', 'priority', 'status', 'source_module', 'created_at'];
        const rows = recentEvents.map((e) => [
            e.id,
            e.type,
            e.priority,
            e.status,
            e.source_module,
            new Date(e.created_at).toISOString(),
        ]);
        const csv = [headers, ...rows]
            .map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enterprise-events-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
                    <div className="text-center text-zinc-500">Loading analytics...</div>
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
                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={exportJson}
                            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                        >
                            <Download className="h-3 w-3" /> JSON
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                        >
                            <Download className="h-3 w-3" /> CSV
                        </button>
                    </div>

                    {anomalyFlags.length > 0 && (
                        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                            <div className="mb-1 flex items-center gap-1 font-medium text-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Anomália figyelmeztetés
                            </div>
                            <ul className="list-disc pl-4 text-amber-200">
                                {anomalyFlags.map((flag) => (
                                    <li key={flag}>{flag}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{stats.totalEvents}</div>
                            <div className="text-xs text-zinc-500">Total Events</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{stats.last24h}</div>
                            <div className="text-xs text-zinc-500">Last 24h</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">{stats.last7d}</div>
                            <div className="text-xs text-zinc-500">Last 7 days</div>
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
                                <div className="text-xs text-zinc-500 text-center py-4">
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
                                            <div className="text-zinc-500">{event.source_module}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={getPriorityColor(event.priority)} variant="outline">
                                                {event.priority}
                                            </Badge>
                                            <span className="text-zinc-500">
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

                    <div>
                        <div className="mb-2 flex items-center gap-1 text-sm font-medium">
                            <TrendingUp className="h-4 w-4" /> 7 napos trend
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {trendData.map((d) => {
                                const max = Math.max(...trendData.map((x) => x.count), 1);
                                const ratio = d.count / max;
                                const heightClass = ratio > 0.85
                                    ? 'h-10'
                                    : ratio > 0.65
                                        ? 'h-8'
                                        : ratio > 0.45
                                            ? 'h-6'
                                            : ratio > 0.2
                                                ? 'h-4'
                                                : 'h-2';
                                return (
                                    <div key={d.day} className="flex flex-col items-center gap-1">
                                        <div className={`w-full rounded bg-blue-500/30 ${heightClass}`} />
                                        <span className="text-[10px] text-zinc-400">{d.day}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center gap-1 text-sm font-medium">
                            <Trophy className="h-4 w-4" /> Agent rangsor (success rate)
                        </div>
                        <div className="space-y-1">
                            {rankingData.length === 0 ? (
                                <div className="text-xs text-zinc-400">Nincs elég adat a rangsorhoz</div>
                            ) : (
                                rankingData.map((r) => (
                                    <div key={r.agent} className="flex items-center justify-between text-xs">
                                        <span className="truncate text-zinc-300">{r.agent}</span>
                                        <span className="text-zinc-200">{r.successRate}% · {r.total} esemény</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
