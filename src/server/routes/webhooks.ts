import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logInfo, logError } from '../../utils/logger.js';
import { JulesAutomationService } from '../../core/julesAutomationService.js';
import { ingestGitHubWorkflowFailure } from '../../core/githubWebhookIngress.js';
import { fireHookSafely } from '../../core/hookRegistry.js';
import { config } from '../../config/schema.js';

interface WebhookEvent {
  id: string;
  type: string;
  provider: string;
  payload: string;
  processed: boolean;
  created_at: string;
}

async function emitWebhookHooks(
  provider: string,
  event: string,
  payload: unknown,
  webhookId: string,
): Promise<void> {
  await fireHookSafely('webhook.received', {
    provider,
    event,
    webhookId,
    payload,
  }, {
    source: 'webhooks',
    metadata: { provider, event, webhookId },
    logContext: 'Webhooks',
  });

  if (provider === 'github' && event === 'github.push') {
    await fireHookSafely('github.push', {
      webhookId,
      payload,
    }, {
      source: 'webhooks',
      metadata: { webhookId },
      logContext: 'Webhooks',
    });
  }
}

function deriveN8nWorkflowEvent(body: unknown): 'n8n:workflow:completed' | 'n8n:workflow:failed' | 'n8n:workflow:timeout' | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const status = typeof record.status === 'string'
    ? record.status.toLowerCase()
    : typeof record.state === 'string'
      ? record.state.toLowerCase()
      : typeof record.result === 'string'
        ? record.result.toLowerCase()
        : '';

  if (status.includes('timeout')) {
    return 'n8n:workflow:timeout';
  }

  if (status.includes('fail') || status.includes('error')) {
    return 'n8n:workflow:failed';
  }

  if (status.includes('success') || status.includes('complete') || status.includes('completed')) {
    return 'n8n:workflow:completed';
  }

  return null;
}

