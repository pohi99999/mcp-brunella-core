import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHROnboardingRoutes } from '@apps/mcp-core/server/routes/hrOnboarding.js';

const { buildReportMock, samplesMock, jobsMock, saveJobMock } = vi.hoisted(() => ({
  buildReportMock: vi.fn(),
  samplesMock: vi.fn(),
  jobsMock: vi.fn(),
  saveJobMock: vi.fn(),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@packages/utils/db.js', () => ({
  getBusinessJobs: jobsMock,
  saveBusinessJob: saveJobMock,
}));

vi.mock('@packages/utils/hrOnboardingDryRun.js', () => ({
  buildHROnboardingDryRunReport: buildReportMock,
}));

vi.mock('@packages/utils/hrOnboarding.js', () => ({
  getHROnboardingSamplePayloads: samplesMock,
}));

describe('HR onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    samplesMock.mockReturnValue([
      {
        key: 'webhook-new-hire',
        label: 'Webhook new hire',
        description: 'Teljes onboarding webhook payload.',
        payload: { employeeName: 'Kiss Anna' },
      },
    ]);
    jobsMock.mockResolvedValue([
      {
        id: 'job-1',
        type: 'hr_onboarding',
        status: 'completed',
        query: 'Kiss Anna · HR generalist',
        results_json: JSON.stringify({
          report: {
            status: 'ready',
            summary: { total: 8, ready: 8, blocked: 0 },
            nextSteps: ['Ready'],
          },
        }),
        metadata: JSON.stringify({ trigger: 'webhook' }),
        created_at: '2026-04-04T12:00:00.000Z',
        updated_at: '2026-04-04T12:00:00.000Z',
      },
    ]);
    buildReportMock.mockReturnValue({
      normalized: {
        employeeId: 'EMP-1',
        employeeName: 'Kiss Anna',
        email: 'anna.kiss@example.com',
        jobTitle: 'HR generalist',
        department: 'HR',
        managerName: null,
        managerEmail: 'lead@example.com',
        startDate: '2026-04-15',
        location: null,
        timezone: null,
        trigger: 'webhook',
        source: 'dashboard',
        checklist: ['Create workspace'],
        requestedIntegrations: {
          email: true,
          slack: true,
          calendar: true,
          googleWorkspace: true,
        },
      },
      report: {
        status: 'blocked',
        timestamp: '2026-04-04T12:00:00.000Z',
        summary: { total: 1, ready: 0, blocked: 1 },
        missing: ['email'],
        issues: [],
        checklist: [
          {
            id: 'workspace',
            label: 'Google Workspace provisioning dry-run',
            required: true,
            state: 'needs-setup',
            details: 'Workspace auth missing.',
          },
        ],
        integrations: [
          {
            channel: 'googleWorkspace',
            available: false,
            details: 'Workspace auth missing.',
          },
        ],
        nextSteps: ['Configure googleWorkspace support before live onboarding.'],
      },
    });
    saveJobMock.mockResolvedValue('job-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/hr-onboarding', createHROnboardingRoutes());
    return app;
  }

  it('returns samples, jobs and stores dry-run results', async () => {
    const app = createApp();

    const sampleResponse = await request(app).get('/api/v1/hr-onboarding/samples');
    expect(sampleResponse.status).toBe(200);
    expect(sampleResponse.body.samples).toHaveLength(1);
    expect(samplesMock).toHaveBeenCalledTimes(1);

    const jobsResponse = await request(app).get('/api/v1/hr-onboarding/jobs').query({ limit: ' 999 ' });
    expect(jobsResponse.status).toBe(200);
    expect(jobsResponse.body.jobs).toHaveLength(1);
    expect(jobsMock).toHaveBeenCalledWith(50, 'hr_onboarding');

    const dryRunResponse = await request(app)
      .post('/api/v1/hr-onboarding/dry-run')
      .send({ employeeName: 'Kiss Anna', email: 'anna.kiss@example.com' });

    expect(dryRunResponse.status).toBe(201);
    expect(dryRunResponse.body.report.status).toBe('blocked');
    expect(buildReportMock).toHaveBeenCalledWith({ employeeName: 'Kiss Anna', email: 'anna.kiss@example.com' });
    expect(dryRunResponse.body.jobId).toEqual(expect.any(String));
    expect(saveJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'hr_onboarding',
        status: 'blocked',
        query: 'Kiss Anna · HR generalist',
      }),
    );
    const savedJob = saveJobMock.mock.calls[0]?.[0] as { id?: string } | undefined;
    expect(savedJob?.id).toBe(dryRunResponse.body.jobId);
  });
});
