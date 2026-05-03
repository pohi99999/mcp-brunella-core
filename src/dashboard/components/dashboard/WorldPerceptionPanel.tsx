import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  EyeOff,
  Globe,
  Radar,
  RefreshCcw,
  Send,
} from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  createWorldPerceptionSignal,
  getWorldPerceptionOverview,
  getWorldPerceptionSignals,
  ignoreWorldPerceptionSignal,
  promoteWorldPerceptionSignal,
  runWorldPerceptionCycle,
  type CreateWorldPerceptionSignalInput,
  type WorldPerceptionOverview,
  type WorldPerceptionSignalRecord,
} from '@/lib/worldPerceptionApi';

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function StatCard({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-400">{hint}</div> : null}
    </div>
  );
}

export function WorldPerceptionPanel() {
  const [overview, setOverview] = useState<WorldPerceptionOverview | null>(null);
  const [signals, setSignals] = useState<WorldPerceptionSignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [form, setForm] = useState<CreateWorldPerceptionSignalInput>({
    source: '',
    title: '',
    summary: '',
    domain: 'business',
    provenance: '',
    biasLabel: 'unknown',
    confidence: 0.6,
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, signalData] = await Promise.all([
        getWorldPerceptionOverview(),
        getWorldPerceptionSignals('detected', 10),
      ]);
      setOverview(overviewData);
      setSignals(signalData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!form.source.trim() || !form.title.trim() || !form.summary.trim() || !form.provenance.trim()) {
      setError('A source, title, summary és provenance mezők kötelezőek.');
      return;
    }

    setActionBusy('create');
    setError(null);
    try {
      await createWorldPerceptionSignal({
        ...form,
        tags: tagInput.split(',').map((part) => part.trim()).filter(Boolean),
      });
      setForm({
        source: '',
        title: '',
        summary: '',
        domain: 'business',
        provenance: '',
        biasLabel: 'unknown',
        confidence: 0.6,
        tags: [],
      });
      setTagInput('');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setActionBusy(null);
    }
  }, [form, load, tagInput]);

  const handleCycle = useCallback(async () => {
    setActionBusy('cycle');
    setError(null);
    try {
      await runWorldPerceptionCycle();
      await load();
    } catch (cycleError) {
      setError(cycleError instanceof Error ? cycleError.message : String(cycleError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  const handlePromote = useCallback(async (signalId: string) => {
    setActionBusy(`promote:${signalId}`);
    setError(null);
    try {
      await promoteWorldPerceptionSignal(signalId);
      await load();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : String(promoteError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  const handleIgnore = useCallback(async (signalId: string) => {
    setActionBusy(`ignore:${signalId}`);
    setError(null);
    try {
      await ignoreWorldPerceptionSignal(signalId);
      await load();
    } catch (ignoreError) {
      setError(ignoreError instanceof Error ? ignoreError.message : String(ignoreError));
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  return (
    <div className="space-y-6" data-testid="world-perception-panel">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <Globe size={18} className="text-cyan-300" />
              World Perception
            </CardTitle>
            <p className="text-sm text-zinc-400">
              Külső knowledge-card jelek normalizálása, queue review és intelligence promotion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading || actionBusy !== null}
            >
              <RefreshCcw size={14} />
              Frissítés
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              onClick={() => void handleCycle()}
              disabled={loading || actionBusy !== null}
              data-testid="world-cycle-button"
            >
              <Radar size={14} />
              Perception ciklus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Signals" value={String(overview?.summary.totalSignals ?? 0)} hint="Összes ismert world signal" testId="world-stat-total" />
            <StatCard label="Detected" value={String(overview?.summary.detected ?? 0)} hint="Reviewra váró jelek" testId="world-stat-detected" />
            <StatCard label="Promoted" value={String(overview?.summary.promoted ?? 0)} hint="Intelligence-be továbbítva" testId="world-stat-promoted" />
            <StatCard label="Avg score" value={(overview?.summary.avgScore ?? 0).toFixed(2)} hint="Átlagos perception score" testId="world-stat-score" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Send size={16} className="text-cyan-300" />
                  Manual observation
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={form.source}
                    onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
                    placeholder="Source / URL"
                    data-testid="world-source-input"
                  />
                  <select
                    title="Domain"
                    aria-label="Domain"
                    value={form.domain}
                    onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value as CreateWorldPerceptionSignalInput['domain'] }))}
                    className="rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="business">business</option>
                    <option value="social">social</option>
                    <option value="political">political</option>
                    <option value="financial">financial</option>
                    <option value="technology">technology</option>
                  </select>
                  <Input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Title"
                    className="md:col-span-2"
                    data-testid="world-title-input"
                  />
                  <textarea
                    value={form.summary}
                    onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                    placeholder="Summary"
                    rows={3}
                    className="min-h-[96px] rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-sm text-zinc-100 md:col-span-2"
                    data-testid="world-summary-input"
                  />
                  <Input
                    value={form.provenance}
                    onChange={(event) => setForm((prev) => ({ ...prev, provenance: event.target.value }))}
                    placeholder="Provenance"
                    className="md:col-span-2"
                  />
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder="Tags, comma-separated"
                  />
                  <div className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2">
                    <input
                      title="Confidence"
                      aria-label="Confidence"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={form.confidence ?? 0.6}
                      onChange={(event) => setForm((prev) => ({ ...prev, confidence: Number(event.target.value) }))}
                      className="flex-1"
                    />
                    <Badge>{(form.confidence ?? 0.6).toFixed(2)}</Badge>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      className="gap-2"
                      disabled={loading || actionBusy !== null}
                      onClick={() => void handleCreate()}
                      data-testid="world-create-button"
                    >
                      <Send size={14} />
                      Observation mentése
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white">Domain coverage</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {overview?.domainCoverage.length ? overview.domainCoverage.map((entry) => (
                    <div key={entry.domain} className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-zinc-200">
                      <span>{entry.domain}</span>
                      <Badge variant="outline">{entry.count}</Badge>
                    </div>
                  )) : (
                    <div className="text-sm text-zinc-400">Még nincs lefedett domain.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  Pending promotion queue
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-sm text-zinc-400">Betöltés...</div>
                  ) : signals.length === 0 ? (
                    <div className="text-sm text-zinc-400">Nincs reviewra váró world signal.</div>
                  ) : signals.map((signal) => (
                    <div key={signal.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-4" data-testid={`world-signal-${signal.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{signal.title}</div>
                          <div className="mt-1 text-xs text-zinc-400">
                            {signal.domain} • score {signal.score.toFixed(2)} • observed {formatTimestamp(signal.observedAt)}
                          </div>
                        </div>
                        <Badge variant="outline">{signal.status}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-zinc-300">{signal.summary}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => void handlePromote(signal.id)}
                          disabled={loading || actionBusy !== null}
                        >
                          <CheckCircle2 size={14} />
                          Promote
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => void handleIgnore(signal.id)}
                          disabled={loading || actionBusy !== null}
                        >
                          <EyeOff size={14} />
                          Ignore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white">Recent promotions</div>
                <div className="space-y-2">
                  {overview?.recentPromotions.length ? overview.recentPromotions.map((signal) => (
                    <div key={signal.id} className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-zinc-200">
                      <div className="font-medium text-white">{signal.title}</div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {signal.intelligenceSignalId ?? '—'} • {formatTimestamp(signal.promotedAt)}
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-zinc-400">Még nincs promoted world signal.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200" data-testid="world-error">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
