/**
 * ProjectMaintainerPanel — read-only dashboard view for Project Maintainer reports.
 *
 * Shows the latest maintenance report: findings grouped by category, suggestions
 * list, track health summary, and a button to trigger an on-demand scan.
 */

import React, { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, Info, RefreshCw, CheckCircle, Folder } from 'lucide-react';
import {
  getLatestProjectMaintainerReport,
  runProjectMaintainerReport,
  type ProjectMaintainerFinding,
  type ProjectMaintainerLatestReportResponse,
  type ProjectMaintainerReport,
  type ProjectMaintainerSuggestion,
} from '@/lib/apiService';

type FindingSeverity = ProjectMaintainerFinding['severity'];
type FindingCategory = ProjectMaintainerFinding['category'];
type SuggestionAction = ProjectMaintainerSuggestion['action'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<FindingSeverity, React.ReactNode> = {
  high: <AlertTriangle className="h-4 w-4 text-red-400" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  low: <Info className="h-4 w-4 text-blue-400" />,
  info: <Info className="h-4 w-4 text-slate-400" />,
};

const CATEGORY_LABEL: Record<FindingCategory, string> = {
  'root-noise': 'Root zaj',
  'misplaced-file': 'Rossz helyre kerülő fájl',
  'track-anomaly': 'Track anomália',
  'structure-drift': 'Struktúra eltérés',
};

const ACTION_BADGE: Record<SuggestionAction, string> = {
  review: 'Ellenőrzés',
  create: 'Létrehozás',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('hu-HU');
  } catch {
    return iso;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FindingItem({ finding }: { finding: ProjectMaintainerFinding }) {
  return (
    <li className="flex items-start gap-2 py-1 text-sm">
      <span className="mt-0.5 shrink-0">{SEVERITY_ICON[finding.severity]}</span>
      <span className="flex-1 text-slate-200">
        <span className="text-slate-400 text-xs mr-1">[{CATEGORY_LABEL[finding.category]}]</span>
        {finding.message}
        {finding.path && (
          <code className="ml-1 text-xs text-slate-400 bg-slate-800 px-1 rounded">{finding.path}</code>
        )}
      </span>
    </li>
  );
}

function SuggestionItem({ suggestion }: { suggestion: ProjectMaintainerSuggestion }) {
  return (
    <li className="py-1 text-sm flex items-start gap-2">
      <span className="shrink-0 rounded px-1 py-0.5 text-xs font-medium bg-slate-700 text-slate-300">
        {ACTION_BADGE[suggestion.action]}
      </span>
      <div className="flex-1">
        <code className="text-xs text-slate-300">{suggestion.target}</code>
        <p className="text-xs text-slate-400 mt-0.5">{suggestion.reason}</p>
      </div>
    </li>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ProjectMaintainerPanel() {
  const [data, setData] = useState<ProjectMaintainerLatestReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = async () => {
    setLoading(true);
    setError(null);
    try {
      const latestReport = await getLatestProjectMaintainerReport();
      setData(latestReport);
    } catch (e) {
      if (e instanceof Error && e.message.includes('HTTP 404')) {
        setData(null);
      } else {
        setError(e instanceof Error ? e.message : 'Ismeretlen hiba');
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerRun = async () => {
    setRunning(true);
    setError(null);
    try {
      await runProjectMaintainerReport();
      await fetchLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Futtatás sikertelen');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void fetchLatest();
  }, []);

  const report = data?.report;

  return (
    <div className="space-y-4 p-4 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-semibold">Project Maintainer</h2>
        </div>
        <button
          onClick={() => void triggerRun()}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Futtatás...' : 'Scan futtatása'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/40 border border-red-700 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-slate-400">Betöltés...</div>
      )}

      {!loading && !report && !error && (
        <div className="rounded-md bg-slate-800 p-4 text-sm text-slate-400">
          Még nincs riport. Kattints a „Scan futtatása" gombra az első riport elkészítéséhez.
        </div>
      )}

      {report && (
        <>
          {/* Meta */}
          <div className="rounded-md bg-slate-800 p-3 text-xs text-slate-400 flex flex-wrap gap-4">
            <span>Generálva: <strong className="text-slate-200">{formatDate(report.generatedAt)}</strong></span>
            <span>Indítva: <strong className="text-slate-200">{report.triggeredBy}</strong></span>
            <span>Találatok: <strong className="text-yellow-300">{report.findings.length}</strong></span>
            <span>Javaslatok: <strong className="text-blue-300">{report.suggestions.length}</strong></span>
            <span>Dry-run: <strong className="text-green-300">{report.dryRun ? 'igen' : 'nem'}</strong></span>
          </div>

          {/* Track Summary */}
          <div className="rounded-md bg-slate-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium">Conductor track állapot</span>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-slate-400">
                Összes: <strong className="text-slate-200">{report.trackSummary.total}</strong>
              </span>
              <span className="text-slate-400">
                Egészséges: <strong className="text-green-300">{report.trackSummary.healthy}</strong>
              </span>
              {report.trackSummary.missingSpec.length > 0 && (
                <span className="text-slate-400">
                  Hiányzó spec: <strong className="text-yellow-300">{report.trackSummary.missingSpec.length}</strong>
                </span>
              )}
              {report.trackSummary.missingPlan.length > 0 && (
                <span className="text-slate-400">
                  Hiányzó plan: <strong className="text-yellow-300">{report.trackSummary.missingPlan.length}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Findings */}
          {report.findings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-green-900/30 border border-green-700 p-3 text-sm text-green-300">
              <CheckCircle className="h-4 w-4" />
              Nincs találat – a repository tiszta!
            </div>
          ) : (
            <div className="rounded-md bg-slate-800 p-3">
              <h3 className="text-sm font-medium mb-2 text-slate-300">
                Találatok ({report.findings.length})
              </h3>
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {report.findings.map((f, i) => (
                  <FindingItem key={i} finding={f} />
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {report.suggestions.length > 0 && (
            <div className="rounded-md bg-slate-800 p-3">
              <h3 className="text-sm font-medium mb-2 text-slate-300">
                Javaslatok ({report.suggestions.length})
              </h3>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {report.suggestions.map((s, i) => (
                  <SuggestionItem key={i} suggestion={s} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProjectMaintainerPanel;
