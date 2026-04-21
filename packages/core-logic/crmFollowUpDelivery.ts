import { sendNotificationEmail } from '@packages/utils/notificationService.js';
import { logError, logInfo, logWarn } from '@packages/utils/logger.js';
import type {
  CrmFollowUpActionRecord,
  CrmFollowUpPlanRecord,
  CrmLeadRecord,
} from '@packages/utils/crm_db.js';

export interface CrmFollowUpDeliveryContext {
  lead: CrmLeadRecord;
  plan: CrmFollowUpPlanRecord;
  action: CrmFollowUpActionRecord;
}

export interface CrmFollowUpDeliveryResult {
  channel: 'email' | 'slack';
  sent: boolean;
  skipped: boolean;
  target: string | null;
  message: string;
}

function buildSubject(context: CrmFollowUpDeliveryContext): string {
  return `CRM follow-up ${context.action.step.toUpperCase()} — ${context.lead.company ?? context.lead.id}`;
}

function buildText(context: CrmFollowUpDeliveryContext): string {
  const lines = [
    `Lead: ${context.lead.id}`,
    `Company: ${context.lead.company ?? 'n/a'}`,
    `Channel: ${context.action.channel}`,
    `Target: ${context.action.target ?? 'n/a'}`,
    `Step: ${context.action.step}`,
    `Summary: ${context.action.summary}`,
    `Plan: ${context.plan.id}`,
  ];

  return lines.join('\n');
}

async function sendSlackWebhook(text: string): Promise<{ sent: boolean; message: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.BRUNELLA_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return { sent: false, message: 'Slack webhook missing' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return { sent: false, message: `Slack webhook HTTP ${response.status}` };
    }

    logInfo('CrmFollowUpDelivery', 'CRM follow-up Slack notification sent');
    return { sent: true, message: 'Slack notification sent' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError('CrmFollowUpDelivery', `Slack notification failed: ${message}`);
    return { sent: false, message };
  }
}

/**
 * Sends a CRM follow-up action through the action's configured channel.
 */
export async function sendCrmFollowUpDelivery(
  context: CrmFollowUpDeliveryContext,
): Promise<CrmFollowUpDeliveryResult> {
  const subject = buildSubject(context);
  const text = buildText(context);

  if (context.action.channel === 'email') {
    const target = context.action.target;
    if (!target || !target.includes('@')) {
      logWarn('CrmFollowUpDelivery', `Skipping email delivery for ${context.action.id}: missing target`);
      return {
        channel: 'email',
        sent: false,
        skipped: true,
        target: target ?? null,
        message: 'Email target missing',
      };
    }

    const html = `<p><strong>${subject}</strong></p><pre>${text}</pre>`;
    const emailResult = await sendNotificationEmail({
      subject,
      text,
      html,
    });

    return {
      channel: 'email',
      sent: emailResult.sent,
      skipped: !emailResult.sent,
      target,
      message: emailResult.message,
    };
  }

  const slackResult = await sendSlackWebhook(text);
  return {
    channel: 'slack',
    sent: slackResult.sent,
    skipped: !slackResult.sent && slackResult.message === 'Slack webhook missing',
    target: context.action.target ?? null,
    message: slackResult.message,
  };
}

