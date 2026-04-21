/**
 * Slack Notifications for Jules Auto-Fix Events
 *
 * Sends real-time updates about workflow analysis and fix attempts
 */

import { logWarn, logError, logInfo } from '@packages/utils/logger.js';

export type NotificationStage = 'analyzing' | 'fixed' | 'merged' | 'failed';

interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  ts: number;
}

interface SlackMessage {
  attachments: SlackAttachment[];
}

/**
 * Send notification to Slack webhook
 */
export async function notifySlack(
  stage: NotificationStage,
  runId: number,
  error?: string
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logWarn('SlackNotifications', 'SLACK_WEBHOOK_URL not set - skipping Slack notification');
    return;
  }

  try {
    const message = buildMessage(stage, runId, error);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    logInfo('SlackNotifications', `✅ Slack notification sent: ${stage}`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError('SlackNotifications', `Failed to send Slack notification: ${errMsg}`);
    // Don't throw - notifications are best-effort
  }
}

/**
 * Build Slack message based on notification stage
 */
function buildMessage(
  stage: NotificationStage,
  runId: number,
  error?: string
): SlackMessage {
  const templates: Record<NotificationStage, SlackAttachment> = {
    analyzing: {
      color: '#FFA500',
      title: '🔍 Jules is analyzing workflow error',
      text: `Workflow run #${runId}`,
      ts: Math.floor(Date.now() / 1000)
    },
    fixed: {
      color: '#36a64f',
      title: '✅ Jules generated a fix',
      text: `PR created with automated fix for workflow #${runId}`,
      fields: [
        {
          title: 'Workflow ID',
          value: `#${runId}`,
          short: true
        },
        {
          title: 'Status',
          value: 'Ready for review or auto-merge',
          short: true
        }
      ],
      ts: Math.floor(Date.now() / 1000)
    },
    merged: {
      color: '#36a64f',
      title: '✨ Fix auto-merged',
      text: `Workflow #${runId} fix confidence ≥75%, PR merged automatically`,
      fields: [
        {
          title: 'Workflow ID',
          value: `#${runId}`,
          short: true
        },
        {
          title: 'Action',
          value: 'Auto-merged',
          short: true
        }
      ],
      ts: Math.floor(Date.now() / 1000)
    },
    failed: {
      color: '#ff0000',
      title: '❌ Jules fix failed',
      text: `Workflow #${runId}: ${error || 'Unknown error'}`,
      fields: [
        {
          title: 'Workflow ID',
          value: `#${runId}`,
          short: true
        },
        {
          title: 'Error',
          value: error || 'N/A',
          short: false
        },
        {
          title: 'Action Required',
          value: 'Manual review issue created',
          short: true
        }
      ],
      ts: Math.floor(Date.now() / 1000)
    }
  };

  const attachment = templates[stage];

  return {
    attachments: [attachment]
  };
}

/**
 * Send detailed error analysis notification
 */
export async function notifyErrorAnalysis(
  runId: number,
  analysis: {
    category: string;
    title: string;
    message: string;
    confidence: number;
    affectedFiles: string[];
  }
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    const message: SlackMessage = {
      attachments: [
        {
          color: '#0099ff',
          title: `📊 Error Analysis for Workflow #${runId}`,
          text: analysis.title,
          fields: [
            {
              title: 'Error Type',
              value: analysis.category.toUpperCase(),
              short: true
            },
            {
              title: 'Confidence',
              value: `${(analysis.confidence * 100).toFixed(0)}%`,
              short: true
            },
            {
              title: 'Summary',
              value: analysis.message,
              short: false
            },
            {
              title: 'Affected Files',
              value: analysis.affectedFiles.slice(0, 3).join('\n') || 'None identified',
              short: false
            }
          ],
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }

    logInfo('SlackNotifications', `✅ Error analysis notification sent`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError('SlackNotifications', `Failed to send error analysis notification: ${errMsg}`);
  }
}

