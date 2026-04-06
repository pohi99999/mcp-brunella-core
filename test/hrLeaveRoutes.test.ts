import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHRLeaveRoutes } from '../src/server/routes/hrLeave.js';

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegateTask: vi.fn(() => Promise.resolve({ status: 'success', data: { jobId: 'JOB-123' } }))
  }
}));

describe('HR Leave Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/hr/leave', createHRLeaveRoutes());

  it('GET /hr/leave/jobs should return 200', async () => {
    const response = await request(app).get('/hr/leave/jobs');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('POST /hr/leave/request should return 201', async () => {
    const response = await request(app)
      .post('/hr/leave/request')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'VACATION',
        startDate: '2026-05-01',
        endDate: '2026-05-10'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.jobId).toEqual(expect.any(String));
  });
});