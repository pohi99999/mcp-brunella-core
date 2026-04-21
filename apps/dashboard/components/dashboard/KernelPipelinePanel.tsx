/**
 * KernelPipelinePanel.tsx — Dashboard panel for the Brunella Kernel Pipeline
 *
 * Shows:
 *   - Pipeline status summary (total / running / success / failed)
 *   - Recent run list with module-by-module step trace
 *   - Manual run launcher (POST /api/v1/kernel/run)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, Layers, Play, RefreshCw } from 'lucide-react';

// ── Types (minimal, matches kernelRoute response) ────────────────────────────

interface RunSummary {
  runId: string;
  goal: string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  moduleCount: number;
}

interface KernelStatus {
  status: string;
  modules: string[];
  runs: { total: number; running: number; succeeded: number; failed: number };
}

interface RunDetail {
  runId: string;
  goal: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  entries: Array<{ module: string; status: string; latencyMs: number; errors: string[] }>;
}

// ── Utility ──────────────────────────────────────────────────────────────────

const MODULE_ORDER = [
  'intent_router', 'planner', 'context_builder',
  'tool_executor', 'critic', 'guardrail', 'learning_loop',
];

function statusColor(s: string): string {
  if (s === 'success') return 'text-emerald-400';
  if (s === 'error') return 'text-red-400';
  if (s === 'running') return 'text-amber-400';
  return 'text-zinc-500';
}

function statusIcon(s: string) {
  if (s === 'success') return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (s === 'error') return <AlertCircle size={14} className="text-red-400" />;
  if (s === 'running') return <Activity size={14} className="text-amber-400 animate-pulse" />;
  return <Clock size={14} className="text-zinc-600" />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function KernelPipelinePanel() {
  const [status, setStatus] = useState<KernelStatus | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, runsRes] = await Promise.all([
        fetch('/api/v1/kernel/status'),
        fetch('/api/v1/kernel/runs'),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (runsRes.ok) {
        const data = await runsRes.json() as { runs: RunSummary[] };
        setRuns(data.runs.reverse());
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  const selectRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/v1/kernel/runs/${runId}`);
      if (res.ok) setSelectedRun(await res.json());
    } catch {
      // non-fatal
    }
  }, []);

  const launchRun = useCallback(async () => {
    if (!goal.trim()) return;
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await fetch('/api/v1/kernel/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const data = await res.json() as { runId?: string; status?: string; error?: string };
      setLaunchResult(res.ok ? `✔ Run started: ${data.runId ?? 'unknown'}` : `✘ ${data.error ?? 'unknown error'}`);
      setGoal('');
      fetchStatus();
    } catch (e: unknown) {
      setLaunchResult(`✘ Network error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaunching(false);
    }
  }, [goal, fetchStatus]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto text-zinc-100">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="text-violet-400" size={22} />
          <div>
            <h2 className="text-xl font-semibold">Kernel Pipeline</h2>
            <p className="text-xs text-zinc-500">Supervisor-driven 8-module architecture</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status bar */}
      {status && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: status.runs.total, color: 'text-zinc-300' },
            { label: 'Running', value: status.runs.running, color: 'text-amber-400' },
            { label: 'Succeeded', value: status.runs.succeeded, color: 'text-emerald-400' },
            { label: 'Failed', value: status.runs.failed, color: 'text-red-400' },
          ].map((cell) => (
            <div key={cell.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
              <div className={`text-2xl font-bold ${cell.color}`}>{cell.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{cell.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Module pipeline diagram */}
      {status && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Pipeline Modules</p>
          <div className="flex items-center gap-1 flex-wrap">
            {MODULE_ORDER.map((m, i) => (
              <React.Fragment key={m}>
                <span className="px-2 py-0.5 rounded text-[11px] bg-violet-900/40 text-violet-300 border border-violet-700/30">
                  {m.replace(/_/g, ' ')}
                </span>
                {i < MODULE_ORDER.length - 1 && (
                  <span className="text-zinc-600 text-xs">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Launch a run */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">New Run</p>
        <div className="flex gap-2">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !launching && launchRun()}
            placeholder="Describe the goal…"
            className="flex-1 bg-white/[0.04] border border-white/10 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
          />
          <button
            onClick={launchRun}
            disabled={launching || !goal.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium transition-colors"
          >
            <Play size={13} />
            {launching ? 'Launching…' : 'Run'}
          </button>
        </div>
        {launchResult && (
          <p className={`text-xs mt-1.5 ${launchResult.startsWith('✘') ? 'text-red-400' : 'text-emerald-400'}`}>
            {launchResult}
          </p>
        )}
      </div>

      {/* Run list + detail */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Run list */}
        <div className="flex flex-col gap-1 w-72 overflow-y-auto shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Recent Runs</p>
          {runs.length === 0 && <p className="text-xs text-zinc-600">No runs yet.</p>}
          {runs.map((run) => (
            <button
              key={run.runId}
              onClick={() => selectRun(run.runId)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors text-xs ${
                selectedRun?.runId === run.runId
                  ? 'border-violet-500/50 bg-violet-900/20'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {statusIcon(run.status)}
                <span className={`font-medium ${statusColor(run.status)}`}>{run.status}</span>
                <span className="text-zinc-600 ml-auto">{run.moduleCount}m</span>
              </div>
              <div className="text-zinc-400 line-clamp-2">{run.goal}</div>
              <div className="text-zinc-600 mt-0.5">{new Date(run.startedAt).toLocaleTimeString()}</div>
            </button>
          ))}
        </div>

        {/* Run detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedRun ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-3">
                {statusIcon(selectedRun.status)}
                <span className="text-sm font-medium">{selectedRun.runId.slice(0, 12)}…</span>
                <span className={`text-xs ${statusColor(selectedRun.status)}`}>{selectedRun.status}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">{selectedRun.goal}</p>

              <div className="space-y-1.5">
                {selectedRun.entries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded px-2 py-1.5 bg-white/[0.03] border border-white/[0.05] text-xs"
                  >
                    {statusIcon(entry.status)}
                    <span className="text-violet-300 w-28 shrink-0">{entry.module.replace(/_/g, ' ')}</span>
                    <span className={statusColor(entry.status)}>{entry.status}</span>
                    <span className="text-zinc-600 ml-auto">{entry.latencyMs}ms</span>
                    {entry.errors.length > 0 && (
                      <span className="text-red-400 text-[10px] truncate max-w-[120px]">{entry.errors[0]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-zinc-600">
              Select a run to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
