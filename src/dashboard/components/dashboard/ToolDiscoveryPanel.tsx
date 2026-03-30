/**
 * ToolDiscoveryPanel — Dashboard component for MCP tool registry
 * Track #6: MCP Tool Discovery — Phase 4
 */
import React, { useState, useEffect } from 'react';
import { Wrench, Search, TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  async function fetchData(isManual = false) {
    isManual ? setIsRefreshing(true) : setLoading(true);
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
      isManual ? setIsRefreshing(false) : setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(filter.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase())) ||
    t.publishedBy.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="w-5 h-5" /> MCP Tool Discovery
        </h2>
        <button
          onClick={() => void fetchData(true)}
          className="p-2 rounded hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Frissítés"
          title="Frissítés"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
            <div className="text-2xl font-mono font-bold">{stats.totalTools}</div>
            <div className="text-xs text-gray-400">Tool-ok</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
            <div className="text-2xl font-mono font-bold">{stats.totalCalls}</div>
            <div className="text-xs text-gray-400">Összes hívás</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
            <div className="text-2xl font-mono font-bold">{stats.avgLatencyMs.toFixed(0)}ms</div>
            <div className="text-xs text-gray-400">Átlag latency</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
            <div className="text-2xl font-mono font-bold text-yellow-400">{stats.deprecatedTools}</div>
            <div className="text-xs text-gray-400">Deprecated</div>
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
          className="w-full bg-gray-800 border border-gray-700 rounded pl-10 pr-4 py-2 text-sm"
        />
      </div>

      {/* Tool List */}
      <div className="space-y-2">
        {filtered.map(tool => (
          <div key={tool.id} className="bg-gray-800 rounded-lg border border-gray-700">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-750"
              onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
            >
              <div className="flex items-center gap-3">
                {expandedTool === tool.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="font-mono text-sm">{tool.name}</span>
                <span className="text-xs text-gray-500">v{tool.version}</span>
                {tool.deprecated && (
                  <span className="text-xs bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded">deprecated</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{tool.totalCalls} hívás</span>
                <span>{tool.avgLatencyMs.toFixed(0)}ms</span>
                {tool.errorRate > 0.1 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {(tool.errorRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            {expandedTool === tool.id && (
              <div className="border-t border-gray-700 p-3 text-sm text-gray-300 space-y-2">
                <div>{tool.description}</div>
                <div className="flex gap-2">
                  {tool.tags.map(tag => (
                    <span key={tag} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-500">Publisher: {tool.publishedBy}</div>
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
