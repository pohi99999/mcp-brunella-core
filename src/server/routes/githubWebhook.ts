/**
 * GitHub Webhook Handler
 * 
 * Processes GitHub workflow failures and pull requests
 * Verifies HMAC-SHA256 signatures for security
 * 
 * Environment Variables:
 * - GITHUB_WEBHOOK_SECRET: From GitHub App settings
 * - GITHUB_TOKEN: Personal access token for API calls
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { logInfo, logError, setAgentStatus } from '../../utils/logger.js';
import type {
  GitHubWorkflowRunPayload,
  GitHubPullRequestPayload,
  GitHubCheckRunPayload
} from '../../types/github.js';
import { GitHubAPIClient } from '../../core/githubAPIClient.js';
import { DeploymentAnalyzer } from '../../tools/deploymentAnalyzer.js';
import { processWorkflowFailure } from '../../core/julesIntegration.js';

const router = Router();

// Get webhook secret from environment
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

if (!GITHUB_WEBHOOK_SECRET) {
  logError('GitHubWebhook', 'GITHUB_WEBHOOK_SECRET environment variable not set');
}

if (!GITHUB_TOKEN) {
  logError('GitHubWebhook', 'GITHUB_TOKEN environment variable not set');
}

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 * @param request Express request
 * @param secret Webhook secret from GitHub
 * @returns true if signature is valid
 */
function verifyGitHubSignature(request: Request, secret: string): boolean {
  const signature = request.headers['x-hub-signature-256'];

  if (!signature || typeof signature !== 'string') {
    logError('GitHubWebhook', 'Missing or invalid X-Hub-Signature-256 header');
    return false;
  }

  try {
    // Get raw body for signature verification
    const rawBody =
      (request as unknown as Record<string, unknown>).rawBody || JSON.stringify(request.body);
    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    // Calculate expected signature
    const hash = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    const expectedSignature = 'sha256=' + hash;

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    logError('GitHubWebhook', `Signature verification failed: ${err}`);
    return false;
  }
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

    // Extract workflow details
    const {
      id: runId,
      name: workflowName,
      conclusion,
      head_branch: branch,
      repository: { name: repoName, owner }
    } = workflowRun;

    logInfo(
      'GitHubWebhook',
      `Detected failed workflow: ${workflowName} (ID: ${runId}) on branch: ${branch}`
    );

    // Queue Jules auto-fix in background (non-blocking)
    const ownerLogin = owner?.login || 'unknown';

    // Start fix workflow asynchronously
    setImmediate(async () => {
      try {
        logInfo(
          'GitHubWebhook',
          `Starting Jules auto-fix for workflow ${runId} (${ownerLogin}/${repoName})`
        );

        const fixWorkflow = await processWorkflowFailure(ownerLogin, repoName, runId, branch);

        logInfo(
          'GitHubWebhook',
          `Jules fix workflow complete: ${fixWorkflow.status} - PR #${fixWorkflow.prNumber || 'N/A'}`
        );
      } catch (fixErr: unknown) {
        const err = fixErr instanceof Error ? fixErr.message : String(fixErr);
        logError('GitHubWebhook', `Jules auto-fix failed: ${err}`);
        // Error handling is done in julesIntegration, just log here
      }
    });

    // Fetch and analyze workflow logs
    let analysis = null;

    if (GITHUB_TOKEN) {
      try {
        const apiClient = new GitHubAPIClient(GITHUB_TOKEN);
        logInfo('GitHubWebhook', `Fetching logs for workflow ${runId}...`);

        const logs = await apiClient.getWorkflowRunLogs(ownerLogin, repoName, runId);

        if (logs) {
          analysis = DeploymentAnalyzer.analyzeLogs(logs);

          logInfo(
            'GitHubWebhook',
            `Analysis complete: ${analysis.category} error with ${(analysis.confidence * 100).toFixed(0)}% confidence`
          );
        }
      } catch (analyzeErr: unknown) {
        const err = analyzeErr instanceof Error ? analyzeErr.message : String(analyzeErr);
        logError('GitHubWebhook', `Error analyzing logs: ${err}`);
        // Continue anyway, analysis is optional
      }
    } else {
      logError('GitHubWebhook', 'GITHUB_TOKEN not set, skipping error analysis');
    }

    const response = {
      taskId: `workflow-${runId}`,
      status: 'processing',
      workflow: {
        id: runId,
        name: workflowName,
        conclusion,
        branch,
        repo: repoName,
        owner: owner?.login || 'unknown'
      },
      analysis: analysis || null,
      message: 'Workflow failure detected, error analysis queued'
    };

    logInfo('GitHubWebhook', `Queued workflow analysis: ${response.taskId}`);

    res.status(202).json(response);
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    logError('GitHubWebhook', `Error processing workflow_run: ${err}`);
    res.status(500).json({
      error: 'Failed to process workflow run',
      details: err
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
      id: prNumber,
      title: prTitle,
      head: { ref: branch }
    } = pullRequest;

    logInfo('GitHubWebhook', `PR event (${action}): #${prNumber} "${prTitle}" on ${branch}`);

    // Track PR for potential auto-merge
    // TODO: Store in database for tracking

    res.status(200).json({
      status: 'acknowledged',
      event: 'pull_request',
      action,
      prNumber
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    logError('GitHubWebhook', `Error processing pull_request: ${err}`);
    res.status(500).json({
      error: 'Failed to process pull request',
      details: err
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
    const err = e instanceof Error ? e.message : String(e);
    logError('GitHubWebhook', `Error processing check_run: ${err}`);
    res.status(500).json({
      error: 'Failed to process check run',
      details: err
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
      } catch {
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

      if (!verifyGitHubSignature(req, GITHUB_WEBHOOK_SECRET)) {
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
      const err = e instanceof Error ? e.message : String(e);
      logError('GitHubWebhook', `Webhook processing error: ${err}`);
      return res.status(500).json({
        error: 'Internal server error',
        details: err
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
