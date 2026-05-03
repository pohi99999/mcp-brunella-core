import { Router } from 'express';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError, logInfo } from '@packages/utils/logger.js';
import { kkvCrmService } from '@packages/core-logic/services/kkvCrmService.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePayload(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === 'string' ? entry.trim() : entry,
    ]),
  );
}

function normalizeLeadBody(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {
    ...value,
  };

  if (typeof normalized.source === 'string') {
    normalized.source = normalized.source.trim();
  }

  if (typeof normalized.workflowId === 'string') {
    normalized.workflowId = normalized.workflowId.trim();
  }

  if (isRecord(normalized.metadata)) {
    normalized.metadata = Object.fromEntries(
      Object.entries(normalized.metadata).map(([key, entry]) => [
        key,
        typeof entry === 'string' ? entry.trim() : entry,
      ]),
    );
  }

  normalized.payload = normalizePayload(normalized.payload);
  return normalized;
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
      const normalizedBody = normalizeLeadBody(req.body);
      const workflowId = extractWorkflowId(normalizedBody, req.header('x-workflow-id') ?? undefined);
      const result = await kkvCrmService.createLead(normalizedBody, { workflowId });

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

