/**
 * GitHub Webhook Handler
 * 
 * Processes GitHub workflow failures and pull requests
 * Verifies HMAC-SHA256 signatures for security
 * 
 * Environment Variables:
 * - GITHUB_WEBHOOK_SECRET: From GitHub App settings
 */

import { Router, type Request, type Response } from 'express';
import { logInfo, logError, logDebug, setAgentStatus } from '../../utils/logger.js';
import { ensureError } from '../../utils/ensureError.js';
import type {
  GitHubWorkflowRunPayload,
  GitHubPullRequestPayload,
  GitHubCheckRunPayload
} from '../../types/github.js';
import { ingestGitHubWorkflowFailure, verifyGitHubWebhookSignature } from '../../core/githubWebhookIngress.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { savePullRequest } from '../../utils/db.js';

const router = Router();

// Get webhook secret from environment
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

if (!GITHUB_WEBHOOK_SECRET) {
  logError('GitHubWebhook', 'GITHUB_WEBHOOK_SECRET environment variable not set');
}

/**
 * Handle workflow_run events (when a workflow completes)
 */
async function handleWorkflowRun(payload: unknown, res: Response): Promise<void> {
  const workflowPayload = payload as GitHubWorkflowRunPayload;
  const { action, workflow_run: workflowRun } = workflowPayload;

  setAgentStatus('GitHubWebhook', 'working', `Processing workflow: ${workflowRun.name}`);

  try {
    // Only process completed failures
    if (action !== 'completed') {
      logInfo('GitHubWebhook', `Workflow run event (action=${action}), skipping non-completed`);
      res.status(200).json({ message: 'Not a completed event' });
      return;
    }

    if (workflowRun.conclusion !== 'failure') {
      logInfo(
        'GitHubWebhook',
        `Workflow ${workflowRun.id} completed with: ${workflowRun.conclusion}, skipping`
      );
      res.status(200).json({ message: 'Not a failure event' });
      return;
    }

    const ingest = ingestGitHubWorkflowFailure(
      getGlobalDb(),
      'workflow_run',
      payload,
    );

    const workflowName = workflowRun.name;
    const runId = workflowRun.id;
    logInfo('GitHubWebhook', `Workflow failure queued via Event Fabric: ${workflowName} (${runId})`);

    res.status(202).json({
      taskId: `workflow-${runId}`,
      status: 'processing',
      workflow: {
        id: runId,
        name: workflowName,
        conclusion: workflowRun.conclusion,
        branch: workflowRun.head_branch,
        repo: workflowRun.repository.name,
        owner: workflowRun.repository.owner?.login || 'unknown',
      },
      accepted: ingest.accepted,
      webhookId: ingest.webhookId,
      message: 'Workflow failure detected, remediation runtime queued',
    });
  } catch (e: unknown) {
    const normalized = ensureError(e);
    logError('GitHubWebhook', `Error processing workflow_run: ${normalized.message}`, normalized);
    res.status(500).json({
      error: 'Failed to process workflow run',
      details: normalized.message
    });
  } finally {
    setAgentStatus('GitHubWebhook', 'idle');
  }
}

/**
 * Handle pull_request events
 */
async function handlePullRequest(payload: unknown, res: Response): Promise<void> {
  const prPayload = payload as GitHubPullRequestPayload;
  const { action, pull_request: pullRequest } = prPayload;

  try {
    const {
      id: githubId,
      title: prTitle,
      head: { ref: branch }
    } = pullRequest;

    const prNumber = prPayload.number || (pullRequest as any).number;

    logInfo('GitHubWebhook', `PR event (${action}): #${prNumber} "${prTitle}" on ${branch}`);

    // Track PR for potential auto-merge
    await savePullRequest({
        pr_number: prNumber,
        github_id: githubId,
        title: prTitle,
        owner: prPayload.repository.owner.login,
        repo: prPayload.repository.name,
        branch: branch,
        state: pullRequest.state,
        action: action
    });

    res.status(200).json({
      status: 'acknowledged',
      event: 'pull_request',
      action,
      prNumber
    });
  } catch (e: unknown) {
    const normalized = ensureError(e);
    logError('GitHubWebhook', `Error processing pull_request: ${normalized.message}`, normalized);
    res.status(500).json({
      error: 'Failed to process pull request',
      details: normalized.message
    });
  }
}

