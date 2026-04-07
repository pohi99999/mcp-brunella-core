import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getBusinessJobs, saveBusinessJob } from '../../utils/db.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';

/**
 * HR Leave Approval Routes
 * 
 * Endpoints for managing employee leave requests, approval flows,
 * and synchronization with enterprise calendars.
 */

export function createHRLeaveRoutes(): Router {
  const router = Router();

  /**
   * GET /api/v1/hr/leave/jobs
   * Lists recent leave approval requests and their statuses.
   */
  router.get('/jobs', async (req, res) => {
    try {
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 10;
      const jobs = await getBusinessJobs(limit, 'hr_leave_approval');
      res.json({ success: true, jobs });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HRLeaveRoute', `GET /jobs failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: 'Failed to list leave approval jobs' });
    }
  });

  /**
   * POST /api/v1/hr/leave/request
   * Submits a new leave request for automated processing and approval.
   */
  router.post('/request', async (req, res) => {
    try {
      const { employeeId, employeeName, startDate, endDate, leaveType, reason } = req.body;

      if (!employeeId || !employeeName || !startDate || !endDate || !leaveType) {
        return res.status(400).json({ success: false, error: 'Missing required leave request fields' });
      }

      const jobId = uuidv4();
      const query = `Leave Request: ${employeeName} (${startDate} - ${endDate})`;

      // Initial state: pending_manager_approval
      await saveBusinessJob({
        id: jobId,
        type: 'hr_leave_approval',
        query,
        metadata: JSON.stringify({
          employeeId,
          employeeName,
          startDate,
          endDate,
          leaveType,
          reason,
          status: 'pending_manager_approval',
          submittedAt: new Date().toISOString()
        }),
        status: 'in-progress',
        resultsJson: JSON.stringify({
          status: 'pending',
          message: 'Leave request submitted and awaiting manager approval.'
        }),
      });

      logInfo('HRLeaveRoute', `Leave request ${jobId} submitted for ${employeeName}`);

      res.status(201).json({
        success: true,
        jobId,
        message: 'Leave request submitted successfully. Brunella is now orchestrating the approval flow.'
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HRLeaveRoute', `POST /request failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  return router;
}

export default createHRLeaveRoutes;
