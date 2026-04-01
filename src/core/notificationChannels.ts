import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import type { ApprovalWorkflow } from './approvalRouter.js';
import {
  isNotificationEmailConfigured,
  sendNotificationEmail,
} from '../utils/notificationService.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import {
  clearNotificationDeliveries,
  loadNotificationDeliveries,
  saveNotificationDelivery,
} from './autonomyRuntimeStore.js';

export type NotificationChannel = 'email' | 'slack' | 'discord';
export type NotificationDeliveryChannel = NotificationChannel | 'system';
export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';
export type NotificationEventType =
  | 'approval_requested'
  | 'approval_resolved'
  | 'approval_expired';

export interface NotificationChannelAvailability {
  channel: NotificationChannel;
  enabled: boolean;
  target?: string;
}

export interface NotificationDeliveryRecord {
  id: string;
  workflowId?: string;
  approvalRequestId?: string;
  channel: NotificationDeliveryChannel;
  status: NotificationDeliveryStatus;
  eventType: NotificationEventType;
  title: string;
  message: string;
  error?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliverySummary {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  byChannel: Partial<Record<NotificationDeliveryChannel, number>>;
  availableChannels: NotificationChannelAvailability[];
}

export interface NotificationChannelPolicy {
  channel: NotificationChannel;
  enabled: boolean;
  eventTypes: NotificationEventType[];
  fallbackChannel?: NotificationChannel;
}

interface NotificationTemplate {
  title: string;
  text: string;
  html: string;
}

interface DeliveryFilters {
  limit?: number;
  channel?: NotificationDeliveryChannel;
  status?: NotificationDeliveryStatus;
}

const HISTORY_LIMIT = 200;
const ALL_NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  'approval_requested',
  'approval_resolved',
  'approval_expired',
];
const DEFAULT_POLICY_PATH = path.join(process.cwd(), 'data', 'notification_channel_policies.json');

function webhookTargetFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getStatusLabel(status: ApprovalWorkflow['status']): string {
  switch (status) {
    case 'approved':
      return 'Jóváhagyva';
    case 'rejected':
      return 'Elutasítva';
    case 'expired':
      return 'Lejárt';
    default:
      return 'Jóváhagyásra vár';
  }
}

function getResolvedEventType(status: ApprovalWorkflow['status']): NotificationEventType {
  return status === 'expired' ? 'approval_expired' : 'approval_resolved';
}

class NotificationChannelsService {
  private deliveries: NotificationDeliveryRecord[] = [];
  private policies = new Map<NotificationChannel, NotificationChannelPolicy>();
  private hydratedDeliveries = false;

  constructor() {
    this.initializePolicies();
  }

  hydrateFromStore(): number {
    if (!this.hydratedDeliveries) {
      this.deliveries = loadNotificationDeliveries(HISTORY_LIMIT);
      this.hydratedDeliveries = true;
    }

    return this.deliveries.length;
  }

  getPolicies(): NotificationChannelPolicy[] {
    return (['email', 'slack', 'discord'] as NotificationChannel[]).map((channel) => this.getPolicy(channel));
  }

  updatePolicy(
    channel: NotificationChannel,
    updates: Partial<Pick<NotificationChannelPolicy, 'enabled' | 'eventTypes' | 'fallbackChannel'>>,
  ): NotificationChannelPolicy {
    const current = this.getPolicy(channel);
    const next: NotificationChannelPolicy = {
      channel,
      enabled: typeof updates.enabled === 'boolean' ? updates.enabled : current.enabled,
      eventTypes: Array.isArray(updates.eventTypes)
        ? updates.eventTypes.filter((eventType): eventType is NotificationEventType => ALL_NOTIFICATION_EVENT_TYPES.includes(eventType))
        : current.eventTypes,
      fallbackChannel:
        updates.fallbackChannel && updates.fallbackChannel !== channel
          ? updates.fallbackChannel
          : undefined,
    };

    this.policies.set(channel, next);
    this.persistPolicies();
    return next;
  }

  getAvailableChannels(): NotificationChannelAvailability[] {
    const slackUrl = process.env.SLACK_WEBHOOK_URL || process.env.BRUNELLA_SLACK_WEBHOOK_URL;
    const discordUrl = process.env.DISCORD_WEBHOOK_URL || process.env.BRUNELLA_DISCORD_WEBHOOK_URL;

    return [
      {
        channel: 'email',
        enabled: isNotificationEmailConfigured(),
        target: process.env.SMTP_TO,
      },
      {
        channel: 'slack',
        enabled: Boolean(slackUrl),
        target: webhookTargetFromUrl(slackUrl),
      },
      {
        channel: 'discord',
        enabled: Boolean(discordUrl),
        target: webhookTargetFromUrl(discordUrl),
      },
    ];
  }

