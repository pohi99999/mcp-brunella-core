/**
 * System Architecture Status Route
 * Track: bas_orchestration_chain_20260221 / Phase 3
 *
 * GET /api/v1/system/architecture-status
 * A 4 réteg (Ingestion, Knowledge, Orchestration, Security) valós idejű metrikái.
 */

import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { getRAGCount } from '../../utils/rag.js';
import { logInfo, logError } from '../../utils/logger.js';

export function createSystemArchitectureRouter(): Router {
  const router = Router();

  router.get(
    '/architecture-status',
    asyncHandler(async (_req, res) => {
      logInfo('SystemArchitecture', 'Architecture status lekérdezése...');

      // ── Orchestration réteg ──────────────────────────────────────────────
      const agents = agentManager.listAgents();
      const activeAgents = agents.filter(a => a.status === 'working').length;
      const idleAgents = agents.filter(a => a.status === 'idle').length;

      // ── Knowledge réteg (SQLite task queue) ──────────────────────────────
      let sqliteTasksPending = 0;
      let sqliteTasksDone = 0;
      let sqliteTasksFailed = 0;
      try {
        const db = getGlobalDb();
        const pending = db
          .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'")
          .get() as { count: number } | undefined;
        const done = db
          .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'")
          .get() as { count: number } | undefined;
        const failed = db
          .prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'failed'")
          .get() as { count: number } | undefined;
        sqliteTasksPending = pending?.count ?? 0;
        sqliteTasksDone = done?.count ?? 0;
        sqliteTasksFailed = failed?.count ?? 0;
      } catch (e) {
        logError('SystemArchitecture', `SQLite lekérdezés hiba: ${e}`);
      }

      // ── Ingestion réteg (LanceDB RAG) ────────────────────────────────────
      let lancedbRows = 0;
      try {
        lancedbRows = await getRAGCount();
      } catch (e) {
        logError('SystemArchitecture', `LanceDB count hiba: ${e}`);
      }

      // ── Security réteg (E2B + Guardrails + Golden Dataset) ───────────────
      const sandboxEnabled = process.env.E2B_ENABLED === 'true';
      const guardrailsEnabled = process.env.GUARDRAILS_ENABLED === 'true';
      let goldenSamples = 0;
      try {
        const db = getGlobalDb();
        const gs = db
          .prepare('SELECT COUNT(*) as count FROM golden_samples')
          .get() as { count: number } | undefined;
        goldenSamples = gs?.count ?? 0;
      } catch {
        // golden_samples tábla csak D1-ben van — helyi fallback: 0
      }

      const payload = {
        timestamp: new Date().toISOString(),
        ingestion: {
          lancedbRows,
          status: lancedbRows > 0 ? 'healthy' : 'empty',
        },
        knowledge: {
          sqliteTasksPending,
          sqliteTasksDone,
          sqliteTasksFailed,
          status: sqliteTasksFailed > sqliteTasksDone * 0.2 ? 'degraded' : 'healthy',
        },
        orchestration: {
          totalAgents: agents.length,
          activeAgents,
          idleAgents,
          chainEnabled: true,
          status: agents.length > 0 ? 'healthy' : 'degraded',
        },
        security: {
          sandboxEnabled,
          guardrailsEnabled,
          goldenSamples,
          status: sandboxEnabled ? 'hardened' : 'basic',
        },
      };

      logInfo('SystemArchitecture', `Status kész: ${agents.length} agent, ${lancedbRows} RAG sor`);
      res.json(payload);
    }),
  );

  return router;
}
