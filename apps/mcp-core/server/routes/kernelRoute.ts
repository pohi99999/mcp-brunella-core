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
import { logInfo, logError } from '@packages/utils/logger.js';
import { executeKernelPipeline } from '@packages/core-logic/conductor.js';
import { runLedger } from '@packages/core-logic/conductor.js';
import { createRunEnvelope } from '@packages/core-logic/kernelTypes.js';
import type { RunEnvelope } from '@packages/core-logic/kernelTypes.js';

const RISK_LEVELS = new Set<RunEnvelope['riskLevel']>(['low', 'medium', 'high']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalString(value: unknown): string | undefined {
  return readString(value) ?? undefined;
}

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

function toRiskLevel(value: unknown): RunEnvelope['riskLevel'] {
  if (typeof value === 'string' && RISK_LEVELS.has(value as RunEnvelope['riskLevel'])) {
    return value as RunEnvelope['riskLevel'];
  }

  return 'low';
}

function readApprovalRequired(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

export function createKernelRoutes(): Router {
  const router = Router();

  // ── POST /kernel/run ──────────────────────────────────────────────────────
  router.post('/run', async (req: Request, res: Response) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
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
      } = body;

      const trimmedGoal = readString(goal);
      if (!trimmedGoal) {
        return res.status(400).json({ error: 'goal is required (string)' });
      }

      const envelope = createRunEnvelope(trimmedGoal, {
          taskType: readString(taskType) ?? 'general',
          riskLevel: toRiskLevel(riskLevel),
          priority: toPriority(priority),
          threadId: readOptionalString(threadId),
          tenantId: readOptionalString(tenantId),
          projectId: readOptionalString(projectId),
          userContext: {
            userId: readString(userId) ?? 'anonymous',
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
            approvalRequired: readApprovalRequired(approvalRequired),
          },
        inputPayload: {},
      });

      logInfo('KernelRoute', `POST /kernel/run ${envelope.runId}: "${trimmedGoal.slice(0, 80)}"`);

      const result = await executeKernelPipeline(envelope, {
        terminationCondition: readOptionalString(terminationCondition),
      });

      return res.status(result.status === 'error' ? 500 : 200).json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('KernelRoute', `POST /kernel/run error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  // ── GET /kernel/runs ──────────────────────────────────────────────────────
  router.get('/runs', (_req: Request, res: Response) => {
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
  router.get('/runs/:runId', (req: Request, res: Response) => {
    const runId = String(req.params.runId);
    const record = runLedger.get(runId);
    if (!record) {
      return res.status(404).json({ error: `run_not_found: ${runId}` });
    }
    return res.json(record);
  });

  // ── GET /kernel/status ────────────────────────────────────────────────────
  router.get('/status', (_req: Request, res: Response) => {
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
