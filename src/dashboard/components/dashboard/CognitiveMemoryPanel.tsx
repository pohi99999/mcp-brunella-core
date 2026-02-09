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
  avgQuality: number;
  indexedFiles: number;
  indexedChunks: number;
  lastIndexed: string;
}

export function CognitiveMemoryPanel() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [manualTask, setManualTask] = useState('');
  const [manualResponse, setManualResponse] = useState('');
  const [manualQuality, setManualQuality] = useState(5);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Auto-refresh 15s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/memory/stats');
      const data = await res.json();
      setStats({
        goldenSamples: data.golden.count,
        avgQuality: data.golden.avgQuality,
        indexedFiles: data.index.filesIndexed,
        indexedChunks: data.index.chunksIndexed,
        lastIndexed: data.index.lastUpdated,
      });
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch memory stats:', e);
      setLoading(false);
    }
  };

  const saveGoldenSample = async () => {
    if (!manualTask.trim() || !manualResponse.trim()) return;
    try {
      await fetch('/api/memory/golden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: manualTask,
          response: manualResponse,
          quality: manualQuality,
        }),
      });
      setManualTask('');
      setManualResponse('');
      setManualQuality(5);
      fetchStats();
    } catch (e) {
      console.error('Failed to save golden sample:', e);
    }
  };

  const triggerReindex = async () => {
    setReindexing(true);
    try {
      await fetch('/api/memory/reindex', { method: 'POST' });
      setTimeout(fetchStats, 3000);
    } catch (e) {
      console.error('Failed to trigger reindex:', e);
    } finally {
      setReindexing(false);
    }
  };

  if (loading || !stats) {
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

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">Golden Samples</div>
            <div className="text-2xl font-bold">{stats.goldenSamples}</div>
            <div className="text-xs text-gray-600">Avg Quality: {stats.avgQuality.toFixed(2)}/10</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">Indexed Files</div>
            <div className="text-2xl font-bold">{stats.indexedFiles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500 mb-1">Indexed Chunks</div>
            <div className="text-2xl font-bold">{stats.indexedChunks}</div>
            <div className="text-xs text-gray-600">Last: {new Date(stats.lastIndexed).toLocaleString()}</div>
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