  async dispatchApprovalRequested(
    workflow: ApprovalWorkflow,
  ): Promise<NotificationDeliveryRecord[]> {
    const template = this.buildTemplate(workflow, 'approval_requested');
    return this.dispatchTemplate(workflow, 'approval_requested', template);
  }

  async dispatchApprovalResolved(
    workflow: ApprovalWorkflow,
  ): Promise<NotificationDeliveryRecord[]> {
    const eventType = getResolvedEventType(workflow.status);
    const template = this.buildTemplate(workflow, eventType);
    return this.dispatchTemplate(workflow, eventType, template);
  }

  async dispatchWorkflowState(
    workflow: ApprovalWorkflow,
  ): Promise<NotificationDeliveryRecord[]> {
    if (workflow.status === 'pending') {
      return this.dispatchApprovalRequested(workflow);
    }

    return this.dispatchApprovalResolved(workflow);
  }

  listDeliveries(filters: DeliveryFilters = {}): NotificationDeliveryRecord[] {
    this.hydrateFromStore();
    const limit = filters.limit ?? 50;
    return this.deliveries
      .filter((delivery) => (filters.channel ? delivery.channel === filters.channel : true))
      .filter((delivery) => (filters.status ? delivery.status === filters.status : true))
      .slice(0, limit);
  }

  getSummary(): NotificationDeliverySummary {
    this.hydrateFromStore();
    const summary: NotificationDeliverySummary = {
      total: this.deliveries.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      byChannel: {},
      availableChannels: this.getAvailableChannels(),
    };

    for (const delivery of this.deliveries) {
      if (delivery.status === 'sent') {
        summary.sent += 1;
      } else if (delivery.status === 'failed') {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }

      summary.byChannel[delivery.channel] =
        (summary.byChannel[delivery.channel] ?? 0) + 1;
    }

    return summary;
  }

  clear(): void {
    this.deliveries = [];
    this.hydratedDeliveries = true;
    clearNotificationDeliveries();
  }

  private initializePolicies(): void {
    const persisted = this.loadPolicies();
    for (const channel of ['email', 'slack', 'discord'] as NotificationChannel[]) {
      this.policies.set(channel, persisted.get(channel) ?? {
        channel,
        enabled: true,
        eventTypes: [...ALL_NOTIFICATION_EVENT_TYPES],
      });
    }
  }

  private getPolicy(channel: NotificationChannel): NotificationChannelPolicy {
    const policy = this.policies.get(channel);
    if (policy) {
      return policy;
    }

    return {
      channel,
      enabled: true,
      eventTypes: [...ALL_NOTIFICATION_EVENT_TYPES],
    };
  }

  private getPolicyPath(): string {
    return process.env.NOTIFICATION_POLICY_PATH || DEFAULT_POLICY_PATH;
  }

