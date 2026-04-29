import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildHROnboardingDryRunReport } from '@packages/utils/hrOnboardingDryRun.js';

describe('HR onboarding dry-run helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns ready when required payload and integrations are present', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'hr-onboarding-ready-'));

    try {
      const workspaceCredentials = path.join(cwd, 'workspace-credentials.json');
      const workspaceToken = path.join(cwd, 'workspace-token.json');
      await writeFile(workspaceCredentials, '{}');
      await writeFile(workspaceToken, '{}');

      vi.stubEnv('GOOGLE_WORKSPACE_CREDENTIALS_FILE', workspaceCredentials);
      vi.stubEnv('GOOGLE_WORKSPACE_TOKEN_FILE', workspaceToken);
      vi.stubEnv('SMTP_HOST', 'smtp.example.com');
      vi.stubEnv('SMTP_PORT', '587');
      vi.stubEnv('SMTP_USER', 'mailer@example.com');
      vi.stubEnv('SMTP_PASS', 'secret');
      vi.stubEnv('SMTP_FROM', 'brunella@example.com');
      vi.stubEnv('SMTP_TO', 'hr@example.com');
      vi.stubEnv('SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T000/B000/READY');
      vi.stubEnv('N8N_API_KEY', 'n8n-secret');

      const report = buildHROnboardingDryRunReport({
        employeeName: 'Kiss Anna',
        email: 'anna.kiss@example.com',
        jobTitle: 'HR generalist',
        department: 'HR',
        managerEmail: 'lead@example.com',
        startDate: '2026-04-15',
        location: 'Budapest',
        timezone: 'Europe/Budapest',
        trigger: 'webhook',
        source: 'dashboard',
        checklist: ['Create workspace', 'Send welcome email'],
      });

      expect(report.report.status).toBe('ready');
      expect(report.report.summary).toEqual({
        total: 8,
        ready: 8,
        blocked: 0,
      });
      expect(report.report.checklist.every((item) => item.state === 'ready')).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('blocks the dry-run when the workspace integrations are missing', async () => {
    // Explicitly point to non-existent files to ensure 'blocked' status
    vi.stubEnv('GOOGLE_WORKSPACE_CREDENTIALS_FILE', '/tmp/non-existent-creds.json');
    vi.stubEnv('GOOGLE_WORKSPACE_TOKEN_FILE', '/tmp/non-existent-token.json');
    vi.stubEnv('SMTP_HOST', ''); // Disable email
    vi.stubEnv('SLACK_WEBHOOK_URL', ''); // Disable slack

    const report = buildHROnboardingDryRunReport({
      employeeName: 'Kiss Anna',
      email: 'anna.kiss@example.com',
      jobTitle: 'HR generalist',
      department: 'HR',
      managerEmail: 'lead@example.com',
      startDate: '2026-04-15',
      location: 'Budapest',
      timezone: 'Europe/Budapest',
      trigger: 'webhook',
      source: 'dashboard',
      checklist: ['Create workspace', 'Send welcome email'],
    });

    expect(report.report.status).toBe('blocked');
    expect(report.report.summary.blocked).toBeGreaterThan(0);
    expect(report.report.checklist.some((item) => item.state === 'needs-setup')).toBe(true);
    expect(report.report.nextSteps.length).toBeGreaterThan(0);
  });
});
