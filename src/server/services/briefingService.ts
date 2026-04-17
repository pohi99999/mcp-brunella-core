/**
 * @fileoverview Daily Agent Briefing Service — Napi AI Agent Összefoglaló
 *
 * Provides:
 * - SQLite schema initialisation (`ai_agent_briefing_reports` table)
 * - Persistence helpers
 * - Public `runDailyAgentBriefing()` function invoked by the API route and scheduler
 *
 * Follows the same patterns as `projectMaintainerService.ts`.
 */

import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logError, logInfo } from '../../utils/logger.js';
import { ensureError } from '../../utils/ensureError.js';
import { DailyAgentBriefingAgent } from '../../agents/DailyAgentBriefingAgent.js';

// ── Public types ──────────────────────────────────────────────────────────────

/** A single AI agent news item extracted from the briefing */
export interface BriefingItem {
  /** Report section title or repository/article name */
  title: string;
  /** Source identifier (e.g. 'GitHub', 'LangChain Blog') */
  source: string;
  /** Short excerpt shown in the dashboard */
  excerpt: string;
  /** Short human-readable relevance note */
  relevance: string;
  /** Brunella architecture layers this item maps to */
  brunellaLayers: string[];
  /** Optional adoption decision for Brunella */
  adoptionStatus?: 'adopt' | 'prototype' | 'watch';
  /** Short rationale for the adoption decision */
  adoptionNote?: string;
  /** Optional canonical URL */
  url?: string;
  /** Optional publication timestamp */
  publishedAt?: string;
  /** Backwards-compatible single layer alias */
  brunellaLayer?: string;
}

/** Full output of one Daily Agent Briefing run */
export interface BriefingReport {
  id: string;
  generatedAt: string;
  triggeredBy: string;
  reportDate: string;
  items: BriefingItem[];
  /** Raw markdown content of the briefing */
  markdownPath: string;
  /** Whether an LLM was used for synthesis */
  usedLLM: boolean;
  dryRun: boolean;
}

// ── Schema ────────────────────────────────────────────────────────────────────

/**
 * Ensures the `ai_agent_briefing_reports` table exists.
 * Safe to call multiple times — uses `CREATE TABLE IF NOT EXISTS`.
 *
 * @param db - SQLite database instance
 */
export function initBriefingSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_agent_briefing_reports (
      id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      report_date TEXT NOT NULL,
      items_count INTEGER NOT NULL DEFAULT 0,
      brunella_layers_count INTEGER NOT NULL DEFAULT 0,
      report_json TEXT NOT NULL,
      triggered_by TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_briefing_reports_generated_at
      ON ai_agent_briefing_reports(generated_at);

    CREATE INDEX IF NOT EXISTS idx_briefing_reports_report_date
      ON ai_agent_briefing_reports(report_date);
  `);
}

// ── Private helpers ───────────────────────────────────────────────────────────

const MODULE = 'BriefingService';

function getItemLayers(item: BriefingItem): string[] {
  if (Array.isArray(item.brunellaLayers) && item.brunellaLayers.length > 0) {
    return item.brunellaLayers;
  }

  if (typeof item.brunellaLayer === 'string' && item.brunellaLayer.trim()) {
    return [item.brunellaLayer.trim()];
  }

  return [];
}

/**
 * Persists a BriefingReport to the database.
 * Throws if the database write fails.
 *
 * @param db - SQLite database instance
 * @param report - Fully populated BriefingReport
 */
export function persistBriefingReport(
  db: Database.Database,
  report: BriefingReport,
): void {
  try {
    const layerCount = new Set(report.items.flatMap(getItemLayers)).size;

    db.prepare(`
      INSERT INTO ai_agent_briefing_reports
        (id, generated_at, report_date, items_count, brunella_layers_count, report_json, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.generatedAt,
      report.reportDate,
      report.items.length,
      layerCount,
      JSON.stringify(report),
      report.triggeredBy,
    );

    logInfo(
      MODULE,
      `Briefing persisted: ${report.items.length} items, ${layerCount} Brunella layers, date=${report.reportDate}`,
    );
  } catch (error: unknown) {
    const err = ensureError(error);
    logError(MODULE, `Failed to persist briefing report: ${err.message}`);
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs the Daily Agent Briefing pipeline and persists the result.
 *
 * In dry-run mode the agent still executes (it only reads data), but the
 * result is NOT persisted to the database. This is useful for testing.
 *
 * @param options.triggeredBy - Who initiated this run ('scheduler' | 'api' | 'cli' | 'manual')
 * @param options.dryRun - When true the report is not persisted (default false)
 * @param options.db - Optional injected DB for testing
 * @returns Fully populated BriefingReport
 */
export async function runDailyAgentBriefing(options: {
  triggeredBy?: string;
  dryRun?: boolean;
  db?: Database.Database;
} = {}): Promise<BriefingReport> {
  const { triggeredBy = 'api', dryRun = false } = options;
  const db = options.db ?? getGlobalDb();

  logInfo(MODULE, `🤖 Napi AI Agent Összefoglaló indítása (triggeredBy=${triggeredBy}, dryRun=${dryRun})`);

  // Directly instantiate and execute the agent
  const agent = new DailyAgentBriefingAgent();

  const agentResult = await agent.executeTask({
    prompt: 'Napi AI agent összefoglaló generálása',
    context: {
      triggeredBy,
    },
  });

  if (!agentResult.success) {
    throw new Error(`Az agent futtatás sikertelen: ${agentResult.message}`);
  }

  // Extract data fields from agent result
  const resultData = (agentResult.data ?? {}) as {
    reportPath?: string;
    reportDate?: string;
    githubSignalsCount?: number;
    pageSignalsCount?: number;
    briefingItemsCount?: number;
    items?: BriefingItem[];
    usedLLM?: boolean;
  };

  const reportDate = resultData.reportDate ?? new Date().toISOString().split('T')[0];
  const markdownPath = resultData.reportPath ?? '';
  const usedLLM = resultData.usedLLM ?? false;
  const items = Array.isArray(resultData.items) ? resultData.items : [];

  const report: BriefingReport = {
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    triggeredBy,
    reportDate,
    items,
    markdownPath,
    usedLLM,
    dryRun,
  };

  if (!dryRun) {
    persistBriefingReport(db, report);
  } else {
    logInfo(MODULE, 'Dry-run mód: a riport NEM kerül az adatbázisba');
  }

  logInfo(MODULE, `✅ Napi összefoglaló kész: ${reportDate}`);
  return report;
}
