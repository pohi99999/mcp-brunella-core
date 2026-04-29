import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHRTimesheetRoutes } from '@apps/mcp-core/server/routes/hrTimesheet.js';

const harness = vi.hoisted(() => ({
  db: undefined as Database.Database | undefined,
  delegateTask: vi.fn(),
  auditRecord: vi.fn(async () => undefined),
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegateTask: harness.delegateTask,
  },
}));

vi.mock('@packages/core-logic/auditLog.js', () => ({
  record: harness.auditRecord,
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => {
    if (!harness.db) {
      throw new Error('test database not initialized');
    }

    return harness.db;
  }),
}));

describe('HR Timesheet Routes', () => {
  function buildApp(): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/hr/timesheet', createHRTimesheetRoutes());
    return app;
  }

  beforeEach(() => {
    harness.db = new Database(':memory:');
    harness.delegateTask.mockReset();
    harness.auditRecord.mockReset();
    harness.delegateTask.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { entryId: 'TS-123' },
    });
  });

  afterEach(() => {
    harness.db?.close();
    harness.db = undefined;
  });

  it('POST /hr/timesheet/submit should persist a timesheet and return the agent result', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/hr/timesheet/submit')
      .send({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        hours: 8,
        taskDescription: 'Coding',
        date: '2026-04-05',
        birthDate: '1990-04-07',
        hireDate: '2020-04-07',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.entryId).toBe('TS-123');
    expect(response.body.storedEntry.dedupKey).toBe('EMP-001:2026-04-05');

    const storedEntry = harness.db?.prepare('SELECT * FROM hr_timesheet_entries WHERE dedup_key = ?').get('EMP-001:2026-04-05') as { employee_name: string; hours: number } | undefined;
    expect(storedEntry?.employee_name).toBe('John Doe');
    expect(storedEntry?.hours).toBe(8);

    const profile = harness.db?.prepare('SELECT * FROM hr_employee_profiles WHERE employee_id = ?').get('EMP-001') as { birth_date: string | null; hire_date: string | null } | undefined;
    expect(profile?.birth_date).toBe('1990-04-07');
    expect(profile?.hire_date).toBe('2020-04-07');
  });

  it('POST /hr/timesheet/export/monthly should return payroll-ready CSV and stay idempotent', async () => {
    const app = buildApp();

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      hours: 8,
      taskDescription: 'Coding',
      date: '2026-04-05',
      projectCode: 'KKV',
    });

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      hours: 4,
      taskDescription: 'Review',
      date: '2026-04-06',
      projectCode: 'KKV',
    });

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-002',
      employeeName: 'Jane Roe',
      hours: 6,
      taskDescription: 'Reporting',
      date: '2026-04-06',
      projectCode: 'HR',
    });

    const first = await request(app)
      .post('/hr/timesheet/export/monthly')
      .send({ month: '2026-04' });

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.outputFormat).toBe('csv');
    expect(first.body.month).toBe('2026-04');
    expect(first.body.rows).toHaveLength(2);
    expect(first.body.csv).toContain('employeeId,employeeName,month,totalHours');
    expect(first.body.csv).toContain('EMP-001');
    expect(first.body.csv).toContain('12.00');

    const second = await request(app)
      .post('/hr/timesheet/export/monthly')
      .send({ month: '2026-04' });

    expect(second.status).toBe(200);
    expect(second.body.runKey).toBe(first.body.runKey);
    expect(second.body.outputPath).toBe(first.body.outputPath);

    const runs = harness.db?.prepare('SELECT COUNT(*) as count FROM hr_timesheet_automation_runs WHERE run_type = ?').get('monthly_export') as { count: number } | undefined;
    expect(runs?.count).toBe(1);
    expect(harness.auditRecord).toHaveBeenCalledWith(
      'ALLOWED',
      'HRTimesheetExport',
      'monthly_export',
      'hr-timesheet:monthly_export:2026-04',
      expect.any(String),
    );
  });

  it('POST /hr/timesheet/alerts/daily should generate alerts once and suppress duplicates', async () => {
    const app = buildApp();

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-100',
      employeeName: 'Nora',
      hours: 8,
      taskDescription: 'Ops',
      date: '2026-04-07',
      birthDate: '1990-04-07',
      hireDate: '2020-04-07',
    });

    const first = await request(app)
      .post('/hr/timesheet/alerts/daily')
      .send({ date: '2026-04-07' });

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.generatedCount).toBe(2);
    expect(first.body.suppressedCount).toBe(0);
    expect(first.body.alerts).toHaveLength(2);

    const second = await request(app)
      .post('/hr/timesheet/alerts/daily')
      .send({ date: '2026-04-07' });

    expect(second.status).toBe(200);
    expect(second.body.generatedCount).toBe(0);
    expect(second.body.suppressedCount).toBe(2);

    const alerts = harness.db?.prepare('SELECT COUNT(*) as count FROM hr_timesheet_alert_events').get() as { count: number } | undefined;
    expect(alerts?.count).toBe(2);
    expect(harness.auditRecord).toHaveBeenCalledWith(
      'ALLOWED',
      'HRTimesheetAlerts',
      'daily_alerts',
      'hr-timesheet:daily_alerts:2026-04-07',
      expect.any(String),
    );
  });

  it('GET /hr/timesheet/status should return the shared read-only snapshot', async () => {
    const app = buildApp();

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      hours: 8,
      taskDescription: 'Coding',
      date: '2026-04-05',
      birthDate: '1990-04-07',
      hireDate: '2020-04-07',
    });

    await request(app).post('/hr/timesheet/submit').send({
      employeeId: 'EMP-002',
      employeeName: 'Jane Roe',
      hours: 6,
      taskDescription: 'Reporting',
      date: '2026-04-06',
    });

    const exportResponse = await request(app)
      .post('/hr/timesheet/export/monthly')
      .send({ month: '2026-04' });

    expect(exportResponse.status).toBe(200);

    const alertResponse = await request(app)
      .post('/hr/timesheet/alerts/daily')
      .send({ date: '2026-04-07' });

    expect(alertResponse.status).toBe(200);

    const response = await request(app).get('/hr/timesheet/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.timestamp).toBeTruthy();
    expect(response.body.snapshot.headline).toBe('HR timesheet and culture flow is healthy.');
    expect(response.body.snapshot.counts).toEqual({
      entries: 2,
      employees: 2,
      monthlyExports: 1,
      dailyAlertRuns: 1,
    });
    expect(response.body.snapshot.latestMonthlyExport).toMatchObject({
      month: '2026-04',
      status: 'completed',
      employeeCount: 2,
      totalEntries: 2,
      totalHours: 14,
    });
    expect(response.body.snapshot.latestDailyAlert).toMatchObject({
      date: '2026-04-07',
      status: 'completed',
      generatedCount: 2,
      suppressedCount: 0,
    });
    expect(response.body.snapshot.alertTotalsByType).toEqual({
      birthday: 1,
      anniversary: 1,
    });
  });
});
