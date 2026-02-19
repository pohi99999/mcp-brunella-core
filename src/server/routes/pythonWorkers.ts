/**
 * Python Workers Router
 * API endpoints for OCR, Web Scraper, and LanceDB Batch workers.
 *
 * Endpoints:
 * - GET /api/python-workers/status
 * - POST /api/python-workers/ocr
 * - POST /api/python-workers/scraper
 * - POST /api/python-workers/lancedb-batch
 */

import { Router, Request, Response } from 'express';
import { globalPythonShell } from '../../utils/pythonShell.js';
import { logInfo, logError } from '../../utils/logger.js';

interface PythonWorkerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

function parsePythonJson(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed);
}

function wrapError(error: unknown): PythonWorkerResult {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}

export function createPythonWorkersRouter(): Router {
  const router = Router();

  router.get('/status', async (_req: Request, res: Response) => {
    res.json({
      status: 'success',
      workers: [
        { name: 'ocr', available: true },
        { name: 'scraper', available: true },
        { name: 'lancedb-batch', available: true },
      ],
    });
  });

  router.post('/ocr', async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      logInfo('PythonWorkers', 'OCR request received');

      const script = `import json\nfrom myai.workers.ocr_worker import OCRRequest, process_ocr\nreq = OCRRequest(**context)\nres = process_ocr(req)\nprint(res.model_dump_json())`;
      const result = await globalPythonShell.run(script, payload);
      const data = parsePythonJson(result);

      res.json({ success: true, data });
    } catch (error: unknown) {
      const response = wrapError(error);
      logError('PythonWorkers', response.error || 'OCR failed');
      res.status(500).json(response);
    }
  });

  router.post('/scraper', async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      logInfo('PythonWorkers', 'Web scraper request received');

      const script = `import json, asyncio\nfrom myai.workers.web_scraper import ScraperRequest, scrape, scrape_product_listings, scrape_article_content, scrape_contact_info\nif context.get('template') == 'product':\n    res = asyncio.run(scrape_product_listings(context['url']))\nelif context.get('template') == 'article':\n    res = asyncio.run(scrape_article_content(context['url']))\nelif context.get('template') == 'contact':\n    res = asyncio.run(scrape_contact_info(context['url']))\nelse:\n    req = ScraperRequest(**context)\n    res = asyncio.run(scrape(req))\nprint(res.model_dump_json())`;
      const result = await globalPythonShell.run(script, payload);
      const data = parsePythonJson(result);

      res.json({ success: true, data });
    } catch (error: unknown) {
      const response = wrapError(error);
      logError('PythonWorkers', response.error || 'Scraper failed');
      res.status(500).json(response);
    }
  });

  router.post('/lancedb-batch', async (req: Request, res: Response) => {
    try {
      const payload = req.body || {};
      logInfo('PythonWorkers', 'LanceDB batch request received');

      const script = `import json\nfrom myai.workers.lancedb_batch import IngestionRequest, ingest_batch\nreq = IngestionRequest(**context)\nres = ingest_batch(req)\nprint(res.model_dump_json())`;
      const result = await globalPythonShell.run(script, payload);
      const data = parsePythonJson(result);

      res.json({ success: true, data });
    } catch (error: unknown) {
      const response = wrapError(error);
      logError('PythonWorkers', response.error || 'LanceDB batch failed');
      res.status(500).json(response);
    }
  });

  return router;
}
