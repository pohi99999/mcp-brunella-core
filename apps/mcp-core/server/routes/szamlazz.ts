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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

  const handleSend = async (req: Request, res: Response) => {
    try {
      const body = req.body as SzamlazzRequestBody;
      const xml = body.xml || body.xmlPayload || body.invoiceXml;

      if (typeof xml !== 'string' || !xml) {
        res.status(400).json({ success: false, error: 'xml is required' });
        return;
      }

      const requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
      const bodySource = typeof body.source === 'string' ? body.source : 'api';

      const result = await sendSzamlazzInvoice(xml);

      const existing = await readBookkeepingStatusSnapshot();
      const now = new Date().toISOString();
      const existingExceptions: unknown[] = existing?.exceptions || [];

      const lastInvoiceSend: Record<string, unknown> = {
        ...result,
        requestId,
        source: bodySource,
        xmlLength: xml.length,
      };

      if (!result.success) {
        const errorMsg = typeof result.error === 'string' ? result.error : 'invoice send failed';
        const snapshot: BookkeepingStatusSnapshot = {
          ...(existing || { source: 'api' as const }),
          summary: {
            ...(existing?.summary || {}),
            lastInvoiceSend,
            lastInvoiceSendError: errorMsg,
          },
          exceptions: [...existingExceptions, { kind: 'invoice_send_error', error: errorMsg, timestamp: now }],
          timestamp: now,
          updatedAt: now,
          source: 'api',
        };
        await writeBookkeepingStatusSnapshot(snapshot);
        res.status(502).json({ success: false, error: errorMsg, snapshot });
        return;
      }

      const snapshot: BookkeepingStatusSnapshot = {
        ...(existing || { source: 'api' as const }),
        summary: {
          ...(existing?.summary || {}),
          lastInvoiceSend,
        },
        exceptions: existingExceptions,
        timestamp: now,
        updatedAt: now,
        source: 'api',
      };
      await writeBookkeepingStatusSnapshot(snapshot);

      res.json({ success: true, result, snapshot });
    } catch (error: unknown) {
      const message = ensureError(error).message;
      logError('SzamlazzRoutes', `Send failed: ${message}`);
      res.status(500).json({ success: false, error: message });
    }
  };

  router.post('/create', handleSend);
  router.post('/send', handleSend);

  return router;
}

export default createSzamlazzRoutes;
