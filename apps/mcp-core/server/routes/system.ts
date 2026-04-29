/**
 * System Architecture Status Route
 * Track: bas_orchestration_chain_20260221 / Phase 3
 *
 * GET /api/v1/system/architecture-status
 * A 4 réteg (Ingestion, Knowledge, Orchestration, Security) valós idejű metrikái.
 *
 * GET /api/system/status → ServiceControlWidget
 * POST /api/system/start-service → Szolgáltatás indítása
 * POST /api/system/stop-service → Szolgáltatás leállítása
 */

import { Router } from 'express';
import { exec } from 'child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { agentManager } from '@packages/agents/AgentManager.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getGlobalDb } from '@packages/utils/globalDb.js';
import { getRAGCount } from '@packages/utils/rag.js';
import { logInfo, logError, logDebug } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import {
  checkOllamaHealth,
  checkAnythingLLMHealth,
  checkPythonHealth,
  checkN8nHealth,
  checkLangflowHealth,
} from '@packages/utils/health.js';

/**
 * Segédfüggvény: shell parancs végrehajtása Promise-ként
 */
function execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(error.message));
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * ServiceControlWidget végpontjai:
 * GET  /status          → online/offline állapot minden szolgáltatáshoz
 * POST /start-service   → szolgáltatás indítása
 * POST /stop-service    → szolgáltatás leállítása
 */
