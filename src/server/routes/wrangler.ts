import { Router, Request, Response } from 'express';
import { getWrangler, initializeWrangler } from '../../utils/wranglerHelper.js';
import { logInfo, logError } from '../../utils/logger.js';
import { CEANAutoDeploy } from '../../core/ceanAutoDeploy.js';

export const createWranglerRouter = () => {
  const router = Router();

  /**
   * POST /api/wrangler/auto-deploy
   * Run the full deployment pipeline (D1 Schema + Worker Deploy)
   */
  router.post('/wrangler/auto-deploy', async (req: any, res: any): Promise<void> => {
    try {
      const { databaseId, apiToken, workerDir, schemaPath, projectName } = req.body;

      if (!databaseId || !apiToken || !workerDir || !schemaPath) {
        res.status(400).json({ error: 'Missing required fields: databaseId, apiToken, workerDir, schemaPath' });
        return;
      }

      const autoDeploy = new CEANAutoDeploy({
        databaseId,
        apiToken,
        workerDir,
        schemaPath,
        projectName: projectName || 'brunella-cean'
      });

      const result = await autoDeploy.run();
      if (!result.success) {
        res.status(500).json({ error: result.message, details: result.details });
        return;
      }

      logInfo('WranglerRoutes', `AutoDeploy successful for project: ${projectName || 'brunella-cean'}`);
      res.json(result);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', `AutoDeploy failed: ${error}`);
      res.status(500).json({ error: 'AutoDeploy execution failed' });
    }
  });

  /**
   * POST /api/wrangler/init-d1
   * Initialize Cloudflare D1 database
   */
  router.post('/wrangler/init-d1', async (req: any, res: any): Promise<void> => {
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
  router.post('/wrangler/deploy', async (req: any, res: any): Promise<void> => {
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
  router.get('/wrangler/list-databases', async (req: any, res: any): Promise<void> => {
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
  router.post('/wrangler/run-migration', async (req: any, res: any): Promise<void> => {
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

  /**
   * POST /api/wrangler/execute-query
   * Execute arbitrary D1 query
   */
  router.post('/wrangler/execute-query', async (req: any, res: any): Promise<void> => {
    try {
      const { databaseId, accountId, apiToken, query } = req.body;

      if (!databaseId || !accountId || !apiToken || !query) {
        res.status(400).json({ error: 'Missing required fields: databaseId, accountId, apiToken, query' });
        return;
      }

      const wrangler = initializeWrangler({
        projectName: 'brunella-cean',
        accountId,
        apiToken,
      });

      const result = await wrangler.executeD1Query(databaseId, query);
      if (!result) {
        res.status(500).json({ error: 'Query execution failed' });
        return;
      }

      logInfo('WranglerRoutes', `Query executed on database: ${databaseId}`);
      res.json({
        success: true,
        databaseId,
        result,
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'Query execution failed' });
    }
  });

  /**
   * POST /api/wrangler/check-tunnels
   * Health check for Cloudflare Tunnels
   */
  router.post('/wrangler/check-tunnels', async (req: any, res: any): Promise<void> => {
    try {
      const { urls } = req.body;

      if (!urls || !Array.isArray(urls)) {
        res.status(400).json({ error: 'Missing required field: urls (array)' });
        return;
      }

      const results = await Promise.all(
        urls.map(async (url: string) => {
          const start = Date.now();
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            return {
              url,
              status: response.ok || response.status < 500 ? 'online' : 'error',
              statusCode: response.status,
              latency: Date.now() - start,
            };
          } catch (e: unknown) {
            return {
              url,
              status: 'offline',
              error: e instanceof Error ? e.message : String(e),
              latency: Date.now() - start,
            };
          }
        })
      );

      res.json({ success: true, results });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('WranglerRoutes', error);
      res.status(500).json({ error: 'Tunnel check failed' });
    }
  });

  return router;
};
