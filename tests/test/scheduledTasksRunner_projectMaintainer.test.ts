import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduledTasksRunner } from '@apps/mcp-core/server/schedulers/scheduledTasksRunner.js';

const mockDb = {
  prepare: vi.fn(),
};

const ingestProjectMaintainerReportMock = vi.fn();
const crmHarness = vi.hoisted(() => ({
  dispatchDueCrmFollowUpActions: vi.fn(),
}));
const hrTimesheetHarness = vi.hoisted(() => ({
  runMonthlyPayrollExport: vi.fn(),
  runDailyCultureAlerts: vi.fn(),
}));
const schedulerHookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));
const scheduledAgentHarness = vi.hoisted(() => ({
  delegate: vi.fn(async () => ({ success: true, message: 'ok' })),
  delegateTask: vi.fn(async () => ({ success: true, message: 'ok' })),
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn(() => mockDb),
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHook: schedulerHookHarness.fireHook,
  fireHookSafely: schedulerHookHarness.fireHook,
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: scheduledAgentHarness.delegate,
    delegateTask: scheduledAgentHarness.delegateTask,
  },
}));

vi.mock('@apps/mcp-core/server/services/projectMaintainerService.js', () => ({
  runProjectMaintainerReport: vi.fn(async () => ({
    id: 'pmr-1',
    generatedAt: '2026-04-02T22:00:00.000Z',
    triggeredBy: 'scheduler',
    findings: [],
    suggestions: [],
    trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
    dryRun: true,
  })),
  initProjectMaintainerSchema: vi.fn(),
}));

vi.mock('@packages/core-logic/reflectionEngine.js', () => ({
  ReflectionEngine: {
    getInstance: () => ({
      ingestProjectMaintainerReport: ingestProjectMaintainerReportMock,
      runNightlyCycle: vi.fn(),
    }),
  },
}));

vi.mock('@apps/mcp-core/server/services/crmFollowUpExecutionService.js', () => ({
  executeDueCrmFollowUpActions: crmHarness.dispatchDueCrmFollowUpActions,
}));

vi.mock('@apps/mcp-core/server/services/hrTimesheetService.js', () => ({
  runMonthlyPayrollExport: hrTimesheetHarness.runMonthlyPayrollExport,
  runDailyCultureAlerts: hrTimesheetHarness.runDailyCultureAlerts,
  resolveSchedulerExportMonth: vi.fn(() => '2026-03'),
}));

