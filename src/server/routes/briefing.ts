/**
 * @fileoverview Briefing API routes — /briefing
 *
 * Endpoints:
 *   GET  /briefing/reports         — List the 10 most recent briefing reports
 *   GET  /briefing/reports/latest  — Return the most recent single report (404 if none)
 *   POST /briefing/run             — Trigger an on-demand briefing run
 *
 * Follows the same factory-function pattern as `projectMaintainer.ts`.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type Database from 'better-sqlite3';
import {
  initBriefingSchema,
  runDailyAgentBriefing,
  type BriefingReport,
} from '../services/briefingService.js';
import { logError, logInfo } from '../../utils/logger.js';

// ── Module constant ───────────────────────────────────────────────────────────
const MODULE = 'BriefingRoutes';

// ── Database helpers ──────────────────────────────────────────────────────────

/** Row shape returned by `SELECT * FROM ai_agent_briefing_reports` */
interface BriefingReportRow {
  id: string;
  generated_at: string;
  report_date: string;
  items_count: number;
  brunella_layers_count: number;
  report_json: string;
  triggered_by: string;
  created_at: string;
}

/** Enriched summary row for list endpoint responses */
interface BriefingReportSummary {
  id: string;
  generatedAt: string;
  reportDate: string;
  itemsCount: number;
  brunellaLayersCount: number;
  triggeredBy: string;
}

/**
 * Map a DB row to the summary shape (omits the heavy JSON payload).
 */
function rowToSummary(row: BriefingReportRow): BriefingReportSummary {
  return {
    id: row.id,
    generatedAt: row.generated_at,
    reportDate: row.report_date,
    itemsCount: row.items_count,
    brunellaLayersCount: row.brunella_layers_count,
    triggeredBy: row.triggered_by,
  };
}

/**
 * Map a DB row to the full BriefingReport by parsing `report_json`.
 */
function rowToReport(row: BriefingReportRow): BriefingReport {
  return JSON.parse(row.report_json) as BriefingReport;
}

// ── Route factory ─────────────────────────────────────────────────────────────

/**
 * Creates an Express Router for the `/briefing` mount point.
 *
 * @param db - SQLite database instance injected by the parent router
 * @returns Express Router
 */
export function createBriefingRoutes(db: Database.Database): Router {
  // Ensure schema is present when the router is first loaded
  initBriefingSchema(db);

  const router = Router();

  // ── GET /briefing/reports ──────────────────────────────────────────────────
  /**
   * List the 10 most recent briefing report summaries.
   * Returns an empty array if no reports have been generated yet.
   */
  router.get('/reports', (_req: Request, res: Response) => {
    try {
      const rows = db
        .prepare(
          `SELECT * FROM ai_agent_briefing_reports
           ORDER BY generated_at DESC
           LIMIT 10`,
        )
        .all() as BriefingReportRow[];

      res.json({ reports: rows.map(rowToSummary) });
    } catch (error: unknown) {
      logError(MODULE, `GET /reports failed: ${error}`);
      res.status(500).json({
        error: 'Nem sikerült lekérni a briefing riportokat',
        details: String(error),
      });
    }
  });

  // ── GET /briefing/reports/latest ───────────────────────────────────────────
  /**
   * Return the most recent complete BriefingReport.
   * Responds with 404 if no report has been generated yet.
   */
  router.get('/reports/latest', (_req: Request, res: Response) => {
    try {
      const row = db
        .prepare(
          `SELECT * FROM ai_agent_briefing_reports
           ORDER BY generated_at DESC
           LIMIT 1`,
        )
        .get() as BriefingReportRow | undefined;

      if (!row) {
        res.status(404).json({ error: 'Még nem készült briefing riport' });
        return;
      }

      const report = rowToReport(row);
      const summary = rowToSummary(row);

      res.json({ ...summary, report });
    } catch (error: unknown) {
      logError(MODULE, `GET /reports/latest failed: ${error}`);
      res.status(500).json({
        error: 'Nem sikerült lekérni a legutóbbi briefing riportot',
        details: String(error),
      });
    }
  });

  // ── POST /briefing/run ─────────────────────────────────────────────────────
  /**
   * Trigger an on-demand briefing run.
   *
   * Body parameters (all optional):
   * - `dryRun` {boolean | 'true' | 'false' | '1' | '0'} — do not persist result
   */
  router.post('/run', async (req: Request, res: Response): Promise<void> => {
    // Parse dryRun robustly — accept boolean, string truthy, numeric 1/0
    const rawDryRun = req.body?.dryRun;
    const dryRun =
      rawDryRun === true ||
      rawDryRun === 'true' ||
      rawDryRun === '1' ||
      rawDryRun === 1;

    logInfo(MODULE, `POST /run triggered (dryRun=${dryRun})`);

    try {
      const report = await runDailyAgentBriefing({
        triggeredBy: 'api',
        dryRun,
        db,
      });

      res.json({
        success: true,
        message: `Napi AI agent összefoglaló elkészült: ${report.reportDate}`,
        report,
      });
    } catch (error: unknown) {
      logError(MODULE, `POST /run failed: ${error}`);
      res.status(500).json({
        error: 'A briefing futtatás sikertelen',
        details: String(error),
      });
    }
  });

  return router;
}
