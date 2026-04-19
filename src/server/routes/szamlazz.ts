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
      const body = req.body as any;
      const xml = body.xml || body.xmlPayload || body.invoiceXml;
      
      if (!xml) {
        res.status(400).json({ success: false, error: 'xml is required' });
        return;
      }

      const result = await sendSzamlazzInvoice(xml);
      
      // Update snapshot logic (simplified to restore build)
      const existing = await readBookkeepingStatusSnapshot();
      const now = new Date().toISOString();
      const snapshot: BookkeepingStatusSnapshot = {
        summary: { ...(existing?.summary || {}), lastSend: result },
        exceptions: existing?.exceptions || [],
        timestamp: now,
        updatedAt: now,
        source: 'api'
      };
      await writeBookkeepingStatusSnapshot(snapshot);

      res.json({ success: true, result, snapshot });
    } catch (error: any) {
      logError('SzamlazzRoutes', `Send failed: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.post('/create', handleSend);
  router.post('/send', handleSend);

  return router;
}

export default createSzamlazzRoutes;
