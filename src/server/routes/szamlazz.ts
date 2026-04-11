import { Router } from 'express';
import type { Request, Response } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';
import { sendSzamlazzInvoice } from '../szamlazzBridge.js';
import {
  readBookkeepingStatusSnapshot,
  writeBookkeepingStatusSnapshot,
} from './bookkeepingStatusSnapshot.js';
import type { BookkeepingStatusSnapshot } from './bookkeepingStatusSnapshot.js';

type SzamlazzRequestBody = Record<string, unknown>;

interface SzamlazzLastSend {
  success: boolean;
  statusCode?: number;
  contentType?: string;
  documentType?: 'pdf' | 'text';
  error?: string;
  requestId?: string;
  source: string;
  xmlLength: number;
  sentAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getXmlPayload(body: SzamlazzRequestBody): string | undefined {
  const payload = getString(body.xml) ?? getString(body.xmlPayload) ?? getString(body.invoiceXml);
  return payload;
}

function buildSnapshot(
  existing: BookkeepingStatusSnapshot | null,
  lastSend: SzamlazzLastSend,
  failureMessage?: string,
): BookkeepingStatusSnapshot {
  const now = new Date().toISOString();
  const previousSummary = existing?.summary ?? {};
  const previousExceptions = Array.isArray(existing?.exceptions) ? existing?.exceptions : [];

  const summary: Record<string, unknown> = {
    ...previousSummary,
    lastInvoiceSend: lastSend,
    ...(failureMessage ? { lastInvoiceSendError: failureMessage } : {}),
  };

  const exceptions = failureMessage
    ? [
        ...previousExceptions,
        {
          kind: 'szamlazz_invoice_send_failed',
          message: failureMessage,
          requestId: lastSend.requestId ?? null,
          source: lastSend.source,
          sentAt: now,
        },
      ]
    : previousExceptions;

  return {
    summary,
    exceptions,
    timestamp: now,
    updatedAt: now,
    source: 'api',
  };
}

export function createSzamlazzRoutes(): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    try {
      const snapshot = await readBookkeepingStatusSnapshot();
      res.json({
        success: true,
        snapshot,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = ensureError(error).message;
      logError('SzamlazzRoutes', `Failed to read Számlázz status: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  });

  const handleSend = async (req: any, res: any) => {
    try {
      const body = req.body;
      if (!isRecord(body)) {
        res.status(400).json({ success: false, error: 'Request body must be an object' });
        return;
      }

      const xml = getXmlPayload(body);
      if (!xml) {
        res.status(400).json({ success: false, error: 'xml, xmlPayload or invoiceXml is required' });
        return;
      }

      const requestId = getString(body.requestId);
      const source = getString(body.source) || 'api';
      let existingSnapshot: BookkeepingStatusSnapshot | null = null;

      try {
        existingSnapshot = await readBookkeepingStatusSnapshot();
      } catch (error: unknown) {
        const message = ensureError(error).message;
        logError('SzamlazzRoutes', `Failed to load bookkeeping snapshot: ${message}`);
        res.status(500).json({ success: false, error: message });
        return;
      }

      try {
        const result = await sendSzamlazzInvoice(xml);
        const snapshot = buildSnapshot(existingSnapshot, {
          success: result.success,
          statusCode: result.statusCode,
          contentType: result.contentType,
          documentType: result.documentType,
          requestId,
          source,
          xmlLength: xml.length,
          sentAt: new Date().toISOString(),
        }, result.success ? undefined : result.error || 'Számlázz küldés sikertelen');

        await writeBookkeepingStatusSnapshot(snapshot);

        if (result.success) {
          logInfo('SzamlazzRoutes', `Számlázz számla elküldve${requestId ? ` (${requestId})` : ''}`);
          res.json({ success: true, result, snapshot });
          return;
        }

        logError('SzamlazzRoutes', `Számlázz számla küldés sikertelen${requestId ? ` (${requestId})` : ''}: ${result.error || 'unknown error'}`);
        res.status(502).json({
          success: false,
          error: result.error || 'Számlázz küldés sikertelen',
          result,
          snapshot,
        });
      } catch (error: unknown) {
        const message = ensureError(error).message;
        const snapshot = buildSnapshot(existingSnapshot, {
          success: false,
          error: message,
          requestId,
          source,
          xmlLength: xml.length,
          sentAt: new Date().toISOString(),
        }, message);

        await writeBookkeepingStatusSnapshot(snapshot);
        logError('SzamlazzRoutes', `Számlázz számla küldés hibával megállt${requestId ? ` (${requestId})` : ''}: ${message}`);
        res.status(502).json({ success: false, error: message, snapshot });
      }
    } catch (error: unknown) {
      const message = ensureError(error).message;
      logError('SzamlazzRoutes', `Számlázz request invalid: ${message}`);
      res.status(400).json({ success: false, error: message });
    }
  };

  router.post('/create', handleSend);
  router.post('/send', handleSend);

  return router;
}
