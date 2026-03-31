/**
 * ToolDiscoveryPanel — Dashboard component for MCP tool registry
 * Track #6: MCP Tool Discovery — Phase 4
 */
import React, { useState, useEffect } from 'react';
import { Wrench, Search, TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ToolInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  publishedBy: string;
  tags: string[];
  deprecated: boolean;
  totalCalls: number;
  errorRate: number;
  avgLatencyMs: number;
}

interface RegistryStats {
  totalTools: number;
  deprecatedTools: number;
  totalCalls: number;
  avgLatencyMs: number;
  publishers: string[];
}

export default function ToolDiscoveryPanel() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [toolsRes, statsRes] = await Promise.all([
        fetch('/api/v1/tools/registry'),
        fetch('/api/v1/tools/stats'),
      ]);
      if (toolsRes.ok) setTools(await toolsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase())) ||
    t.publishedBy.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Tool registry</p>
          <h2 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-300" /> MCP Tool Discovery
          </h2>
        </div>
        <button onClick={() => void fetchData()} className="rounded-full border border-white/10 bg-white/[0.02] p-2 text-zinc-100 hover:bg-white/[0.05]" title="Frissítés">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
            <div className="font-mono text-2xl font-semibold text-zinc-100">{stats.totalTools}</div>
            <div className="text-xs text-zinc-500">Tool-ok</div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
            <div className="font-mono text-2xl font-semibold text-zinc-100">{stats.totalCalls}</div>
            <div className="text-xs text-zinc-500">Összes hívás</div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
            <div className="font-mono text-2xl font-semibold text-zinc-100">{stats.avgLatencyMs.toFixed(0)}ms</div>
            <div className="text-xs text-zinc-500">Átlag latency</div>
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
            <div className="font-mono text-2xl font-semibold text-amber-300">{stats.deprecatedTools}</div>
            <div className="text-xs text-zinc-500">Deprecated</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Keresés név, tag vagy publisher alapján..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      {/* Tool List */}
      <div className="space-y-2">
        {filtered.map(tool => (
          <div key={tool.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.03]"
              onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
            >
              <div className="flex items-center gap-3">
                {expandedTool === tool.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-mono text-sm text-zinc-100">{tool.name}</span>
                <span className="text-xs text-zinc-500">v{tool.version}</span>
                {tool.deprecated && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-200">deprecated</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{tool.totalCalls} hívás</span>
                <span>{tool.avgLatencyMs.toFixed(0)}ms</span>
                {tool.errorRate > 0.1 && (
                  <span className="text-red-300 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {(tool.errorRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            {expandedTool === tool.id && (
              <div className="border-t border-white/[0.05] p-3 text-sm text-zinc-300 space-y-2">
                <div>{tool.description}</div>
                <div className="flex gap-2">
                  {tool.tags.map(tag => (
                    <span key={tag} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-100">{tag}</span>
                  ))}
                </div>
                <div className="text-xs text-zinc-500">Publisher: {tool.publishedBy}</div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">Nincs tool az aktuális szűrőhöz</div>
        )}
      </div>
    </div>
  );
}
