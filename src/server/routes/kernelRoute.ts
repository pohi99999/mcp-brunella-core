/**
 * kernelRoute.ts — REST API for the Brunella Kernel Pipeline
 *
 * Endpoints:
 *   POST /api/v1/kernel/run          — Start a full pipeline run
 *   GET  /api/v1/kernel/runs         — List recent run records
 *   GET  /api/v1/kernel/runs/:runId  — Get a specific run record
 *   GET  /api/v1/kernel/status       — Health summary
 */

import { Router, Request, Response } from 'express';
import { logInfo, logError } from '../../utils/logger.js';
import { executeKernelPipeline } from '../../core/conductor.js';
import { runLedger } from '../../core/conductor.js';
import { createRunEnvelope } from '../../core/kernelTypes.js';

function toKnowledgeScope(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function toPriority(value: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value;
  }

  if (value === 'normal') {
    return 'medium';
  }

  return 'medium';
}

export function createKernelRoutes(): Router {
  const router = Router();

  // ── POST /kernel/run ──────────────────────────────────────────────────────
  router.post('/run', async (req: any, res: any) => {
    try {
      const {
        goal,
        taskType,
        riskLevel,
        priority,
        threadId,
        tenantId,
        projectId,
        userId,
        capabilities,
        approvalRequired,
        terminationCondition,
      } = req.body as Record<string, unknown>;

      if (!goal || typeof goal !== 'string') {
        return res.status(400).json({ error: 'goal is required (string)' });
      }

      const envelope = createRunEnvelope(String(goal), {
          taskType: typeof taskType === 'string' ? taskType : 'general',
          riskLevel: (riskLevel as 'low' | 'medium' | 'high') ?? 'low',
          priority: toPriority(priority),
          threadId: (threadId as string) ?? undefined,
          tenantId: (tenantId as string) ?? undefined,
          projectId: (projectId as string) ?? undefined,
          userContext: {
            userId: (userId as string) ?? 'anonymous',
            locale: 'hu-HU',
            timezone: 'Europe/Budapest',
            preferences: {},
          },
          stateRefs: {
            shortTermStateId: null,
            memoryProfileId: null,
            knowledgeScope: toKnowledgeScope(capabilities),
          },
          constraints: {
            budgetTokens: 8192,
            latencyMs: 60_000,
            approvalRequired: (approvalRequired as boolean) ?? false,
          },
        inputPayload: {},
      });

      logInfo('KernelRoute', `POST /kernel/run ${envelope.runId}: "${goal.slice(0, 80)}"`);

      const result = await executeKernelPipeline(envelope, {
        terminationCondition: (terminationCondition as string) ?? undefined,
      });

      return res.status(result.status === 'error' ? 500 : 200).json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('KernelRoute', `POST /kernel/run error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  // ── GET /kernel/runs ──────────────────────────────────────────────────────
  router.get('/runs', (_req: any, res: any) => {
    try {
      const runs = runLedger.getAll().slice(-50).map((r) => ({
        runId: r.runId,
        goal: r.goal.slice(0, 80),
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        moduleCount: r.entries.length,
      }));
      return res.json({ runs });
    } catch (e: unknown) {
      return res.status(500).json({ error: String(e) });
    }
  });

  // ── GET /kernel/runs/:runId ───────────────────────────────────────────────
  router.get('/runs/:runId', (req: any, res: any) => {
    const runId = String(req.params.runId);
    const record = runLedger.get(runId);
    if (!record) {
      return res.status(404).json({ error: `run_not_found: ${runId}` });
    }
    return res.json(record);
  });

  // ── GET /kernel/status ────────────────────────────────────────────────────
  router.get('/status', (_req: any, res: any) => {
    const runs = runLedger.getAll();
    const running = runs.filter((r) => r.status === 'running').length;
    const succeeded = runs.filter((r) => r.status === 'success').length;
    const failed = runs.filter((r) => r.status === 'error').length;
    return res.json({
      status: 'ok',
      modules: ['conductor', 'intent_router', 'planner', 'context_builder', 'tool_executor', 'critic', 'guardrail', 'learning_loop'],
      runs: { total: runs.length, running, succeeded, failed },
    });
  });

  return router;
}
