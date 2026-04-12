import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { agentManager } from '../../agents/AgentManager.js';
import { record as auditRecord } from '../../core/auditLog.js';
import { initHRTimesheetSchema, recordHRTimesheetSubmission, runDailyCultureAlerts, runMonthlyPayrollExport } from '../services/hrTimesheetService.js';
import { buildHRTimesheetStatusSnapshot } from '../services/hrTimesheetStatusSnapshot.js';
import { ensureError } from '../../utils/ensureError.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logError, logInfo } from '../../utils/logger.js';

/**
 * HR Timesheet Management Routes
 *
 * Endpoints for submitting timesheets, exporting payroll-ready summaries,
 * and generating daily birthday / anniversary alerts.
 */

const TimesheetSchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0).max(24),
  taskDescription: z.string().min(1),
  projectCode: z.string().min(1).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const MonthlyExportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  format: z.literal('csv').optional(),
});

const DailyAlertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function createHRTimesheetRoutes(): Router {
  const router = Router();
  const db = initHRTimesheetSchema(getGlobalDb());

  /**
   * GET /api/v1/hr/timesheet/status
   * Read-only snapshot of the current HR timesheet and culture state.
   */
  router.get('/status', (_req: any, res: any) => {
    try {
      const snapshot = buildHRTimesheetStatusSnapshot(db);
      res.json({ success: true, snapshot, timestamp: snapshot.checkedAt });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HRTimesheetRoute', `GET /status failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  /**
   * POST /api/v1/hr/timesheet/submit
   * Submit or update a timesheet entry.
   */
  router.post('/submit', async (req: any, res: any) => {
    try {
      const data = TimesheetSchema.parse(req.body);
      logInfo('HTTP', `Received timesheet submission for ${data.employeeName} on ${data.date}`);

      const storedEntry = await recordHRTimesheetSubmission(data, undefined, db);

      const result = await agentManager.delegateTask({
        id: `timesheet-${storedEntry.dedupKey}`,
        instruction: `Process timesheet for ${data.employeeName}: ${data.hours}h on ${data.taskDescription}`,
        context: { type: 'timesheet_management', data },
        createdAt: new Date().toISOString(),
      });

      await auditRecord(
        result.success ? 'ALLOWED' : 'DENIED',
        'DigitalHeadhunter',
        'timesheet_management',
        storedEntry.dedupKey,
        result.message,
      );

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message || 'Timesheet processed',
        data: result.data,
        storedEntry,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        return;
      }

      const normalized = ensureError(error);
      logError('HRTimesheetRoute', `POST /submit failed: ${normalized.message}`);
      await auditRecord('DENIED', 'HRTimesheetRoute', 'timesheet_management', 'validation-or-runtime-error', normalized.message);
      res.status(500).json({ success: false, error: 'Internal server error', message: normalized.message });
    } finally {
      // No per-request cleanup needed; persistence is handled by the shared database.
    }
  });

  /**
   * POST /api/v1/hr/timesheet/export/monthly
   * Generate the payroll-ready CSV export for a month.
   */
  router.post('/export/monthly', async (req: any, res: any) => {
    try {
      const { month, format } = MonthlyExportSchema.parse(req.body ?? {});
      const exportResult = await runMonthlyPayrollExport({
        month,
        triggeredBy: 'api',
        database: db,
      });

      res.status(200).json({
        requestedFormat: format ?? 'csv',
        ...exportResult,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        return;
      }

      const normalized = ensureError(error);
      logError('HRTimesheetRoute', `POST /export/monthly failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    } finally {
      // No per-request cleanup needed.
    }
  });

  /**
   * POST /api/v1/hr/timesheet/alerts/daily
   * Generate birthday and anniversary alerts for a day.
   */
  router.post('/alerts/daily', async (req: any, res: any) => {
    try {
      const { date } = DailyAlertSchema.parse(req.body ?? {});
      const alertResult = await runDailyCultureAlerts({
        date,
        triggeredBy: 'api',
        database: db,
      });

      res.status(200).json({
        ...alertResult,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        return;
      }

      const normalized = ensureError(error);
      logError('HRTimesheetRoute', `POST /alerts/daily failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    } finally {
      // No per-request cleanup needed.
    }
  });

  return router;
}
