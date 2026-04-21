import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createGithubWebhookEventEnvelope, eventFabric } from './eventFabric.js';
import { logError, logInfo } from '@packages/utils/logger.js';

export interface GitHubWebhookIngestResult {
  webhookId: string;
  eventType: string;
  processed: boolean;
  accepted: boolean;
  envelopeType?: string;
  reason?: string;
}

export function verifyGitHubWebhookSignature(
  secret: string,
  signature: string | undefined,
  rawBody: string | Buffer | undefined,
): boolean {
  if (!secret) {
    return false;
  }

  if (!signature) {
    return false;
  }

  if (!rawBody) {
    return false;
  }

  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function storeGitHubWebhookEvent(
  db: Database.Database,
  eventName: string,
  payload: unknown,
): { webhookId: string; eventType: string } {
  const webhookId = uuidv4();
  const eventType = `github.${eventName || 'unknown'}`;

  db.prepare(`
    INSERT INTO webhook_events (id, type, provider, payload, processed)
    VALUES (?, ?, ?, ?, ?)
  `).run(webhookId, eventType, 'github', JSON.stringify(payload), 0);

  return { webhookId, eventType };
}

function isWorkflowFailurePayload(payload: unknown): payload is Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const body = payload as Record<string, unknown>;
  const workflowRun =
    typeof body.workflow_run === 'object' && body.workflow_run !== null && !Array.isArray(body.workflow_run)
      ? body.workflow_run as Record<string, unknown>
      : undefined;

  return body.action === 'completed' && workflowRun?.conclusion === 'failure';
}

export function ingestGitHubWorkflowFailure(
  db: Database.Database,
  eventName: string,
  payload: unknown,
): GitHubWebhookIngestResult {
  const stored = storeGitHubWebhookEvent(db, eventName, payload);

  if (eventName !== 'workflow_run' || !isWorkflowFailurePayload(payload)) {
    return {
      webhookId: stored.webhookId,
      eventType: stored.eventType,
      processed: false,
      accepted: false,
      reason: 'not_workflow_failure',
    };
  }

  const envelope = createGithubWebhookEventEnvelope(eventName, payload);
  const publishResult = eventFabric.publish(envelope);
  db.prepare('UPDATE webhook_events SET processed = 1 WHERE id = ?').run(stored.webhookId);

  logInfo(
    'GitHubWebhookIngress',
    `Workflow failure ingested: ${stored.webhookId} (${publishResult.accepted ? 'accepted' : publishResult.reason ?? 'skipped'})`,
  );

  return {
    webhookId: stored.webhookId,
    eventType: stored.eventType,
    processed: true,
    accepted: publishResult.accepted,
    envelopeType: envelope.type,
    reason: publishResult.reason,
  };
}

export function rejectInvalidGitHubSignature(routeName: string): void {
  logError(routeName, 'Invalid GitHub webhook signature');
}


