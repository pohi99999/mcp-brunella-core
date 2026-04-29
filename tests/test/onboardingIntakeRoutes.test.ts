import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const {
  businessJobs,
  businessLeads,
  getBusinessJobByIdMock,
  getBusinessJobsMock,
  queueTaskMock,
  saveBusinessJobMock,
  saveBusinessLeadMock,
  updateBusinessJobStatusMock,
} = vi.hoisted(() => {
  type BusinessJobRecord = {
    id: string;
    type: string;
    query: string;
    status: string;
    results_json: string | null;
    metadata: string | null;
    created_at: string;
    updated_at: string;
  };

  type BusinessLeadRecord = {
    id: string;
    job_id: string;
    company_name: string;
    contact_email: string | null;
    metadata: string | null;
    outreach_status: string;
  };

  const businessJobs = new Map<string, BusinessJobRecord>();
  const businessLeads: BusinessLeadRecord[] = [];

  const getBusinessJobsMock = vi.fn(async (limit: number, type?: string) => {
    const jobs = Array.from(businessJobs.values())
      .filter((job) => (type ? job.type === type : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return jobs.slice(0, limit);
  });

  const getBusinessJobByIdMock = vi.fn(async (id: string) => businessJobs.get(id) ?? null);

  const saveBusinessJobMock = vi.fn(async (job: {
    id: string;
    type: string;
    query: string;
    metadata?: string;
    status?: string;
    resultsJson?: string;
  }) => {
    const now = new Date().toISOString();
    businessJobs.set(job.id, {
      id: job.id,
      type: job.type,
      query: job.query,
      status: job.status ?? 'pending',
      results_json: job.resultsJson ?? null,
      metadata: job.metadata ?? null,
      created_at: now,
      updated_at: now,
    });
    return job.id;
  });

  const updateBusinessJobStatusMock = vi.fn(async (id: string, status: string, resultsJson?: string) => {
    const existing = businessJobs.get(id);
    if (existing) {
      existing.status = status;
      existing.results_json = resultsJson ?? null;
      existing.updated_at = new Date().toISOString();
    }
  });

  const saveBusinessLeadMock = vi.fn(async (lead: {
    id: string;
    job_id: string;
    company_name: string;
    contact_email?: string;
    metadata?: string;
    outreach_status?: string;
  }) => {
    businessLeads.push({
      id: lead.id,
      job_id: lead.job_id,
      company_name: lead.company_name,
      contact_email: lead.contact_email ?? null,
      metadata: lead.metadata ?? null,
      outreach_status: lead.outreach_status ?? 'pending',
    });
    return lead.id;
  });

  const queueTaskMock = vi.fn(async () => 42);

  return {
    businessJobs,
    businessLeads,
    getBusinessJobByIdMock,
    getBusinessJobsMock,
    queueTaskMock,
    saveBusinessJobMock,
    saveBusinessLeadMock,
    updateBusinessJobStatusMock,
  };
});

vi.mock('@packages/utils/db.js', () => ({
  getBusinessJobById: getBusinessJobByIdMock,
  getBusinessJobs: getBusinessJobsMock,
  saveBusinessJob: saveBusinessJobMock,
  saveBusinessLead: saveBusinessLeadMock,
  updateBusinessJobStatus: updateBusinessJobStatusMock,
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => null),
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    queueTask: queueTaskMock,
  },
}));

import { createOnboardingIntakeRoutes } from '@apps/mcp-core/server/routes/onboardingIntake.js';

