/**
 * Gold Protocol G7.6: Audit Panel
 *
 * Permission audit log böngészése
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ShieldCheck, ShieldSlash, Eye } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id?: number;
  timestamp: string;
  agentName: string;
  action: string;
  resource: string;
  result: 'ALLOWED' | 'DENIED';
  reason?: string;
}

interface AuditStats {
  totalEntries: number;
  allowedCount: number;
  deniedCount: number;
  byAgent: Record<string, { allowed: number; denied: number }>;
}

export function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [showOnlyDenied, setShowOnlyDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudit();
    fetchStats();
    const interval = setInterval(() => {
      fetchAudit();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [showOnlyDenied]);

  const fetchAudit = async () => {
    try {
      const endpoint = showOnlyDenied ? '/api/audit/denied' : '/api/audit/log?limit=50';
      const res = await fetch(endpoint);
      const data = await res.json();
      setEntries(data.entries || []);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch audit:', e);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/audit/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch audit stats:', e);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="text-sm text-zinc-500">Betöltés...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-12">
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardContent className="p-4 lg:p-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Total Entries</div>
              <div className="text-2xl font-semibold font-mono text-white">{stats.totalEntries}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardContent className="p-4 lg:p-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Allowed
              </div>
              <div className="text-2xl font-semibold font-mono text-emerald-300">{stats.allowedCount}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardContent className="p-4 lg:p-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 flex items-center gap-1">
                <ShieldSlash className="w-3 h-3" /> Denied
              </div>
              <div className="text-2xl font-semibold font-mono text-rose-300">{stats.deniedCount}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10 overflow-hidden">
            <CardContent className="p-4 lg:p-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Denied Ratio</div>
              <div className="text-2xl font-semibold font-mono text-cyan-300">
                {stats.totalEntries ? ((stats.deniedCount / stats.totalEntries) * 100).toFixed(1) : '0.0'}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="glass-card border-white/10 overflow-hidden lg:col-span-12">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
              <Eye className="w-5 h-5" />
              Audit Log ({entries.length} recent)
            </CardTitle>
            <Button
              size="sm"
              variant={showOnlyDenied ? 'default' : 'outline'}
              onClick={() => setShowOnlyDenied(!showOnlyDenied)}
              className="rounded-full border-white/10 bg-white/[0.04] text-xs uppercase tracking-[0.22em] text-zinc-300 hover:bg-white/[0.06]"
            >
              {showOnlyDenied ? 'Show All' : 'Show Denied Only'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-2xl border p-4 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15',
                  entry.result === 'DENIED'
                    ? 'border-rose-500/20 bg-rose-500/5'
                    : 'border-emerald-500/15 bg-emerald-500/5'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-[0.22em]',
                        entry.result === 'ALLOWED'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                      )}
                    >
                      {entry.result}
                    </Badge>
                    <span className="font-semibold text-sm text-white">{entry.agentName}</span>
                    <span className="text-xs text-zinc-500">→ {entry.action}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-zinc-400">
                  <span className="font-mono">{entry.resource.slice(0, 80)}</span>
                  {entry.reason && (
                    <div className="mt-2 text-rose-300">Reason: {entry.reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
