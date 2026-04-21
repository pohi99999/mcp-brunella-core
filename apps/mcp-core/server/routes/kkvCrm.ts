import { Router } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';
import { kkvCrmService } from '@packages/core-logic/kkvCrmService.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function extractWorkflowId(body: unknown, headerValue: string | undefined): string | undefined {
  const fromHeader = parseOptionalString(headerValue);
  if (fromHeader) {
    return fromHeader;
  }

  if (!isRecord(body)) {
    return undefined;
  }

  const metadata = body.metadata;
  if (!isRecord(metadata)) {
    return parseOptionalString(body.workflowId);
  }

  return parseOptionalString(metadata.workflowId) ?? parseOptionalString(body.workflowId);
}

export function createKkvCrmRoutes(): Router {
  const router = Router();

  router.post('/leads', async (req, res) => {
    try {
      const workflowId = extractWorkflowId(req.body, req.header('x-workflow-id') ?? undefined);
      const result = await kkvCrmService.createLead(req.body, { workflowId });

      if (!result.success) {
        return res.status(result.statusCode).json({
          ok: false,
          error: result.error,
        });
      }

      logInfo('KKVCRMRoute', `${result.eventType} lead ${result.lead.id}`);

      return res.status(result.inserted ? 201 : 200).json({
        ok: true,
        inserted: result.inserted,
        eventType: result.eventType,
        createdAt: result.createdAt,
        lead: result.lead,
        followUpCreated: result.followUpCreated,
        followUpPlan: result.followUpPlan,
        followUpActions: result.followUpActions,
        snapshot: result.snapshot,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('KKVCRMRoute', `POST /leads failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'kkv-crm/create-lead-failed',
      });
    }
  });

  router.get('/health', (_req, res) => {
    try {
      const snapshot = kkvCrmService.getStatus();
      return res.json({
        ok: true,
        status: 'healthy',
        ...snapshot,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('KKVCRMRoute', `GET /health failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'kkv-crm/health-failed',
      });
    }
  });

  router.get('/summary', (_req, res) => {
    try {
      const snapshot = kkvCrmService.getStatus();
      return res.json({
        ok: true,
        ...snapshot,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('KKVCRMRoute', `GET /summary failed: ${normalized.message}`);
      return res.status(500).json({
        ok: false,
        error: 'kkv-crm/summary-failed',
      });
    }
  });

  return router;
}

export default createKkvCrmRoutes;

