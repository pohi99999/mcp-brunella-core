import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

interface LlmStats {
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Array<{ provider: string; count: number; avgDuration: number; tokens: number; cost: number }>;
  byModel: Array<{ model: string; count: number; tokens: number }>;
  recentErrors: Array<{ timestamp: string; provider: string; error: string }>;
}

interface TimelinePoint {
  hour: string;
  count: number;
  tokens: number;
  errors: number;
  avgDurationMs: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const API_BASE = '';

export default function LLMObservabilityPanel() {
  const [stats, setStats] = useState<LlmStats | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, timelineRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/observability/stats`),
        fetch(`${API_BASE}/api/v1/observability/timeline?hours=${hours}`),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json() as { stats?: LlmStats };
        if (d.stats) setStats(d.stats);
      }
      if (timelineRes.ok) {
        const d = await timelineRes.json() as { timeline?: TimelinePoint[] };
        if (d.timeline) setTimeline(d.timeline);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ismeretlen hiba');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !stats) {
    return <div className="p-6 text-center text-zinc-400">Betöltés...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700 rounded p-4 text-red-300">
          Hiba: {error}
          <button onClick={fetchData} className="ml-4 underline">Újrapróbálás</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🔭 LLM Observability</h2>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-sm"
          >
            <option value={1}>1 óra</option>
            <option value={6}>6 óra</option>
            <option value={24}>24 óra</option>
            <option value={72}>3 nap</option>
            <option value={168}>1 hét</option>
          </select>
          <button
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            ↻ Frissítés
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard label="Összes hívás" value={stats?.totalCalls ?? 0} />
        <KPICard label="Sikerráta" value={`${(stats?.successRate ?? 100).toFixed(1)}%`} color={
          (stats?.successRate ?? 100) >= 95 ? 'text-green-400' : 'text-yellow-400'
        } />
        <KPICard label="Átlag latency" value={`${stats?.avgDurationMs ?? 0} ms`} />
        <KPICard label="Összes token" value={formatNumber(stats?.totalTokens ?? 0)} />
        <KPICard label="Költség (USD)" value={`$${(stats?.totalCostUsd ?? 0).toFixed(4)}`} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Distribution Pie */}
        <ChartCard title="Provider eloszlás">
          {stats?.byProvider && stats.byProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.byProvider}
                  dataKey="count"
                  nameKey="provider"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  label={({ provider, count }) => `${provider}: ${count}`}
                >
                  {stats.byProvider.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        {/* Latency by Provider Bar */}
        <ChartCard title="Átlag latency provider-enként (ms)">
          {stats?.byProvider && stats.byProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.byProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="provider" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
                <Bar dataKey="avgDuration" fill="#3b82f6" name="Átlag ms" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* Timeline Chart */}
      <ChartCard title="Hívások idővonala">
        {timeline.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="hour" stroke="#888" tickFormatter={(v: string) => v.slice(11, 16)} />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Hívások" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Hibák" strokeWidth={2} dot={false} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
      </ChartCard>

      {/* Token Usage by Model */}
      <ChartCard title="Token használat modell-enként">
        {stats?.byModel && stats.byModel.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.byModel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="model" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
              <Bar dataKey="tokens" fill="#10b981" name="Tokenek" />
              <Bar dataKey="count" fill="#f59e0b" name="Hívások" />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState />}
      </ChartCard>

      {/* Recent Errors */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-red-400">⚠ Legutóbbi hibák</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {stats.recentErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-3 text-sm bg-red-950/30 border border-red-900/40 rounded p-2">
                <span className="text-zinc-500 shrink-0">{err.timestamp.slice(0, 19)}</span>
                <span className="text-orange-400 shrink-0">[{err.provider}]</span>
                <span className="text-red-300 break-all">{err.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-40 text-zinc-600">
      Még nincs adat — az LLM hívások automatikusan naplózódnak
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
