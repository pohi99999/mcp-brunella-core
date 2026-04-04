/**
 * Gold Protocol G7.4 UI: Cognitive Memory Panel
 *
 * Golden dataset + codebase indexing UI
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Database, ArrowClockwise, FloppyDisk } from '@phosphor-icons/react';

interface MemoryStats {
  goldenSamples: number;
  avgQuality: number | null;
  newSinceLastTraining: number;
  indexedFiles: number;
  indexedChunks: number;
  lastIndexed: string | null;
  lastTrainingAt: string | null;
  schedulerActive: boolean;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const EMPTY_STATS: MemoryStats = {
  goldenSamples: 0,
  avgQuality: null,
  newSinceLastTraining: 0,
  indexedFiles: 0,
  indexedChunks: 0,
  lastIndexed: null,
  lastTrainingAt: null,
  schedulerActive: false,
};

export function CognitiveMemoryPanel() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [manualTask, setManualTask] = useState('');
  const [manualResponse, setManualResponse] = useState('');
  const [manualQuality, setManualQuality] = useState(5);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Auto-refresh 15s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/memory/stats');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const indexStats = data?.index?.lastStats ?? {};
      const lastIndexTime =
        typeof data?.index?.lastIndexTime === 'number' && data.index.lastIndexTime > 0
          ? new Date(data.index.lastIndexTime).toISOString()
          : typeof data?.index?.lastUpdated === 'string'
            ? data.index.lastUpdated
            : null;

      setStats({
        goldenSamples: safeNumber(data?.golden?.totalSamples ?? data?.golden?.count),
        avgQuality:
          typeof data?.curated?.avgQuality === 'number' && Number.isFinite(data.curated.avgQuality)
            ? data.curated.avgQuality
            : typeof data?.golden?.avgQuality === 'number' && Number.isFinite(data.golden.avgQuality)
              ? data.golden.avgQuality
            : null,
        newSinceLastTraining: safeNumber(data?.golden?.newSinceLastTraining),
        indexedFiles: safeNumber(indexStats?.fileCount ?? data?.index?.filesIndexed),
        indexedChunks: safeNumber(indexStats?.chunkCount ?? data?.index?.chunksIndexed),
        lastIndexed: lastIndexTime,
        lastTrainingAt: typeof data?.golden?.lastTrainingAt === 'string' ? data.golden.lastTrainingAt : null,
        schedulerActive: Boolean(data?.index?.schedulerActive),
      });
      setMessage(null);
      setLoading(false);
    } catch (e) {
      setStats(EMPTY_STATS);
      setMessage(e instanceof Error ? e.message : 'Failed to fetch memory stats');
      setLoading(false);
    }
  };

  const saveGoldenSample = async () => {
    if (!manualTask.trim() || !manualResponse.trim()) return;
    try {
      const response = await fetch('/api/memory/golden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'dashboard_manual',
          prompt: manualTask,
          completion: manualResponse,
          quality: manualQuality / 10,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(typeof error.error === 'string' ? error.error : `HTTP ${response.status}`);
      }
      setManualTask('');
      setManualResponse('');
      setManualQuality(5);
      setMessage('Golden sample saved.');
      fetchStats();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save golden sample');
    }
  };

  const triggerReindex = async () => {
    setReindexing(true);
    try {
      const response = await fetch('/api/memory/reindex', { method: 'POST' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(typeof error.error === 'string' ? error.error : `HTTP ${response.status}`);
      }
      setMessage('Reindex scheduled.');
      setTimeout(fetchStats, 3000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to trigger reindex');
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cognitive Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const displayStats = stats ?? EMPTY_STATS;
  const lastIndexedLabel =
    displayStats.lastIndexed && !Number.isNaN(new Date(displayStats.lastIndexed).getTime())
      ? new Date(displayStats.lastIndexed).toLocaleString()
      : '—';
  const avgQualityLabel =
    displayStats.avgQuality !== null
      ? `${((displayStats.avgQuality <= 1 ? displayStats.avgQuality * 10 : displayStats.avgQuality)).toFixed(2)}/10`
      : '—';

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">Golden Samples</div>
            <div className="text-2xl font-bold">{displayStats.goldenSamples}</div>
            <div className="text-xs text-gray-600">
              Avg Quality: {avgQualityLabel}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">New Since Training</div>
            <div className="text-2xl font-bold">{displayStats.newSinceLastTraining}</div>
            <div className="text-xs text-gray-600">
              Last training: {displayStats.lastTrainingAt ? new Date(displayStats.lastTrainingAt).toLocaleString() : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">Codebase Index</div>
            <div className="text-2xl font-bold">{displayStats.indexedFiles}</div>
            <div className="text-xs text-gray-600">
              {displayStats.indexedChunks} chunks · {displayStats.schedulerActive ? 'Scheduler active' : 'Scheduler idle'}
            </div>
            <div className="text-xs text-gray-600">Last: {lastIndexedLabel}</div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Golden Sample Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FloppyDisk className="w-5 h-5" />
            Save Golden Sample
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Task</label>
              <input
                type="text"
                className="w-full p-2 border rounded text-sm"
                placeholder="Task description..."
                value={manualTask}
                onChange={(e) => setManualTask(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Response</label>
              <textarea
                className="w-full p-2 border rounded text-sm"
                placeholder="Response content..."
                rows={4}
                value={manualResponse}
                onChange={(e) => setManualResponse(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-xs text-gray-600">Quality:</label>
              <input
                type="range"
                min="1"
                max="10"
                value={manualQuality}
                onChange={(e) => setManualQuality(Number(e.target.value))}
                className="flex-1"
              />
              <Badge>{manualQuality}/10</Badge>
            </div>
            <Button onClick={saveGoldenSample} disabled={!manualTask.trim() || !manualResponse.trim()}>
              Save Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reindex */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowClockwise className="w-5 h-5" />
            Codebase Reindexing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            Trigger incremental reindexing of the codebase (only changed files).
          </p>
          <Button onClick={triggerReindex} disabled={reindexing}>
            {reindexing ? 'Reindexing...' : 'Start Reindex'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
