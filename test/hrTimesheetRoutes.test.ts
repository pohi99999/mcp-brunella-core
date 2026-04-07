import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHRTimesheetRoutes } from '../src/server/routes/hrTimesheet.js';

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegateTask: vi.fn(() => Promise.resolve({
      success: true,
      data: { entryId: 'TS-123' }
    }))
  }
}));

vi.mock('../src/core/auditLog.js', () => ({
  record: vi.fn(async () => undefined),
}));

describe('HR Timesheet Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/hr/timesheet', createHRTimesheetRoutes());

  it('POST /hr/timesheet/submit should return 200 with valid data', async () => {
    const response = await request(app)
      .post('/hr/timesheet/submit')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        hours: 8,
        taskDescription: 'Coding',
        date: '2026-04-05'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.entryId).toBe('TS-123');
  });

  it('POST /hr/timesheet/submit should return 400 with invalid data', async () => {
    const response = await request(app)
      .post('/hr/timesheet/submit')
      .send({
        employeeId: 'EMP-001',
        hours: 8
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
