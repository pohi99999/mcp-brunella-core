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
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Stats Cards */}
      {stats && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">Total Entries</div>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Allowed
              </div>
              <div className="text-2xl font-bold text-green-600">{stats.allowedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <ShieldSlash className="w-3 h-3" /> Denied
              </div>
              <div className="text-2xl font-bold text-red-600">{stats.deniedCount}</div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Audit Log */}
      <Card className="lg:col-span-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Audit Log ({entries.length} recent)
            </CardTitle>
            <Button
              size="sm"
              variant={showOnlyDenied ? 'default' : 'outline'}
              onClick={() => setShowOnlyDenied(!showOnlyDenied)}
            >
              {showOnlyDenied ? 'Show All' : 'Show Denied Only'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className={`p-3 border rounded-lg ${
                  entry.result === 'DENIED' ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className={entry.result === 'ALLOWED' ? 'bg-green-500' : 'bg-red-500'}>
                      {entry.result}
                    </Badge>
                    <span className="font-semibold text-sm">{entry.agentName}</span>
                    <span className="text-xs text-gray-500">→ {entry.action}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-mono">{entry.resource.slice(0, 80)}</span>
                  {entry.reason && (
                    <div className="mt-1 text-red-600">Reason: {entry.reason}</div>
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
