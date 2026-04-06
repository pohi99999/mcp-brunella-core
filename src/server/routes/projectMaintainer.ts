/**
 * @fileoverview Project Maintainer API routes.
 *
 * Exposes three endpoints:
 *  GET  /api/v1/project-maintainer/reports         — list the 10 most recent reports
 *  GET  /api/v1/project-maintainer/reports/latest  — most recent single report
 *  POST /api/v1/project-maintainer/run             — on-demand dry-run scan
 */

import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import { ReflectionEngine } from '../../core/reflectionEngine.js';
import { logError, logInfo } from '../../utils/logger.js';
import { runProjectMaintainerReport } from '../services/projectMaintainerService.js';

interface ReportRow {
  id: string;
  generated_at: string;
  findings_count: number;
  suggestions_count: number;
  report_json: string;
  triggered_by: string;
  created_at: string;
}

/**
 * Creates and returns the Project Maintainer Express router.
 * @param db - SQLite database instance (injected for testability)
 */
export function createProjectMaintainerRoutes(db: Database.Database): Router {
  const router = Router();

  /**
   * GET /api/v1/project-maintainer/reports
   * Returns up to 10 most recent reports (metadata + parsed JSON).
   */
  router.get('/reports', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT id, generated_at, findings_count, suggestions_count,
               report_json, triggered_by, created_at
        FROM project_maintainer_reports
        ORDER BY generated_at DESC
        LIMIT 10
      `).all() as ReportRow[];

      const reports = rows.map((row) => ({
        id: row.id,
        generatedAt: row.generated_at,
        findingsCount: row.findings_count,
        suggestionsCount: row.suggestions_count,
        triggeredBy: row.triggered_by,
        createdAt: row.created_at,
        report: JSON.parse(row.report_json) as unknown,
      }));

      logInfo('ProjectMaintainerRoute', `Listed ${reports.length} reports`);
      res.json({ reports, total: reports.length });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ProjectMaintainerRoute', `Failed to list reports: ${msg}`);
      res.status(500).json({ error: 'Nem sikerült a riportok lekérése' });
    }
  });

  /**
   * GET /api/v1/project-maintainer/reports/latest
   * Returns the single most recent report.
   */
  router.get('/reports/latest', (_req: Request, res: Response) => {
    try {
      const row = db.prepare(`
        SELECT id, generated_at, findings_count, suggestions_count,
               report_json, triggered_by, created_at
        FROM project_maintainer_reports
        ORDER BY generated_at DESC
        LIMIT 1
      `).get() as ReportRow | undefined;

      if (!row) {
        return res.status(404).json({ error: 'Még nincs riport. Futtasd a scannert először.' });
      }

      const report = {
        id: row.id,
        generatedAt: row.generated_at,
        findingsCount: row.findings_count,
        suggestionsCount: row.suggestions_count,
        triggeredBy: row.triggered_by,
        createdAt: row.created_at,
        report: JSON.parse(row.report_json) as unknown,
      };

      res.json(report);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ProjectMaintainerRoute', `Failed to get latest report: ${msg}`);
      res.status(500).json({ error: 'Nem sikerült a legutóbbi riport lekérése' });
    }
  });

  /**
   * POST /api/v1/project-maintainer/run
   * Triggers an on-demand report scan and returns the result immediately.
   * supports { "dryRun": false } for active maintenance.
   */
  router.post('/run', async (req: Request, res: Response) => {
    try {
      const bodyStr = JSON.stringify(req.body);
      logInfo('ProjectMaintainerRoute', `On-demand scan triggered via API. Body: ${bodyStr}`);

      // Check if body is empty object (often happens if json parser is skipped or fails)
      if (Object.keys(req.body).length === 0 && req.headers['content-type']?.includes('application/json')) {
        logError('ProjectMaintainerRoute', 'WARNING: Received empty body but content-type was JSON. Possible middleware skip?');
      }

      // Robust boolean check: must be explicitly false (boolean) or "false" (string) to disable dryRun
      const dryRun = req.body.dryRun !== false && String(req.body.dryRun).toLowerCase() !== 'false';
      logInfo('ProjectMaintainerRoute', `DryRun decided: ${dryRun} (from raw: ${JSON.stringify(req.body)})`);

      const report = await runProjectMaintainerReport({
        triggeredBy: 'manual',
        dryRun,
        db,
      });
      ReflectionEngine.getInstance().ingestProjectMaintainerReport(report);

      res.json({
        success: true,
        message: 'Riport sikeresen elkészült',
        report,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ProjectMaintainerRoute', `On-demand scan failed: ${msg}`);
      res.status(500).json({ error: 'A scan nem sikerült' });
    }
  });

  return router;
}

export default createProjectMaintainerRoutes;