  private loadPolicies(): Map<NotificationChannel, NotificationChannelPolicy> {
    const result = new Map<NotificationChannel, NotificationChannelPolicy>();
    const policyPath = this.getPolicyPath();

    try {
      if (!fs.existsSync(policyPath)) {
        return result;
      }

      const raw = fs.readFileSync(policyPath, 'utf8');
      const parsed = JSON.parse(raw) as NotificationChannelPolicy[];
      for (const entry of parsed) {
        if (entry && (entry.channel === 'email' || entry.channel === 'slack' || entry.channel === 'discord')) {
          result.set(entry.channel, {
            channel: entry.channel,
            enabled: entry.enabled !== false,
            eventTypes: Array.isArray(entry.eventTypes)
              ? entry.eventTypes.filter((eventType): eventType is NotificationEventType => ALL_NOTIFICATION_EVENT_TYPES.includes(eventType))
              : [...ALL_NOTIFICATION_EVENT_TYPES],
            fallbackChannel: entry.fallbackChannel,
          });
        }
      }
    } catch (error) {
      logWarn('NotificationChannels', `Failed to load notification policies: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  private persistPolicies(): void {
    try {
      const policyPath = this.getPolicyPath();
      const dir = path.dirname(policyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(policyPath, JSON.stringify(this.getPolicies(), null, 2), 'utf8');
    } catch (error) {
      logWarn('NotificationChannels', `Failed to persist notification policies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildTemplate(
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
  ): NotificationTemplate {
    const lines = [
      `Workflow: ${workflow.workflowId}`,
      `Approval ID: ${workflow.approvalRequestId}`,
      `Forrás: ${workflow.source}`,
      `Esemény: ${workflow.eventType}`,
      `Állapot: ${getStatusLabel(workflow.status)}`,
      `Kockázat: ${workflow.decision.actionClass} / ${workflow.decision.riskScore}`,
      `Indok: ${workflow.decision.reason}`,
    ];

    if (workflow.resource) {
      lines.push(`Erőforrás: ${workflow.resource}`);
    }

    if (workflow.agentName) {
      lines.push(`Agent: ${workflow.agentName}`);
    }

    if (workflow.respondedAt) {
      lines.push(`Válasz időpontja: ${workflow.respondedAt}`);
    }

    lines.push(`Approve URL: ${workflow.callback.approveUrl}`);
    lines.push(`Reject URL: ${workflow.callback.rejectUrl}`);

    const title =
      eventType === 'approval_requested'
        ? `Brunella Approval kérés — ${workflow.eventType}`
        : `Brunella Approval státusz — ${workflow.eventType}`;

    const html = [
      `<p><strong>${escapeHtml(title)}</strong></p>`,
      '<ul>',
      ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
      '</ul>',
    ].join('');

    return {
      title,
      text: lines.join('\n'),
      html,
    };
  }

  private async dispatchTemplate(
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
    template: NotificationTemplate,
  ): Promise<NotificationDeliveryRecord[]> {
    const channels = this.getAvailableChannels().filter((channel) => channel.enabled);
    if (channels.length === 0) {
      const skipped = this.recordDelivery({
        workflowId: workflow.workflowId,
        approvalRequestId: workflow.approvalRequestId,
        channel: 'system',
        status: 'skipped',
        eventType,
        title: template.title,
        message: template.text,
        error: 'Nincs konfigurált notification csatorna',
        metadata: {
          workflowStatus: workflow.status,
        },
      });
      logWarn('NotificationChannels', 'No configured notification channel for approval workflow');
      return [skipped];
    }

    const fallbackTargets = new Set<NotificationChannel>(
      channels
        .map((channel) => this.getPolicy(channel.channel).fallbackChannel)
        .filter((channel): channel is NotificationChannel => Boolean(channel)),
    );
    const primaryChannels = channels.filter((channel) => !fallbackTargets.has(channel.channel));
    const channelsToProcess = primaryChannels.length > 0 ? primaryChannels : channels;

    const results: NotificationDeliveryRecord[] = [];
    let deliveredSuccessfully = false;
    for (const channel of channelsToProcess) {
      const policy = this.getPolicy(channel.channel);
      if (!policy.enabled || !policy.eventTypes.includes(eventType)) {
        results.push(this.recordDelivery({
          workflowId: workflow.workflowId,
          approvalRequestId: workflow.approvalRequestId,
          channel: channel.channel,
          status: 'skipped',
          eventType,
          title: template.title,
          message: template.text,
          error: 'Channel policy blocks this event type',
          metadata: {
            workflowStatus: workflow.status,
          },
        }));
        continue;
      }

      const delivery = await this.deliverToChannel(channel.channel, workflow, eventType, template);
      results.push(delivery);
      if (delivery.status === 'sent') {
        deliveredSuccessfully = true;
      } else if (delivery.status === 'failed' && policy.fallbackChannel) {
        const fallbackRecord = await this.dispatchFallbackChannel(policy.fallbackChannel, workflow, eventType, template);
        if (fallbackRecord) {
          results.push(fallbackRecord);
          if (fallbackRecord.status === 'sent') {
            deliveredSuccessfully = true;
          }
        }
      }
    }

    if (!deliveredSuccessfully) {
      const fallbackRecord = await this.dispatchFallbackChannel('email', workflow, eventType, template);
      if (fallbackRecord) {
        results.push(fallbackRecord);
      }
    }

    return results;
  }

  private async dispatchFallbackChannel(
    channel: NotificationChannel,
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
    template: NotificationTemplate,
  ): Promise<NotificationDeliveryRecord | null> {
    const channelAvailability = this.getAvailableChannels().find((item) => item.channel === channel);
    const channelPolicy = this.getPolicy(channel);

    if (!channelAvailability?.enabled || !channelPolicy.enabled || !channelPolicy.eventTypes.includes(eventType)) {
      return null;
    }

    const fallbackTemplate: NotificationTemplate = {
      title: `[Fallback] ${template.title}`,
      text: `${template.text}\n\nFallback channel engaged after primary delivery failure.`,
      html: `${template.html}<p><em>Fallback channel engaged after primary delivery failure.</em></p>`,
    };

    return this.deliverToChannel(channel, workflow, eventType, fallbackTemplate);
  }

  private async deliverToChannel(
    channel: NotificationChannel,
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
    template: NotificationTemplate,
  ): Promise<NotificationDeliveryRecord> {
    const maxAttempts = 2;
    let lastFailure: NotificationDeliveryRecord | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const delivery = await this.deliverToChannelOnce(channel, workflow, eventType, template, attempt);
      if (delivery.status === 'sent' || delivery.status === 'skipped') {
        return delivery;
      }

      lastFailure = delivery;
    }

    return lastFailure ?? this.recordDelivery({
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      channel,
      status: 'failed',
      eventType,
      title: template.title,
      message: template.text,
      error: 'Unknown delivery failure',
      metadata: {
        workflowStatus: workflow.status,
      },
    });
  }

  private async deliverToChannelOnce(
    channel: NotificationChannel,
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
    template: NotificationTemplate,
    attempt: number,
  ): Promise<NotificationDeliveryRecord> {
    try {
      if (channel === 'email') {
        const emailResult = await sendNotificationEmail({
          subject: template.title,
          text: template.text,
          html: template.html,
        });

        return this.recordDelivery({
          workflowId: workflow.workflowId,
          approvalRequestId: workflow.approvalRequestId,
          channel,
          status: emailResult.sent ? 'sent' : 'failed',
          eventType,
          title: template.title,
          message: template.text,
          error: emailResult.sent ? undefined : emailResult.message,
          metadata: {
            workflowStatus: workflow.status,
            attempt,
          },
        });
      }

      if (channel === 'slack') {
        return await this.deliverWebhook(
          process.env.SLACK_WEBHOOK_URL || process.env.BRUNELLA_SLACK_WEBHOOK_URL,
          channel,
          workflow,
          eventType,
          template,
          { text: `${template.title}\n${template.text}` },
          attempt,
        );
      }

      return await this.deliverWebhook(
        process.env.DISCORD_WEBHOOK_URL || process.env.BRUNELLA_DISCORD_WEBHOOK_URL,
        channel,
        workflow,
        eventType,
        template,
        { content: `${template.title}\n${template.text}` },
        attempt,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('NotificationChannels', `${channel} delivery failed: ${message}`);
      return this.recordDelivery({
        workflowId: workflow.workflowId,
        approvalRequestId: workflow.approvalRequestId,
        channel,
        status: 'failed',
        eventType,
        title: template.title,
        message: template.text,
        error: message,
        metadata: {
          workflowStatus: workflow.status,
          attempt,
        },
      });
    }
  }

  private async deliverWebhook(
    url: string | undefined,
    channel: NotificationChannel,
    workflow: ApprovalWorkflow,
    eventType: NotificationEventType,
    template: NotificationTemplate,
    body: Record<string, string>,
    attempt: number,
  ): Promise<NotificationDeliveryRecord> {
    if (!url) {
      return this.recordDelivery({
        workflowId: workflow.workflowId,
        approvalRequestId: workflow.approvalRequestId,
        channel,
        status: 'skipped',
        eventType,
        title: template.title,
        message: template.text,
        error: `${channel} webhook nincs konfigurálva`,
        metadata: {
          workflowStatus: workflow.status,
          attempt,
        },
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`${channel} webhook HTTP ${response.status}`);
    }

    logInfo('NotificationChannels', `${channel} notification delivered for ${workflow.workflowId}`);
    return this.recordDelivery({
      workflowId: workflow.workflowId,
      approvalRequestId: workflow.approvalRequestId,
      channel,
      status: 'sent',
      eventType,
      title: template.title,
      message: template.text,
      metadata: {
        workflowStatus: workflow.status,
        attempt,
      },
    });
  }

  private recordDelivery(
    partial: Omit<NotificationDeliveryRecord, 'id' | 'createdAt'>,
  ): NotificationDeliveryRecord {
    this.hydrateFromStore();
    const record: NotificationDeliveryRecord = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...partial,
    };

    this.deliveries.unshift(record);
    if (this.deliveries.length > HISTORY_LIMIT) {
      this.deliveries = this.deliveries.slice(0, HISTORY_LIMIT);
    }
    saveNotificationDelivery(record);

    return record;
  }
}

export const notificationChannels = new NotificationChannelsService();

export default notificationChannels;
