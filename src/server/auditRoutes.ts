/**
 * Gold Protocol G6: Audit API Routes
 *
 * RULE-UI4: Routes in separate *Routes.ts files (clean separation)
 *
 * Endpoints:
 *   GET /api/audit/log    → AuditEntry[] (paginated)
 *   GET /api/audit/denied → AuditEntry[] (denied only)
 *   GET /api/audit/stats  → Audit statistics
 */

import { Router } from 'express';
import { getAuditLog, getDeniedEntries, getAuditStats, cleanupOldEntries } from '../core/auditLog.js';
import { ensureError } from '../utils/ensureError.js';

export function createAuditRouter(): Router {
  const router = Router();

  /**
   * GET /api/audit/log
   * Paginated audit log (newest first)
   */
  router.get('/log', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const entries = await getAuditLog(limit, offset);
      res.json({ entries, limit, offset });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/audit/denied
   * Only denied entries (newest first)
   */
  router.get('/denied', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const entries = await getDeniedEntries(limit);
      res.json({ entries });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/audit/stats
   * Audit statistics (totals, by agent)
   */
  router.get('/stats', async (_req, res) => {
    try {
      const stats = await getAuditStats();
      res.json(stats);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/audit/cleanup
   * Manual trigger for retention cleanup
   */
  router.post('/cleanup', async (req, res) => {
    try {
      const days = parseInt(req.body?.retentionDays as string) || 30;
      const removed = await cleanupOldEntries(days);
      res.json({ removed, retentionDays: days });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