function verifyGitHubSignature(req: Request, res: Response): boolean {
  if (!config.githubWebhookSecret) {
    return true;
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!signature) {
    logError('Webhooks', 'Missing GitHub webhook signature');
    res.status(401).json({ error: 'Missing signature' });
    return false;
  }

   //- rawBody added by middleware
  const rawBody = (req as any).rawBody as Buffer | string | undefined;
  if (!rawBody) {
    res.status(400).json({ error: 'Raw body not available for signature verification' });
    return false;
  }

  const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
  const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;
  const received = Buffer.from(signature);
  const expected = Buffer.from(digest);

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    logError('Webhooks', 'Invalid GitHub webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }

  return true;
}

export function createWebhookRoutes(db: Database.Database): Router {
  const router = Router();

  /**
   * GitHub Push Webhook
   * Triggered on repository push events
   */
  router.post('/github/push', async (req: Request, res: Response) => {
    try {
      if (!verifyGitHubSignature(req, res)) {
        return;
      }

      const { repository, pusher, ref, head_commit } = req.body;

      if (!repository || !pusher) {
        return res.status(400).json({ error: 'Invalid GitHub webhook payload' });
      }

      const webhookId = uuidv4();
      const eventType = 'github.push';

      // Store webhook event
      db.prepare(`
        INSERT INTO webhook_events (id, type, provider, payload, processed)
        VALUES (?, ?, ?, ?, ?)
      `).run(webhookId, eventType, 'github', JSON.stringify(req.body), 0);
      await emitWebhookHooks('github', eventType, req.body, webhookId);

      logInfo('Webhooks', `GitHub push detected: ${repository.name} (${ref})`);

      // Trigger auto-scan for suggested tasks
      try {
        await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'webhook',
            provider: 'github',
            repository: repository.name,
            commit: head_commit?.id || 'unknown',
          }),
        });

        // Mark event as processed
        db.prepare('UPDATE webhook_events SET processed = 1 WHERE id = ?').run(webhookId);

        logInfo('Webhooks', `Auto-scan triggered for ${repository.name}`);
      } catch (err) {
        logError('Webhooks', `Auto-scan failed: ${err}`);
      }

      res.json({
        success: true,
        webhookId,
        message: 'Webhook processed successfully',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `GitHub webhook error: ${msg}`);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * GitHub Workflow Run Webhook
   * Triggered when GitHub Actions workflow completes (for CI/CD failure detection)
   */
  router.post('/github', async (req: Request, res: Response) => {
    try {
      if (!verifyGitHubSignature(req, res)) {
        return;
      }

      const eventHeader = req.headers['x-github-event'];
      const event = Array.isArray(eventHeader) ? eventHeader[0] : eventHeader;

      const result = ingestGitHubWorkflowFailure(db, event || 'unknown', req.body);
      await emitWebhookHooks('github', `github.${event || 'unknown'}`, req.body, result.webhookId);
      logInfo('Webhooks', `GitHub ${event} event received`);

      res.json({
        success: true,
        webhookId: result.webhookId,
        message: 'Webhook received',
        remediationAccepted: result.accepted,
        remediationReason: result.reason,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `GitHub webhook error: ${msg}`);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Render Deployment Webhook
   * Triggered when Render deploys the app - imports Jules automations
   */
  router.post('/render/deploy', async (req: Request, res: Response) => {
    try {
      const webhookId = uuidv4();
      const eventType = 'render.deploy';

      // Store webhook event
      db.prepare(`
        INSERT INTO webhook_events (id, type, provider, payload, processed)
        VALUES (?, ?, ?, ?, ?)
      `).run(webhookId, eventType, 'render', JSON.stringify(req.body), 0);
      await emitWebhookHooks('render', eventType, req.body, webhookId);

      logInfo('Webhooks', `Render deployment detected`);

      // Initialize Jules Automation Service
      const julesService = new JulesAutomationService(db);
      
      try {
        // Import Jules automations from config
        const result = await julesService.importJulesAutomations({
          skipIfExists: true,
          enableImmediately: true,
        });

        // Mark event as processed
        db.prepare('UPDATE webhook_events SET processed = 1 WHERE id = ?').run(webhookId);
        await fireHookSafely('dashboard:deploy:completed', {
          webhookId,
          provider: 'render',
          payload: req.body,
          result,
        }, {
          source: 'webhooks',
          metadata: { provider: 'render', webhookId },
          logContext: 'Webhooks',
        });

        logInfo('Webhooks', `Jules automations imported: ${result.imported} imported, ${result.skipped} skipped`);

        res.json({
          success: true,
          webhookId,
          message: 'Render webhook processed successfully',
          result,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logError('Webhooks', `Jules automation import failed: ${msg}`);
        res.status(500).json({ 
          success: false,
          webhookId,
          error: 'Jules automation import failed',
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `Render webhook error: ${msg}`);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Generic Webhook Receiver
   * For scheduled tasks or custom integrations
   */
  router.post('/webhook/:provider', async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const webhookId = uuidv4();

      // Store event
      db.prepare(`
        INSERT INTO webhook_events (id, type, provider, payload, processed)
        VALUES (?, ?, ?, ?, ?)
      `).run(webhookId, `${provider}.custom`, provider as string, JSON.stringify(req.body), 0);
      await emitWebhookHooks(provider as string, `${provider}.custom`, req.body, webhookId);
      const workflowEvent = provider === 'n8n' ? deriveN8nWorkflowEvent(req.body) : null;
      if (workflowEvent) {
        await fireHookSafely(workflowEvent, {
          provider,
          webhookId,
          payload: req.body,
        }, {
          source: 'webhooks',
          metadata: { provider, webhookId, workflowEvent },
          logContext: 'Webhooks',
        });
      }

      logInfo('Webhooks', `Webhook received from ${provider}`);

      res.json({
        success: true,
        webhookId,
        message: 'Webhook queued for processing',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `Webhook error: ${msg}`);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Get webhook events history
   */
  router.get('/webhook-events', (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
      const events = db
        .prepare(`
          SELECT * FROM webhook_events 
          ORDER BY created_at DESC 
          LIMIT ?
        `)
        .all(limit) as WebhookEvent[];

      res.json({
        success: true,
        count: events.length,
        events: events.map((e) => ({
          ...e,
          payload: JSON.parse(e.payload),
        })),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `Failed to fetch events: ${msg}`);
      res.status(500).json({ error: 'Failed to fetch webhook events' });
    }
  });

  /**
   * Clear old webhook events (cleanup)
   */
  router.post('/webhook-events/cleanup', (req: Request, res: Response) => {
    try {
      const daysOld = parseInt(req.body.daysOld, 10) || 7;
      const result = db.prepare(`
        DELETE FROM webhook_events 
        WHERE created_at < datetime('now', '-' || ? || ' days')
      `).run(daysOld);

      logInfo('Webhooks', `Cleaned up ${result.changes} old events`);

      res.json({
        success: true,
        deleted: result.changes,
        message: `Deleted webhook events older than ${daysOld} days`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('Webhooks', `Cleanup failed: ${msg}`);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  });

  return router;
}

export default createWebhookRoutes;
