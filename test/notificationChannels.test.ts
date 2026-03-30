import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { sendNotificationEmailMock } = vi.hoisted(() => ({
  sendNotificationEmailMock: vi.fn().mockResolvedValue({ sent: true, message: 'Email sent' }),
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/utils/notificationService.js', () => ({
  isNotificationEmailConfigured: vi.fn(() => true),
  sendNotificationEmail: sendNotificationEmailMock,
}));

async function freshNotificationModules() {
  vi.resetModules();
  const notificationModule = await import('../src/core/notificationChannels.js');
  return notificationModule;
}

describe('notificationChannels', () => {
  const policyPath = path.join(os.tmpdir(), 'notification-policies-test.json');

  beforeEach(async () => {
    sendNotificationEmailMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    process.env.NOTIFICATION_POLICY_PATH = policyPath;
    if (fs.existsSync(policyPath)) {
      fs.unlinkSync(policyPath);
    }
    const notificationModule = await freshNotificationModules();
    notificationModule.notificationChannels.clear();
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
  });

  it('dispatches approval requested to all configured channels', async () => {
    const notificationModule = await freshNotificationModules();
    const deliveries = await notificationModule.notificationChannels.dispatchApprovalRequested({
      workflowId: 'wf-1',
      approvalRequestId: 'apr-1',
      eventId: 'evt-1',
      status: 'pending',
      createdAt: '2026-03-29T16:00:00.000Z',
      updatedAt: '2026-03-29T16:00:00.000Z',
      timeoutMs: 1000,
      eventType: 'github.workflow_run.failure',
      source: 'github',
      eventPayload: {},
      eventMetadata: {},
      callback: {
        token: 'token-1',
        approveUrl: 'http://localhost:3000/api/v1/developer/approval/apr-1/callback?action=approve&token=token-1',
        rejectUrl: 'http://localhost:3000/api/v1/developer/approval/apr-1/callback?action=reject&token=token-1',
      },
      decision: {
        actionClass: 'guarded',
        riskScore: 70,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'GitHub workflow failure',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
    });

    expect(deliveries).toHaveLength(3);
    expect(deliveries.every((delivery) => delivery.status === 'sent')).toBe(true);
    expect(sendNotificationEmailMock).toHaveBeenCalledTimes(1);
    expect(notificationModule.notificationChannels.getSummary().sent).toBe(3);
  });

  it('records skipped delivery when no channels are configured', async () => {
    const notificationModule = await freshNotificationModules();
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.DISCORD_WEBHOOK_URL;
    sendNotificationEmailMock.mockResolvedValue({ sent: false, message: 'SMTP config missing' });

    const deliveries = await notificationModule.notificationChannels.dispatchWorkflowState({
      workflowId: 'wf-2',
      approvalRequestId: 'apr-2',
      eventId: 'evt-2',
      status: 'expired',
      createdAt: '2026-03-29T16:00:00.000Z',
      updatedAt: '2026-03-29T16:00:00.000Z',
      timeoutMs: 1000,
      eventType: 'scheduler.task.failed',
      source: 'scheduler',
      eventPayload: {},
      eventMetadata: {},
      callback: {
        token: 'token-2',
        approveUrl: 'http://localhost:3000/api/v1/developer/approval/apr-2/callback?action=approve&token=token-2',
        rejectUrl: 'http://localhost:3000/api/v1/developer/approval/apr-2/callback?action=reject&token=token-2',
      },
      decision: {
        actionClass: 'guarded',
        riskScore: 52,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'Task timeout',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
    });

    expect(deliveries.some((delivery) => delivery.status === 'skipped' || delivery.status === 'failed')).toBe(true);
    expect(notificationModule.notificationChannels.listDeliveries().length).toBeGreaterThan(0);
  });

  it('persists notification channel policies and uses email fallback when primaries fail', async () => {
    const notificationModule = await freshNotificationModules();
    sendNotificationEmailMock.mockResolvedValue({ sent: true, message: 'Fallback email sent' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    notificationModule.notificationChannels.updatePolicy('slack', {
      enabled: true,
      eventTypes: ['approval_requested'],
      fallbackChannel: 'email',
    });

    const deliveries = await notificationModule.notificationChannels.dispatchApprovalRequested({
      workflowId: 'wf-3',
      approvalRequestId: 'apr-3',
      eventId: 'evt-3',
      status: 'pending',
      createdAt: '2026-03-29T16:00:00.000Z',
      updatedAt: '2026-03-29T16:00:00.000Z',
      timeoutMs: 1000,
      eventType: 'github.workflow_run.failure',
      source: 'github',
      eventPayload: {},
      eventMetadata: {},
      callback: {
        token: 'token-3',
        approveUrl: 'http://localhost:3000/api/v1/developer/approval/apr-3/callback?action=approve&token=token-3',
        rejectUrl: 'http://localhost:3000/api/v1/developer/approval/apr-3/callback?action=reject&token=token-3',
      },
      decision: {
        actionClass: 'guarded',
        riskScore: 70,
        autonomyLevel: 'low',
        requiresApproval: true,
        reason: 'GitHub workflow failure',
        guardrails: ['require_approval'],
        auditResult: 'ALLOWED',
      },
    });

    expect(fs.existsSync(policyPath)).toBe(true);
    expect(deliveries.some((delivery) => delivery.title.startsWith('[Fallback]'))).toBe(true);
    expect(notificationModule.notificationChannels.getPolicies().find((policy) => policy.channel === 'slack')?.fallbackChannel).toBe('email');
  });
});