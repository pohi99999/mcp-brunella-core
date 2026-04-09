/**
 * AIAgentBriefingPanel — Napi AI Agent Összefoglaló dashboard panel.
 *
 * Megjeleníti a legutóbbi napi AI agent ökoszisztéma összefoglalót:
 * - Brunella architektúra réteg leképezések
 * - Forrás cikkek / GitHub eredmények listája
 * - Riport metaadatok (dátum, trigger, cikk-szám)
 * - Manuális futtatás gomb
 *
 * Modellezve a ProjectMaintainerPanel.tsx alapján.
 */

import React, { useEffect, useState } from 'react';
import { Brain, RefreshCw, ExternalLink, Info, CheckCircle, Layers } from 'lucide-react';
import {
  getLatestBriefingReport,
  runBriefingReport,
  type BriefingItem,
  type BriefingLatestReportResponse,
} from '@/lib/apiService';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Brunella architektúra rétegekhez szín-kód */
const LAYER_COLORS: Record<string, string> = {
  cortex: 'bg-violet-700 text-violet-100',
  memoria: 'bg-blue-700 text-blue-100',
  corpus: 'bg-emerald-700 text-emerald-100',
  nexus: 'bg-amber-700 text-amber-100',
  fabrica: 'bg-orange-700 text-orange-100',
  interface: 'bg-sky-700 text-sky-100',
  conductor: 'bg-rose-700 text-rose-100',
};

function layerBadge(layer: string): React.ReactNode {
  const cls = LAYER_COLORS[layer.toLowerCase()] ?? 'bg-slate-600 text-slate-100';
  return (
    <span key={layer} className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1 ${cls}`}>
      {layer}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('hu-HU');
  } catch {
    return iso;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BriefingItemCard({ item }: { item: BriefingItem }) {
  return (
    <li className="border border-slate-700 rounded-lg p-3 bg-slate-800/60 hover:bg-slate-800 transition-colors">
      {/* Title + link */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium text-slate-100 leading-snug">{item.title}</span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-slate-400 hover:text-sky-400 transition-colors"
            title="Megnyitás"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Source + date */}
      <p className="text-xs text-slate-500 mb-1.5">
        <span className="text-slate-400">{item.source}</span>
        {item.publishedAt && (
          <span className="ml-2">· {formatDate(item.publishedAt)}</span>
        )}
      </p>

      {/* Excerpt */}
      <p className="text-xs text-slate-300 line-clamp-3 mb-2">{item.excerpt}</p>

      {/* Relevance */}
      {item.relevance && (
        <p className="text-xs text-slate-400 italic mb-2">
          <Info className="inline h-3 w-3 mr-1 text-slate-500" />
          {item.relevance}
        </p>
      )}

      {/* Brunella layer badges */}
      {item.brunellaLayers && item.brunellaLayers.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {item.brunellaLayers.map((l) => layerBadge(l))}
        </div>
      )}
    </li>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs text-slate-200 font-medium">{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * AIAgentBriefingPanel
 *
 * Napi AI agent ökoszisztéma összefoglaló panel.
 * Betölti a legutóbbi riportot és lehetővé teszi manuális futtatást.
 */
export function AIAgentBriefingPanel() {
  const [report, setReport] = useState<BriefingLatestReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const data = await getLatestBriefingReport();
      setReport(data);
    } catch (err) {
      setError(`Nem sikerült betölteni a riportot: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  // ── Manual run ────────────────────────────────────────────────────────────

  async function handleRun() {
    setRunning(true);
    setRunMessage(null);
    setError(null);
    try {
      const result = await runBriefingReport(false);
      if (result.success) {
        setRunMessage(`✅ Összefoglaló elkészült (${result.reportDate ?? 'ismeretlen dátum'})`);
        await loadReport();
      } else {
        setError(`Futtatási hiba: ${result.error ?? 'ismeretlen hiba'}`);
      }
    } catch (err) {
      setError(`Futtatási hiba: ${String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-100">Napi AI Agent Összefoglaló</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadReport()}
            disabled={loading}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            title="Frissítés"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => void handleRun()}
            disabled={running || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-40 transition-colors"
          >
            {running ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {running ? 'Generálás...' : 'Futtatás most'}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {(error || runMessage) && (
        <div className={`px-4 py-2 text-xs border-b ${error ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-emerald-900/30 border-emerald-700 text-emerald-300'}`}>
          {error ?? runMessage}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && !report && (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Betöltés...
          </div>
        )}

        {!loading && !report && !error && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm gap-2">
            <Brain className="h-8 w-8 text-slate-600" />
            <span>Még nincs elérhető napi összefoglaló.</span>
            <span className="text-xs text-slate-600">Kattints a "Futtatás most" gombra az első riport generálásához.</span>
          </div>
        )}

        {report && (
          <>
            {/* Metadata card */}
            <section className="border border-slate-700 rounded-lg p-3 bg-slate-800/40">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                Riport metaadatok
              </div>
              <div className="space-y-0.5">
                <MetaRow label="Generálva" value={formatDate(report.generatedAt)} />
                <MetaRow label="Riport dátuma" value={report.reportDate} />
                <MetaRow label="Cikkek száma" value={`${report.itemsCount} forrás`} />
                <MetaRow
                  label="Brunella rétegek"
                  value={
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-violet-400" />
                      {report.brunellaLayersCount} réteg érintett
                    </span>
                  }
                />
                <MetaRow
                  label="Indítás módja"
                  value={
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                      {report.triggeredBy}
                    </span>
                  }
                />
              </div>
            </section>

            {/* Items list */}
            {report.report.items && report.report.items.length > 0 ? (
              <section>
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-violet-400" />
                  Összefoglalt cikkek / eredmények
                  <span className="ml-auto text-slate-500 font-normal normal-case">{report.report.items.length} elem</span>
                </h3>
                <ul className="space-y-2">
                  {report.report.items.map((item, idx) => (
                    <BriefingItemCard key={`${item.url ?? item.title}-${idx}`} item={item} />
                  ))}
                </ul>
              </section>
            ) : (
              <section className="border border-slate-700 rounded-lg p-4 bg-slate-800/30 text-center">
                <p className="text-sm text-slate-400">
                  A riport Markdown fájlban generálódott. Az elemzett tételek részletei a fájlban találhatók.
                </p>
                {report.report.markdownPath && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">{report.report.markdownPath}</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
