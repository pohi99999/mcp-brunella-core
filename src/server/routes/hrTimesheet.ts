import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';
import { ensureError } from '../../utils/ensureError.js';

/**
 * HR Timesheet Management Routes
 * 
 * Endpoints for submitting, updating, and reviewing employee timesheets.
 */

// Zod schema for timesheet submission
const TimesheetSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  date: z.string(), // ISO format YYYY-MM-DD
  hours: z.number().min(0).max(24),
  taskDescription: z.string(),
  projectCode: z.string().optional()
});

export function createHRTimesheetRoutes(): Router {
  const router = Router();

  /**
   * POST /api/v1/hr/timesheet/submit
   * Submit or update a timesheet entry
   */
  router.post('/submit', async (req: Request, res: Response) => {
    try {
      const data = TimesheetSchema.parse(req.body);
      logInfo('HTTP', `Received timesheet submission for ${data.employeeName} on ${data.date}`);

      // Delegate to DigitalHeadhunter (our new HR Assistant)
      const result = await agentManager.delegateTask({
        id: `timesheet-${Date.now()}`,
        instruction: `Process timesheet for ${data.employeeName}: ${data.hours}h on ${data.taskDescription}`,
        context: { type: 'timesheet_management', data: data },
        createdAt: new Date().toISOString()
      });

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        message: result.message || 'Timesheet processed',
        data: result.data
      });

    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        return;
      }
      
      const err = ensureError(error);
      logError('HRTimesheetRoute', `POST /submit failed: ${err.message}`);
      res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
    }
  });

  return router;
}
