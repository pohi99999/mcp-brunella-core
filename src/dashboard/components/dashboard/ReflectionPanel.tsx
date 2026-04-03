import React, { useCallback, useEffect, useState } from 'react';
import { Brain, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReflectionOverview, runReflectionNightlyCycle, type ReflectionOverview } from '@/lib/apiService';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('hu-HU');
}

export function ReflectionPanel() {
  const [overview, setOverview] = useState<ReflectionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getReflectionOverview();
      setOverview(next);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerNightlyCycle = useCallback(async () => {
    setRunning(true);
    try {
      await runReflectionNightlyCycle();
      await loadOverview();
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const painPoints = overview?.painPoints ?? [];
  const insights = overview?.insights ?? [];
  const selfModel = overview?.selfModel;

  return (
    <div className="space-y-4 p-4 text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-semibold">Reflection</h2>
            <p className="text-xs text-zinc-400">Nightly cycle, pain points, memory boundary és self-model állapot.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={error ? 'destructive' : loading || running ? 'secondary' : 'default'}>
            {error ? 'HIBA' : loading || running ? 'FRISSÍTÉS' : 'ÉLŐ'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={running}>
            <RefreshCcw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </Button>
          <Button size="sm" onClick={() => void triggerNightlyCycle()} disabled={running}>
            <Sparkles className={`mr-1 h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            Nightly cycle
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reflections</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{overview.stats.totalReflections}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Avg quality</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{formatPercent(overview.stats.avgQualityScore)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Self-model</CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold">{selfModel?.health ?? '—'}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Last reflection</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{formatDate(selfModel?.lastReflectionAt)}</CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pain points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {painPoints.length === 0 ? (
                  <p className="text-sm text-zinc-500">Jelenleg nincs visszatérő fájdalompont.</p>
                ) : painPoints.map((point) => (
                  <div key={`${point.agent}-${point.failureCount}`} className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{point.agent}</div>
                      <Badge variant="outline">{point.severity.toUpperCase()}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {point.failureCount} hiba · rate {formatPercent(point.failureRate)}
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{point.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Memory boundary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <div className="font-medium text-cyan-200">Global memory</div>
                  <p className="mt-1 text-zinc-300">{selfModel?.memoryScopes.global.purpose}</p>
                  <p className="mt-2 text-xs text-zinc-400">Sources: {selfModel?.memoryScopes.global.sources.join(', ')}</p>
                </div>
                <div className="rounded-md border border-violet-500/20 bg-violet-500/5 p-3">
                  <div className="font-medium text-violet-200">Local memory</div>
                  <p className="mt-1 text-zinc-300">{selfModel?.memoryScopes.local.purpose}</p>
                  <p className="mt-2 text-xs text-zinc-400">Sources: {selfModel?.memoryScopes.local.sources.join(', ')}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.length === 0 ? (
                  <p className="text-sm text-zinc-500">Még nincs meta insight.</p>
                ) : insights.map((insight) => (
                  <div key={insight.id} className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="h-4 w-4 text-amber-300" />
                      <span className="text-xs uppercase tracking-wider text-zinc-400">{insight.category}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-200">{insight.description}</p>
                    {insight.suggestedAction ? (
                      <p className="mt-2 text-xs text-zinc-400">Javaslat: {insight.suggestedAction}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reflection context</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-300">
                  {overview.context || 'Nincs reflection context.'}
                </pre>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default ReflectionPanel;