/**
 * Handle check_run events (detailed workflow step results)
 */
async function handleCheckRun(payload: unknown, res: Response): Promise<void> {
  const checkRunPayload = payload as GitHubCheckRunPayload;
  const { action, check_run: checkRun } = checkRunPayload;

  try {
    if (action !== 'completed' || checkRun.conclusion !== 'failure') {
      res.status(200).json({ message: 'Not a completed failure' });
      return;
    }

    logInfo('GitHubWebhook', `Check run failure: ${checkRun.name} (ID: ${checkRun.id})`);

    // TODO: More granular error tracking

    res.status(202).json({
      status: 'processing',
      checkRunId: checkRun.id,
      message: 'Check run failure detected'
    });
  } catch (e: unknown) {
    const normalized = ensureError(e);
    logError('GitHubWebhook', `Error processing check_run: ${normalized.message}`, normalized);
    res.status(500).json({
      error: 'Failed to process check run',
      details: normalized.message
    });
  }
}

/**
 * Main webhook endpoint
 *
 * Expected headers:
 * - X-GitHub-Event: Event type (workflow_run, pull_request, check_run, etc.)
 * - X-Hub-Signature-256: HMAC signature (sha256=...)
 *
 * Expected body: JSON payload from GitHub
 */
router.post(
  '/webhook',
  // Parse raw body for signature verification
  (req: Request, res: Response, next) => {
    // Read raw body for signature verification
    let rawBodyData = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      rawBodyData += chunk;
    });
    req.on('end', () => {
      (req as unknown as Record<string, unknown>).rawBody = rawBodyData;
      // Parse JSON for handler functions
      try {
        req.body = JSON.parse(rawBodyData);
        next();
      } catch (error: unknown) {
        logDebug('GitHubWebhook', `Invalid JSON payload: ${ensureError(error).message}`);
        res.status(400).json({ error: 'Invalid JSON' });
      }
    });
  },
  async (req: Request, res: Response) => {
    setAgentStatus('GitHubWebhook', 'working', 'Processing webhook');

    try {
      // 1. Verify webhook signature
      if (!GITHUB_WEBHOOK_SECRET) {
        logError('GitHubWebhook', 'GITHUB_WEBHOOK_SECRET not configured');
        return res.status(500).json({
          error: 'Webhook not configured',
          details: 'GITHUB_WEBHOOK_SECRET missing'
        });
      }

      const signature = typeof req.headers['x-hub-signature-256'] === 'string'
        ? req.headers['x-hub-signature-256']
        : undefined;
      const rawBody = (req as unknown as Record<string, unknown>).rawBody;
      if (!verifyGitHubWebhookSignature(GITHUB_WEBHOOK_SECRET, signature, typeof rawBody === 'string' ? rawBody : undefined)) {
        logError('GitHubWebhook', 'Invalid webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }

      logInfo('GitHubWebhook', 'Signature verified ✓');

      // 2. Parse event type and payload
      const event = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery-id'];

      if (!event || typeof event !== 'string') {
        return res.status(400).json({ error: 'Missing X-GitHub-Event header' });
      }

      const payload = req.body as unknown;

      logInfo('GitHubWebhook', `Event: ${event} (delivery: ${deliveryId})`);

      // 3. Route to appropriate handler
      switch (event) {
        case 'workflow_run':
          return await handleWorkflowRun(payload, res);

        case 'pull_request':
          return await handlePullRequest(payload, res);

        case 'check_run':
          return await handleCheckRun(payload, res);

        default:
          logInfo('GitHubWebhook', `Unhandled event type: ${event}`);
          return res.status(200).json({
            message: `Event type '${event}' not yet implemented`,
            supported: ['workflow_run', 'pull_request', 'check_run']
          });
      }
    } catch (e: unknown) {
      const normalized = ensureError(e);
      logError('GitHubWebhook', `Webhook processing error: ${normalized.message}`, normalized);
      return res.status(500).json({
        error: 'Internal server error',
        details: normalized.message
      });
    } finally {
      setAgentStatus('GitHubWebhook', 'idle');
    }
  }
);

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    webhook_configured: !!GITHUB_WEBHOOK_SECRET,
    events_supported: ['workflow_run', 'pull_request', 'check_run']
  });
});

export default router;
