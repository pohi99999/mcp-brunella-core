import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHRLeaveRoutes } from '../src/server/routes/hrLeave.js';

const {
  businessJobs,
  approveApprovalMock,
  createCalendarEventMock,
  delegateTaskMock,
  requestApprovalMock,
  respondApprovalMock,
  getBusinessJobsMock,
  getBusinessJobByIdMock,
  saveBusinessJobMock,
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

  const businessJobs = new Map<string, BusinessJobRecord>();

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

  const requestApprovalMock = vi.fn(async () => 'APR-123');
  const respondApprovalMock = vi.fn(() => true);
  const approveApprovalMock = vi.fn();
  const delegateTaskMock = vi.fn(() => Promise.resolve({
    success: true,
    message: 'DigitalHeadhunter review queued',
    data: { recommendation: 'pending_manager_review' },
  }));
  const createCalendarEventMock = vi.fn(async () => ({
    eventId: 'EVT-1',
    htmlLink: 'https://calendar.test/event/1',
  }));

  return {
    businessJobs,
    approveApprovalMock,
    createCalendarEventMock,
    delegateTaskMock,
    requestApprovalMock,
    respondApprovalMock,
    getBusinessJobsMock,
    getBusinessJobByIdMock,
    saveBusinessJobMock,
    updateBusinessJobStatusMock,
  };
});

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegateTask: delegateTaskMock,
  },
}));

vi.mock('../src/utils/db.js', () => ({
  getBusinessJobs: getBusinessJobsMock,
  getBusinessJobById: getBusinessJobByIdMock,
  saveBusinessJob: saveBusinessJobMock,
  updateBusinessJobStatus: updateBusinessJobStatusMock,
}));

vi.mock('../src/utils/approvalManager.js', () => ({
  approvalManager: {
    requestApproval: requestApprovalMock,
    respond: respondApprovalMock,
  },
}));

vi.mock('../src/core/auditLog.js', () => ({
  record: approveApprovalMock,
}));

vi.mock('../src/tools/unifiedWorkspace.js', () => ({
  getWorkspaceClient: vi.fn(async () => ({
    createCalendarEvent: createCalendarEventMock,
  })),
}));

describe('HR Leave Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/hr/leave', createHRLeaveRoutes());

  beforeEach(() => {
    businessJobs.clear();
    approveApprovalMock.mockClear();
    createCalendarEventMock.mockClear();
    delegateTaskMock.mockClear();
    requestApprovalMock.mockClear();
    respondApprovalMock.mockClear();
    getBusinessJobsMock.mockClear();
    getBusinessJobByIdMock.mockClear();
    saveBusinessJobMock.mockClear();
    updateBusinessJobStatusMock.mockClear();
    requestApprovalMock.mockResolvedValue('APR-123');
    respondApprovalMock.mockReturnValue(true);
    delegateTaskMock.mockResolvedValue({
      success: true,
      message: 'DigitalHeadhunter review queued',
      data: { recommendation: 'pending_manager_review' },
    });
    createCalendarEventMock.mockResolvedValue({
      eventId: 'EVT-1',
      htmlLink: 'https://calendar.test/event/1',
    });
  });

  it('GET /hr/leave/jobs should return stored leave jobs', async () => {
    await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    const response = await request(app).get('/hr/leave/jobs');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0].status).toBe('pending_manager_approval');
  });

  it('POST /hr/leave/request should create a pending leave job and approval correlation', async () => {
    const response = await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.jobId).toEqual(expect.any(String));
    expect(response.body.approvalRequestId).toBe('APR-123');
    expect(response.body.result.status).toBe('pending_manager_approval');
    expect(response.body.result.decision).toBe('pending');
    expect(response.body.result.analysisStatus).toBe('completed');
    expect(response.body.decisionEndpoint).toContain(`/hr/leave/decision/${response.body.jobId}`);
    expect(requestApprovalMock).toHaveBeenCalledTimes(1);
    expect(delegateTaskMock).toHaveBeenCalledTimes(1);
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      response.body.jobId,
      'pending_manager_approval',
      expect.stringContaining('"approvalRequestId":"APR-123"'),
    );
  });

  it('POST /hr/leave/decision/:jobId should approve the leave and sync the calendar', async () => {
    const requestResponse = await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    const approveResponse = await request(app)
      .post(`/hr/leave/decision/${requestResponse.body.jobId}`)
      .send({
        action: 'approve',
        decidedBy: 'manager@example.com',
        note: 'Approved for vacation',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.status).toBe('approved');
    expect(approveResponse.body.result.decision).toBe('approved');
    expect(approveResponse.body.result.calendarSyncStatus).toBe('synced');
    expect(approveResponse.body.result.calendarRetryCount).toBe(1);
    expect(approveResponse.body.result.calendarEventId).toBe('EVT-1');
    expect(respondApprovalMock).toHaveBeenCalledWith(
      'APR-123',
      'approve',
      expect.objectContaining({
        decidedBy: 'manager@example.com',
        note: 'Approved for vacation',
        jobId: requestResponse.body.jobId,
      }),
    );
    expect(createCalendarEventMock).toHaveBeenCalledTimes(1);
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      requestResponse.body.jobId,
      'approved',
      expect.stringContaining('"calendarSyncStatus":"synced"'),
    );
  });

  it('POST /hr/leave/decision/:jobId should reject the leave without calendar sync', async () => {
    const requestResponse = await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    const rejectResponse = await request(app)
      .post(`/hr/leave/decision/${requestResponse.body.jobId}`)
      .send({
        action: 'reject',
        decidedBy: 'manager@example.com',
        note: 'Project deadline overlap',
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.success).toBe(true);
    expect(rejectResponse.body.status).toBe('rejected');
    expect(rejectResponse.body.result.decision).toBe('rejected');
    expect(rejectResponse.body.result.calendarSyncStatus).toBe('not_applicable');
    expect(createCalendarEventMock).not.toHaveBeenCalled();
    expect(respondApprovalMock).toHaveBeenCalledWith(
      'APR-123',
      'reject',
      expect.objectContaining({
        decidedBy: 'manager@example.com',
        note: 'Project deadline overlap',
        jobId: requestResponse.body.jobId,
      }),
    );
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      requestResponse.body.jobId,
      'rejected',
      expect.stringContaining('"decision":"rejected"'),
    );
  });

  it('POST /hr/leave/decision/:jobId should record calendar failure after retry', async () => {
    createCalendarEventMock
      .mockRejectedValueOnce(new Error('calendar unavailable'))
      .mockRejectedValueOnce(new Error('calendar still unavailable'));

    const requestResponse = await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    const approveResponse = await request(app)
      .post(`/hr/leave/decision/${requestResponse.body.jobId}`)
      .send({
        action: 'approve',
        decidedBy: 'manager@example.com',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.status).toBe('approved_calendar_failed');
    expect(approveResponse.body.result.decision).toBe('approved');
    expect(approveResponse.body.result.calendarSyncStatus).toBe('failed');
    expect(approveResponse.body.result.calendarRetryCount).toBe(2);
    expect(approveResponse.body.result.calendarError).toBe('calendar still unavailable');
    expect(createCalendarEventMock).toHaveBeenCalledTimes(2);
    expect(updateBusinessJobStatusMock).toHaveBeenCalledWith(
      requestResponse.body.jobId,
      'approved_calendar_failed',
      expect.stringContaining('"calendarSyncStatus":"failed"'),
    );
  });
});
