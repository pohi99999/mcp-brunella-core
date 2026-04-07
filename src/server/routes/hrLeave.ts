import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { agentManager } from '../../agents/AgentManager.js';
import { record as auditRecord } from '../../core/auditLog.js';
import { getBusinessJobs, saveBusinessJob, updateBusinessJobStatus } from '../../utils/db.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';
import { getWorkspaceClient } from '../../tools/unifiedWorkspace.js';

/**
 * HR Leave Approval Routes
 * 
 * Endpoints for managing employee leave requests, approval flows,
 * and synchronization with enterprise calendars.
 */

export function createHRLeaveRoutes(): Router {
  const router = Router();

  function normalizeLeaveType(value: unknown): 'vacation' | 'sick' | 'personal' | 'other' {
    const normalized = typeof value === 'string' ? value.toLowerCase() : '';
    return normalized === 'vacation' || normalized === 'sick' || normalized === 'personal' ? normalized : 'other';
  }

  function buildCalendarEvent(employeeName: string, startDate: string, endDate: string, leaveType: string, reason?: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid leave dates');
    }

    return {
      summary: `OOO: ${employeeName}`,
      description: [
        `Leave type: ${leaveType}`,
        reason ? `Reason: ${reason}` : null,
      ].filter(Boolean).join('\n'),
      start: { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: 'UTC' },
    };
  }

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

      const normalizedLeaveType = normalizeLeaveType(leaveType);
      const jobId = uuidv4();
      const query = `Leave Request: ${employeeName} (${startDate} - ${endDate})`;
      const submittedAt = new Date().toISOString();

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
          leaveType: normalizedLeaveType,
          reason,
          status: 'pending_manager_approval',
          submittedAt
        }),
        status: 'in-progress',
        resultsJson: JSON.stringify({
          status: 'pending',
          message: 'Leave request submitted and awaiting manager approval.'
        }),
      });

      logInfo('HRLeaveRoute', `Leave request ${jobId} submitted for ${employeeName}`);
      await auditRecord('ALLOWED', 'HRLeaveRoute', 'submit', `${employeeName}:${startDate}-${endDate}`);

      const agentResult = await agentManager.delegateTask({
        id: jobId,
        instruction: `Approve leave request for ${employeeName} (${startDate} to ${endDate})`,
        context: {
          type: 'leave_approval',
          data: {
            jobId,
            employeeId,
            employeeName,
            startDate,
            endDate,
            leaveType: normalizedLeaveType,
            reason,
            status: 'pending_manager_approval',
            submittedAt,
          },
        },
        createdAt: submittedAt,
      });

      const rawResult = agentResult.data && typeof agentResult.data === 'object' ? agentResult.data as Record<string, unknown> : {};
      const decision = typeof rawResult.decision === 'string' ? rawResult.decision : undefined;
      let calendarSyncStatus = typeof rawResult.calendarSyncStatus === 'string' ? rawResult.calendarSyncStatus : 'pending';
      let calendarEventId: string | undefined;
      let calendarEventLink: string | undefined;

      if (agentResult.success && decision === 'approved') {
        try {
          const workspace = await getWorkspaceClient();
          const created = await workspace.createCalendarEvent(
            buildCalendarEvent(employeeName, startDate, endDate, normalizedLeaveType, reason),
          );
          calendarSyncStatus = 'synced';
          calendarEventId = created.eventId;
          calendarEventLink = created.htmlLink;
        } catch (error: unknown) {
          const normalized = ensureError(error);
          logError('HRLeaveRoute', `Calendar sync failed for ${jobId}: ${normalized.message}`);
          calendarSyncStatus = 'failed';
        }
      }

      const resultPayload = {
        ...rawResult,
        calendarSyncStatus,
        ...(calendarEventId ? { calendarEventId } : {}),
        ...(calendarEventLink ? { calendarEventLink } : {}),
      };

      await updateBusinessJobStatus(
        jobId,
        agentResult.success ? 'completed' : 'failed',
        JSON.stringify({
          success: agentResult.success,
          message: agentResult.message,
          data: resultPayload,
        }),
      );

      await auditRecord(
        agentResult.success ? 'ALLOWED' : 'DENIED',
        'DigitalHeadhunter',
        'leave_approval',
        jobId,
        agentResult.message || 'Leave request processed',
      );

      res.status(201).json({
        success: true,
        jobId,
        message: 'Leave request submitted successfully. Brunella is now orchestrating the approval flow.',
        result: resultPayload,
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