describe('ScheduledTasksRunner project maintainer handler', () => {
  beforeEach(() => {
    ingestProjectMaintainerReportMock.mockReset();
    crmHarness.dispatchDueCrmFollowUpActions.mockReset();
    hrTimesheetHarness.runMonthlyPayrollExport.mockReset();
    hrTimesheetHarness.runDailyCultureAlerts.mockReset();
    schedulerHookHarness.fireHook.mockReset();
    scheduledAgentHarness.delegate.mockReset();
    scheduledAgentHarness.delegateTask.mockReset();
    mockDb.prepare.mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    });
  });

  it('executes project_maintainer handler as dry-run report-only task', async () => {
    const result = await scheduledTasksRunner.executeTask({
      id: 'project-maintainer-nightly',
      title: 'Napi Project Maintainer riport',
      prompt: 'Riport',
      cron_expression: '0 22 * * *',
      handler: 'project_maintainer',
      enabled: true,
      metadata: JSON.stringify({ dryRun: true, triggeredBy: 'scheduler' }),
    });

    expect(result).toEqual(expect.objectContaining({ dryRun: true }));
    expect(ingestProjectMaintainerReportMock).toHaveBeenCalledTimes(1);
  });

  it('executes crm_follow_up_dispatch handler through the CRM helper', async () => {
    crmHarness.dispatchDueCrmFollowUpActions.mockReturnValue({
      generatedAt: '2026-04-05T10:00:00.000Z',
      scanned: 2,
      dispatched: [
        { completed: false, action: { id: 'action-1' } },
      ],
    });

    const result = await scheduledTasksRunner.executeTask({
      id: 'crm-follow-up-dispatch',
      title: 'CRM Follow-Up Due Dispatch',
      prompt: 'Dispatch due CRM follow-up actions for D+3/D+7/D+14 plan steps.',
      cron_expression: '0 * * * *',
      handler: 'crm_follow_up_dispatch',
      enabled: true,
      metadata: JSON.stringify({ dispatchLimit: 25, note: 'scheduler run' }),
    });

    expect(crmHarness.dispatchDueCrmFollowUpActions).toHaveBeenCalledWith({
      limit: 25,
      note: 'scheduler run',
    });
    expect(result).toEqual(expect.objectContaining({ scanned: 2 }));
  });

  it('executes hr_timesheet_monthly_export handler through the timesheet helper', async () => {
    hrTimesheetHarness.runMonthlyPayrollExport.mockResolvedValue({
      success: true,
      runKey: 'hr-timesheet:monthly_export:2026-04',
      month: '2026-04',
      outputFormat: 'csv',
      outputPath: 'data/hr-timesheet/exports/timesheet-export-2026-04.csv',
      csv: 'employeeId,employeeName,month,totalHours\n',
      rows: [],
      totalHours: 0,
      totalEntries: 0,
      employeeCount: 0,
    });

    const result = await scheduledTasksRunner.executeTask({
      id: 'hr-timesheet-monthly-export',
      title: 'HR Timesheet Monthly Payroll Export',
      prompt: 'Generate a payroll-ready CSV export for the prior month.',
      cron_expression: '0 5 1 * *',
      handler: 'hr_timesheet_monthly_export',
      enabled: true,
      metadata: JSON.stringify({ month: '2026-04' }),
    });

    expect(hrTimesheetHarness.runMonthlyPayrollExport).toHaveBeenCalledWith({
      month: '2026-04',
      triggeredBy: 'scheduler',
    });
    expect(result).toEqual(expect.objectContaining({ month: '2026-04' }));
  });

  it('executes hr_timesheet_daily_alerts handler through the timesheet helper', async () => {
    hrTimesheetHarness.runDailyCultureAlerts.mockResolvedValue({
      success: true,
      runKey: 'hr-timesheet:daily_alerts:2026-04-07',
      date: '2026-04-07',
      alerts: [],
      generatedCount: 0,
      suppressedCount: 0,
    });

    const result = await scheduledTasksRunner.executeTask({
      id: 'hr-timesheet-daily-alerts',
      title: 'HR Culture Alerts',
      prompt: 'Generate birthday and work-anniversary reminders from HR profiles.',
      cron_expression: '0 7 * * *',
      handler: 'hr_timesheet_daily_alerts',
      enabled: true,
      metadata: JSON.stringify({ date: '2026-04-07' }),
    });

    expect(hrTimesheetHarness.runDailyCultureAlerts).toHaveBeenCalledWith({
      date: '2026-04-07',
      triggeredBy: 'scheduler',
    });
    expect(result).toEqual(expect.objectContaining({ date: '2026-04-07' }));
  });

  it('emits scheduler hooks and derived cron events for the daily briefing task', async () => {
    scheduledAgentHarness.delegate.mockResolvedValue({
      success: true,
      message: 'briefing delivered',
    });

    const result = await scheduledTasksRunner.executeTask({
      id: 'daily-ai-agent-briefing',
      title: 'Daily AI Agent Briefing',
      prompt: 'Generate daily briefing',
      cron_expression: '0 11 * * *',
      handler: 'agent',
      enabled: true,
      metadata: JSON.stringify({ agentName: 'DailyAgentBriefing' }),
    });

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(schedulerHookHarness.fireHook).toHaveBeenCalledWith(
      'scheduler.task.started',
      expect.objectContaining({ taskId: 'daily-ai-agent-briefing' }),
      expect.anything(),
    );
    expect(schedulerHookHarness.fireHook).toHaveBeenCalledWith(
      'scheduler.task.succeeded',
      expect.objectContaining({ taskId: 'daily-ai-agent-briefing' }),
      expect.anything(),
    );
    expect(schedulerHookHarness.fireHook).toHaveBeenCalledWith(
      'cron:daily:briefing',
      expect.objectContaining({ taskId: 'daily-ai-agent-briefing' }),
      expect.anything(),
    );
  });
});
