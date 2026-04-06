/**
 * Copilot Orchestrator API Routes
 *
 * REST surface for the GitHub Copilot CLI model-agnostic orchestrator.
 * The Copilot CLI `.github/agents/copilot-cli-orchestrator.agent.md` pushes
 * step logs here; the `CopilotOrchestratorPanel` dashboard component reads them.
 *
 * Mounted at: /api/v1/copilot-orchestrator
 */

import { Router, Request, Response } from 'express';
import {
  copilotOrchestratorBridge,
  OrchestratorStepStatus,
} from '../../core/copilotOrchestratorBridge.js';
import { logInfo, logError } from '../../utils/logger.js';

const TAG = 'CopilotOrchestratorRoute';

export function createCopilotOrchestratorRoutes(): Router {
  const router = Router();

  // ── GET /stats ── Aggregate statistics for dashboard header ──────
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      res.json(copilotOrchestratorBridge.getStats());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Stats error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /steps ── Recent orchestration steps (flat timeline) ─────
  router.get('/steps', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(copilotOrchestratorBridge.getRecentSteps(limit));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Steps list error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /sessions/:id ── Single session detail ───────────────────
  router.get('/sessions/:id', (req: Request, res: Response) => {
    try {
      const session = copilotOrchestratorBridge.getSession(String(req.params.id));
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Session detail error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /sessions ── Start a new orchestration session ─────────
  router.post('/sessions', (_req: Request, res: Response) => {
    try {
      const session = copilotOrchestratorBridge.startSession();
      logInfo(TAG, `New session: ${session.id}`);
      res.status(201).json(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Start session error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── PATCH /sessions/:id ── Complete or fail a session ───────────
  router.patch('/sessions/:id', (req: Request, res: Response) => {
    try {
      const { status, summary } = req.body as {
        status?: 'completed' | 'failed';
        summary?: string;
      };

      let session = null;
      if (status === 'completed') {
        session = copilotOrchestratorBridge.completeSession(String(req.params.id), summary);
      } else if (status === 'failed') {
        session = copilotOrchestratorBridge.failSession(String(req.params.id), summary);
      } else {
        res.status(400).json({ error: 'status must be "completed" or "failed"' });
        return;
      }

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Update session error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /log ── Log a single orchestration step ─────────────────
  // This is the main endpoint called by the Copilot CLI agent.
  router.post('/log', (req: Request, res: Response) => {
    try {
      const { sessionId, step, status, detail, delegateTo, confidence, model } = req.body as {
        sessionId?: string;
        step?: string;
        status?: OrchestratorStepStatus;
        detail?: string;
        delegateTo?: string;
        confidence?: number;
        model?: string;
      };

      if (!step) {
        res.status(400).json({ error: '"step" is required' });
        return;
      }

      const stepObj = copilotOrchestratorBridge.addStep({
        sessionId,
        step,
        status,
        detail,
        delegateTo,
        confidence,
        model,
      });

      logInfo(TAG, `Step logged: ${step} (${status ?? 'running'})`);
      res.status(201).json(stepObj);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Log step error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // ── PATCH /steps/:sessionId/:stepId ── Update existing step ─────
  router.patch('/steps/:sessionId/:stepId', (req: Request, res: Response) => {
    try {
      const { status, detail, model } = req.body as {
        status?: OrchestratorStepStatus;
        detail?: string;
        model?: string;
      };

      const step = copilotOrchestratorBridge.updateStep(
        String(req.params.sessionId),
        String(req.params.stepId),
        { status, detail, model, completedAt: status && status !== 'running' ? Date.now() : undefined },
      );

      if (!step) {
        res.status(404).json({ error: 'Step not found' });
        return;
      }

      res.json(step);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Update step error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
