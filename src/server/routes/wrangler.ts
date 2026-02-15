import { Router, Request, Response } from 'express';
import { getWrangler, initializeWrangler } from '../../utils/wranglerHelper.js';
import { logInfo, logError } from '../../utils/logger.js';

export const createWranglerRouter = () => {
  const router = Router();

  /**
   * POST /api/wrangler/init-d1
   * Initialize Cloudflare D1 database
   */
  router.post('/wrangler/init-d1', async (req: Request, res: Response): Promise<void> => {
    try {
      const { databaseName, accountId, apiToken } = req.body;

      if (!databaseName || !accountId || !apiToken) {
        res.status(400).json({ error: 'Missing required fields: databaseName, accountId, apiToken' });
        return;
      }

      const wrangler = initializeWrangler({
        projectName: 'brunella-cean',
        accountId,
        apiToken,
      });

      const isInstalled = await wrangler.checkWranglerInstalled();
      if (!isInstalled) {
        res.status(500).json({ error: 'Wrangler CLI not installed' });
        return;
      }

      const result = await wrangler.initializeD1(databaseName);
      if (!result) {
        res.status(500).json({ error: 'Failed to initialize D1 database' });
        return;
      }

      logInfo('WranglerRoutes', `D1 database initialized: ${databaseName}`);
      res.json({
        success: true,
        databaseName,
        output: result,
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'D1 initialization failed' });
    }
  });

  /**
   * POST /api/wrangler/deploy
   * Deploy Cloudflare Worker
   */
  router.post('/wrangler/deploy', async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountId, apiToken } = req.body;

      if (!accountId || !apiToken) {
        res.status(400).json({ error: 'Missing required fields: accountId, apiToken' });
        return;
      }

      const wrangler = initializeWrangler({
        projectName: 'brunella-cean',
        accountId,
        apiToken,
      });

      const success = await wrangler.publishWorker();
      if (!success) {
        res.status(500).json({ error: 'Worker deployment failed' });
        return;
      }

      logInfo('WranglerRoutes', 'Worker deployed successfully');
      res.json({
        success: true,
        message: 'Worker deployed to Cloudflare',
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'Deployment failed' });
    }
  });

  /**
   * GET /api/wrangler/list-databases
   * List all D1 databases
   */
  router.get('/wrangler/list-databases', async (req: Request, res: Response): Promise<void> => {
    try {
      const { accountId, apiToken } = req.query;

      if (!accountId || !apiToken) {
        res.status(400).json({ error: 'Missing required params: accountId, apiToken' });
        return;
      }

      const wrangler = initializeWrangler({
        projectName: 'brunella-cean',
        accountId: String(accountId),
        apiToken: String(apiToken),
      });

      const databases = await wrangler.listD1Databases();
      if (!databases) {
        res.status(500).json({ error: 'Failed to list databases' });
        return;
      }

      res.json({
        success: true,
        databases,
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'List operation failed' });
    }
  });

  /**
   * POST /api/wrangler/run-migration
   * Run D1 migrations from schema file
   */
  router.post('/wrangler/run-migration', async (req: Request, res: Response): Promise<void> => {
    try {
      const { databaseId, accountId, apiToken, schemaPath } = req.body;

      if (!databaseId || !accountId || !apiToken || !schemaPath) {
        res.status(400).json({ error: 'Missing required fields: databaseId, accountId, apiToken, schemaPath' });
        return;
      }

      const wrangler = initializeWrangler({
        projectName: 'brunella-cean',
        accountId,
        apiToken,
      });

      const success = await wrangler.runD1Migration(databaseId, schemaPath);
      if (!success) {
        res.status(500).json({ error: 'Migration failed' });
        return;
      }

      logInfo('WranglerRoutes', `Migration completed for database: ${databaseId}`);
      res.json({
        success: true,
        databaseId,
        message: 'Migration completed successfully',
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'Migration execution failed' });
    }
  });

  return router;
};