describe('Onboarding intake routes', () => {
  const originalSecret = process.env.BRUNELLA_WEBHOOK_SECRET;
  const app = express();
  app.use(express.json());
  app.use('/', createOnboardingIntakeRoutes());

  beforeEach(() => {
    businessJobs.clear();
    businessLeads.length = 0;
    getBusinessJobByIdMock.mockClear();
    getBusinessJobsMock.mockClear();
    queueTaskMock.mockClear();
    saveBusinessJobMock.mockClear();
    saveBusinessLeadMock.mockClear();
    updateBusinessJobStatusMock.mockClear();
    queueTaskMock.mockResolvedValue(42);
    process.env.BRUNELLA_WEBHOOK_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.BRUNELLA_WEBHOOK_SECRET = originalSecret;
  });

  it('rejects intake requests when the webhook token is missing or invalid', async () => {
    const response = await request(app)
      .post('/')
      .send({
        client_name: 'Acme Kft',
        contact_email: 'ops@acme.test',
        form_type: 'kkv_general',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ status: 'error', error: 'Unauthorized' });
    expect(saveBusinessJobMock).not.toHaveBeenCalled();
  });

  it('stores a KKV intake as pending approval and exposes it through the pending queue', async () => {
    const createResponse = await request(app)
      .post('/')
      .set('X-Brunella-Token', 'test-secret')
      .send({
        client_name: 'Acme Kft',
        contact_email: 'ops@acme.test',
        form_type: 'kkv_general',
        pain_point: 'Könyvelés és számla káosz',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe('ok');
    expect(createResponse.body.agent_trigger).toBe('InvoiceAutomation');

    const pendingResponse = await request(app).get('/pending');
    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.count).toBe(1);
    expect(pendingResponse.body.jobs[0]).toEqual(
      expect.objectContaining({
        status: 'pending_approval',
        query: 'Acme Kft | kkv_general',
      }),
    );
    expect(JSON.parse(pendingResponse.body.jobs[0].metadata)).toEqual(
      expect.objectContaining({
        client_name: 'Acme Kft',
        contact_email: 'ops@acme.test',
        agent_trigger: 'InvoiceAutomation',
      }),
    );
  });

  it('accepts premium brand payloads that use brand_name and email fallback fields', async () => {
    const response = await request(app)
      .post('/')
      .set('X-Brunella-Token', 'test-secret')
      .send({
        brand_name: 'Lux Atelier',
        email: 'hello@lux.test',
        form_type: 'premium_brand',
        pilot_product: 'Resort capsule',
      });

    expect(response.status).toBe(201);
    expect(response.body.agent_trigger).toBe('copywriter');
    expect(saveBusinessJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Lux Atelier | premium_brand',
      }),
    );
  });

  it('approves a pending intake, queues the agent task, and stores a lead record', async () => {
    const createResponse = await request(app)
      .post('/')
      .set('X-Brunella-Token', 'test-secret')
      .send({
        client_name: 'Northwind Logistics',
        contact_email: 'hello@northwind.test',
        form_type: 'kkv_general',
        pain_point: 'Készlet / logisztika',
        industry: 'Logisztika',
      });

    const jobId = String(createResponse.body.job_id);
    const approveResponse = await request(app)
      .post(`/${jobId}/approve`)
      .send({});

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        job_id: jobId,
        agent_trigger: 'logistics_dispatcher',
        queued_task_id: 42,
      }),
    );
    expect(queueTaskMock).toHaveBeenCalledWith(
      expect.stringContaining('Northwind Logistics'),
      'logistics_dispatcher',
      expect.objectContaining({
        source: 'onboarding_intake',
        jobId,
        approvedBy: 'dashboard',
      }),
    );
    expect(saveBusinessLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: jobId,
        company_name: 'Northwind Logistics',
        contact_email: 'hello@northwind.test',
        outreach_status: 'approved',
      }),
    );
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      jobId,
      'approved',
      expect.stringContaining('"queued_task_id":42'),
    );

    const pendingResponse = await request(app).get('/pending');
    expect(pendingResponse.body.count).toBe(0);
  });

  it('rejects a pending intake and records the rejection reason', async () => {
    const createResponse = await request(app)
      .post('/')
      .set('X-Brunella-Token', 'test-secret')
      .send({
        client_name: 'Reject Me Kft',
        contact_email: 'reject@acme.test',
        form_type: 'kkv_general',
      });

    const jobId = String(createResponse.body.job_id);
    const rejectResponse = await request(app)
      .post(`/${jobId}/reject`)
      .send({ reason: 'Not a fit' });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body).toEqual({
      status: 'ok',
      job_id: jobId,
      message: 'Elutasítva.',
    });
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      jobId,
      'rejected',
      expect.stringContaining('"reason":"Not a fit"'),
    );
    expect(queueTaskMock).not.toHaveBeenCalled();
  });
});