export function createSystemControlRouter(): Router {
  const router = Router();

  // GET /api/system/status
  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      const [ollama, python, anythingllm, n8n, langflow] = await Promise.allSettled([
        checkOllamaHealth(),
        checkPythonHealth(),
        checkAnythingLLMHealth(),
        checkN8nHealth(),
        checkLangflowHealth(),
      ]);

      const toStatus = (r: PromiseSettledResult<{ status: string }>) => {
        if (r.status === 'rejected') return 'offline';
        return r.value.status === 'healthy' ? 'online' : 'offline';
      };

      const services = [
        {
          id: 'ollama',
          status: toStatus(ollama),
          lastCheck: new Date().toISOString(),
          error: ollama.status === 'rejected' ? String(ollama.reason) : undefined,
        },
        {
          id: 'python',
          status: toStatus(python),
          lastCheck: new Date().toISOString(),
          error: python.status === 'rejected' ? String(python.reason) : undefined,
        },
        {
          id: 'anythingllm',
          status: toStatus(anythingllm),
          lastCheck: new Date().toISOString(),
          error: anythingllm.status === 'rejected' ? String(anythingllm.reason) : undefined,
        },
        {
          id: 'n8n',
          status: toStatus(n8n),
          lastCheck: new Date().toISOString(),
          error: n8n.status === 'rejected' ? String(n8n.reason) : undefined,
        },
        {
          id: 'langflow',
          status: toStatus(langflow),
          lastCheck: new Date().toISOString(),
          error: langflow.status === 'rejected' ? String(langflow.reason) : undefined,
        },
      ];

      res.json(services);
    }),
  );

  // POST /api/system/start-service
  router.post(
    '/start-service',
    asyncHandler(async (req, res) => {
      const { service } = req.body as { service?: string };
      if (!service) {
        res.status(400).json({ success: false, message: 'service mező kötelező' });
        return;
      }

      try {
        if (service === 'ollama') {
          const cmd = process.platform === 'win32' ? 'start /B ollama serve' : 'ollama serve &';
          await execAsync(cmd).catch((error: unknown) => {
            // background process – hiba várható ha már fut
            const normalized = ensureError(error);
            logDebug('SystemControl', `Ollama start skipped: ${normalized.message}`);
          });
          res.json({ success: true, message: 'Ollama elindult' });
        } else if (service === 'python') {
          const cmd = process.platform === 'win32'
            ? 'start /B uvicorn myai.server:app --port 8000'
            : 'uvicorn myai.server:app --port 8000 &';
          await execAsync(cmd).catch((error: unknown) => {
            const normalized = ensureError(error);
            logDebug('SystemControl', `Python start skipped: ${normalized.message}`);
          });
          res.json({ success: true, message: 'Python szerver elindult' });
        } else if (service === 'n8n') {
          // Derive the n8n directory relative to the project root so this
          // works on any machine regardless of drive letter / install path.
          const n8nPath = path.join(process.cwd(), 'files', 'vendors', 'n8nv2');
          const quotedN8nPath = `"${n8nPath}"`;
          logInfo('SystemControl', `n8n indítása itt: ${n8nPath}`);
          
          // Ellenőrizzük, kell-e npm install
          let hasNodeModules = false;
          try {
            await fs.access(path.join(n8nPath, 'node_modules'));
            hasNodeModules = true;
          } catch (error: unknown) {
            logDebug('SystemControl', `n8n node_modules hiányzik: ${ensureError(error).message}`);
          }
          if (!hasNodeModules) {
            logInfo('SystemControl', 'node_modules hiányzik, npm install futtatása...');
            const installCmd = process.platform === 'win32'
              ? `cd /d ${quotedN8nPath} && npm install`
              : `cd ${quotedN8nPath} && npm install`;
            await execAsync(installCmd);
          }

          const cmd = process.platform === 'win32'
            ? `cd /d ${quotedN8nPath} && start /B npm start`
            : `cd ${quotedN8nPath} && npm start &`;
          await execAsync(cmd);
          
          res.json({ success: true, message: 'n8n indítása elindult a háttérben' });
        } else if (service === 'langflow') {
          // Langflow indítása Docker-rel
          logInfo('SystemControl', 'Langflow indítása Docker-rel');
          const cmd = 'docker start langflow || docker run -d -p 7860:7860 --name langflow langflowai/langflow';
          await execAsync(cmd);
          
          res.json({ success: true, message: 'Langflow (Docker) elindult' });
        } else if (service === 'anythingllm') {
          res.json({ success: false, message: 'AnythingLLM Desktop app – indítsd el manuálisan' });
        } else {
          res.status(400).json({ success: false, message: `Ismeretlen szolgáltatás: ${service}` });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('SystemControl', `Start service hiba (${service}): ${msg}`);
        res.status(500).json({ success: false, message: msg });
      }
    }),
  );

  // POST /api/system/stop-service
  router.post(
    '/stop-service',
    asyncHandler(async (req, res) => {
      const { service } = req.body as { service?: string };
      if (!service) {
        res.status(400).json({ success: false, message: 'service mező kötelező' });
        return;
      }

      try {
        if (service === 'ollama') {
          const cmd = process.platform === 'win32'
            ? 'taskkill /F /IM ollama.exe'
            : 'pkill -f ollama';
          await execAsync(cmd);
          res.json({ success: true, message: 'Ollama leállt' });
        } else if (service === 'python') {
          const cmd = process.platform === 'win32'
            ? 'taskkill /F /FI "WINDOWTITLE eq uvicorn*" /T'
            : 'pkill -f uvicorn';
          await execAsync(cmd);
          res.json({ success: true, message: 'Python szerver leállt' });
        } else {
          res.status(400).json({ success: false, message: `Leállítás nem támogatott: ${service}` });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('SystemControl', `Stop service hiba (${service}): ${msg}`);
        res.status(500).json({ success: false, message: `Leállítás sikertelen: ${msg}` });
      }
    }),
  );

  return router;
}

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
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logError('SystemArchitecture', `SQLite lekérdezés hiba: ${normalized.message}`, normalized);
      }

      // ── Ingestion réteg (LanceDB RAG) ────────────────────────────────────
      let lancedbRows = 0;
      try {
        lancedbRows = await getRAGCount();
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logError('SystemArchitecture', `LanceDB count hiba: ${normalized.message}`, normalized);
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
      } catch (error: unknown) {
        logDebug('SystemArchitecture', `golden_samples fallback skipped: ${ensureError(error).message}`);
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
