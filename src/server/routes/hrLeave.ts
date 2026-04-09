import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { agentManager } from '../../agents/AgentManager.js';
import { record as auditRecord } from '../../core/auditLog.js';
import { fireHookSafely } from '../../core/hookRegistry.js';
import { approvalManager, type ApprovalAction } from '../../utils/approvalManager.js';
import { getBusinessJobById, getBusinessJobs, saveBusinessJob, updateBusinessJobStatus } from '../../utils/db.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';
import { getWorkspaceClient } from '../../tools/unifiedWorkspace.js';

/**
 * HR Leave Approval Routes
 * 
 * Endpoints for managing employee leave requests, approval flows,
 * and synchronization with enterprise calendars.
 */

export function createHRLeaveRoutes(): Router {
  const router = Router();
  const approvalTimeoutMs = 15 * 60 * 1000;

  function normalizeLeaveType(value: unknown): 'vacation' | 'sick' | 'personal' | 'other' {
    const normalized = typeof value === 'string' ? value.toLowerCase() : '';
    return normalized === 'vacation' || normalized === 'sick' || normalized === 'personal' ? normalized : 'other';
  }

  function parseRecord(value: string | null | undefined): Record<string, unknown> {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logWarn('HRLeaveRoute', `Failed to parse stored JSON payload: ${normalized.message}`);
      return {};
    }
  }

  function toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  function getDecisionAction(value: unknown): ApprovalAction | null {
    return value === 'approve' || value === 'reject' ? value : null;
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

  async function attemptCalendarCreation(
    employeeName: string,
    startDate: string,
    endDate: string,
    leaveType: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    attempts: number;
    calendarEventId?: string;
    calendarEventLink?: string;
    error?: string;
  }> {
    try {
      const event = buildCalendarEvent(employeeName, startDate, endDate, leaveType, reason);
      const workspace = await getWorkspaceClient();
      let lastError: string | undefined;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const created = await workspace.createCalendarEvent(event);
          return {
            success: true,
            attempts: attempt,
            calendarEventId: created.eventId,
            calendarEventLink: created.htmlLink,
          };
        } catch (error: unknown) {
          const normalized = ensureError(error);
          lastError = normalized.message;
          logWarn('HRLeaveRoute', `Calendar sync attempt ${attempt} failed: ${normalized.message}`);
        }
      }

      return {
        success: false,
        attempts: 2,
        error: lastError ?? 'Calendar sync failed',
      };
    } catch (error: unknown) {
      const normalized = ensureError(error);
      return {
        success: false,
        attempts: 0,
        error: normalized.message,
      };
    }
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
      const approvalRequestId = await approvalManager.requestApproval(
        'critical_action',
        `Manager approval required for ${employeeName}'s leave request`,
        {
          jobId,
          employeeId,
          employeeName,
          startDate,
          endDate,
          leaveType: normalizedLeaveType,
          reason,
          source: 'hr_leave_route',
        },
        approvalTimeoutMs,
      );

      await saveBusinessJob({
        id: jobId,
        type: 'hr_leave_approval',
        query,
        status: 'pending_manager_approval',
        metadata: JSON.stringify({
          employeeId,
          employeeName,
          startDate,
          endDate,
          leaveType: normalizedLeaveType,
          reason,
          status: 'pending_manager_approval',
          approvalRequestId,
          submittedAt
        }),
        resultsJson: JSON.stringify({
          status: 'pending',
          approvalRequestId,
          decision: 'pending',
          analysisStatus: 'queued',
          message: 'Leave request submitted and awaiting manager approval.'
        }),
      });

      await fireHookSafely('hr:leave:requested', {
        jobId,
        employeeId,
        employeeName,
        startDate,
        endDate,
        leaveType: normalizedLeaveType,
        reason,
        approvalRequestId,
        submittedAt,
      }, {
        source: 'hr-leave-route',
        metadata: { jobId, approvalRequestId },
        logContext: 'HRLeaveRoute',
      });

      logInfo('HRLeaveRoute', `Leave request ${jobId} submitted for ${employeeName}`);
      await auditRecord('ALLOWED', 'HRLeaveRoute', 'submit', `${employeeName}:${startDate}-${endDate}`);

      let analysisStatus = 'pending';
      let analysisMessage = 'Waiting for manager decision';
      let analysisRecommendation: string | undefined;
      try {
        const agentResult = await agentManager.delegateTask({
          id: jobId,
          instruction: `Review leave request for ${employeeName} (${startDate} to ${endDate}). Do not finalize; wait for manager decision.`,
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
              approvalRequestId,
              submittedAt,
            },
          },
          createdAt: submittedAt,
        });

        analysisStatus = agentResult.success ? 'completed' : 'failed';
        analysisMessage = agentResult.message || analysisMessage;
        const rawResult = agentResult.data && typeof agentResult.data === 'object'
          ? agentResult.data as Record<string, unknown>
          : {};
        analysisRecommendation = toOptionalString(rawResult.recommendation)
          ?? toOptionalString(rawResult.decision);
      } catch (error: unknown) {
        const normalized = ensureError(error);
        analysisStatus = 'failed';
        analysisMessage = normalized.message;
        logError('HRLeaveRoute', `DigitalHeadhunter analysis failed for ${jobId}: ${normalized.message}`);
      }

      const resultPayload = {
        status: 'pending_manager_approval',
        approvalRequestId,
        decision: 'pending',
        analysisStatus,
        analysisMessage,
        ...(analysisRecommendation ? { analysisRecommendation } : {}),
        message: 'Leave request submitted and awaiting manager approval.',
      };

      await updateBusinessJobStatus(jobId, 'pending_manager_approval', JSON.stringify(resultPayload));

      res.status(201).json({
        success: true,
        jobId,
        approvalRequestId,
        decisionEndpoint: `/api/v1/hr/leave/decision/${jobId}`,
        message: 'Leave request submitted successfully. Brunella is now orchestrating the approval flow.',
        result: resultPayload,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HRLeaveRoute', `POST /request failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  /**
   * POST /api/v1/hr/leave/decision/:jobId
   * Manager decision endpoint for the leave wait/resume track.
   * Body: { action: 'approve' | 'reject', decidedBy?: string, note?: string }
   * On approve, the job resumes and attempts calendar creation with retry.
   */
  router.post('/decision/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const action = getDecisionAction(req.body?.action);
      if (!action) {
        res.status(400).json({ success: false, error: 'action must be approve or reject' });
        return;
      }

      const job = await getBusinessJobById(jobId);
      if (!job || job.type !== 'hr_leave_approval') {
        res.status(404).json({ success: false, error: 'Leave request not found' });
        return;
      }

      if (job.status !== 'pending_manager_approval') {
        res.status(409).json({ success: false, error: `Leave request is not pending approval (current status: ${job.status})` });
        return;
      }

      const metadata = parseRecord(job.metadata);
      const results = parseRecord(job.results_json);
      const approvalRequestId = toOptionalString(metadata.approvalRequestId) ?? toOptionalString(results.approvalRequestId);
      if (!approvalRequestId) {
        res.status(409).json({ success: false, error: 'Leave request is missing approval correlation data' });
        return;
      }

      const decidedBy = toOptionalString(req.body?.decidedBy) ?? 'manager';
      const note = toOptionalString(req.body?.note);
      const approvalResponded = approvalManager.respond(approvalRequestId, action, {
        decidedBy,
        note,
        jobId,
        resumedAt: new Date().toISOString(),
      });

      if (!approvalResponded) {
        res.status(409).json({ success: false, error: 'Approval request is no longer pending' });
        return;
      }

      const employeeName = toOptionalString(metadata.employeeName) ?? 'Unknown employee';
      const startDate = toOptionalString(metadata.startDate);
      const endDate = toOptionalString(metadata.endDate);
      const leaveType = toOptionalString(metadata.leaveType) ?? 'other';
      const reason = toOptionalString(metadata.reason);
      const reviewedAt = new Date().toISOString();

      const auditResource = `${jobId}:${employeeName}:${startDate ?? 'unknown'}-${endDate ?? 'unknown'}`;

      if (action === 'reject') {
        const rejectedResults = {
          ...results,
          status: 'rejected',
          decision: 'rejected',
          approvalRequestId,
          decidedBy,
          note,
          reviewedAt,
          calendarSyncStatus: 'not_applicable',
        };

        await updateBusinessJobStatus(jobId, 'rejected', JSON.stringify(rejectedResults));
        await auditRecord('DENIED', 'ManagerApproval', 'hr_leave_decision', auditResource, note || 'Leave request rejected by manager');

        res.json({
          success: true,
          jobId,
          status: 'rejected',
          result: rejectedResults,
        });
        return;
      }

      if (!startDate || !endDate) {
        const failedResults = {
          ...results,
          status: 'approved_calendar_failed',
          decision: 'approved',
          approvalRequestId,
          decidedBy,
          note,
          reviewedAt,
          calendarSyncStatus: 'failed',
          calendarError: 'Leave metadata is missing start or end date',
        };
        await updateBusinessJobStatus(jobId, 'approved_calendar_failed', JSON.stringify(failedResults));
        await auditRecord('ALLOWED', 'ManagerApproval', 'hr_leave_decision', auditResource, 'Approval recorded, but calendar sync could not start');
        await auditRecord('DENIED', 'CalendarSync', 'hr_leave_calendar', auditResource, failedResults.calendarError as string);
        res.json({ success: true, jobId, status: 'approved_calendar_failed', result: failedResults });
        return;
      }

      const calendarSync = await attemptCalendarCreation(employeeName, startDate, endDate, leaveType, reason);
      const approvedResults = {
        ...results,
        status: calendarSync.success ? 'approved' : 'approved_calendar_failed',
        decision: 'approved',
        approvalRequestId,
        decidedBy,
        note,
        reviewedAt,
        calendarSyncStatus: calendarSync.success ? 'synced' : 'failed',
        calendarRetryCount: calendarSync.attempts,
        ...(calendarSync.calendarEventId ? { calendarEventId: calendarSync.calendarEventId } : {}),
        ...(calendarSync.calendarEventLink ? { calendarEventLink: calendarSync.calendarEventLink } : {}),
        ...(calendarSync.error ? { calendarError: calendarSync.error } : {}),
      };

      await updateBusinessJobStatus(jobId, approvedResults.status as string, JSON.stringify(approvedResults));
      await auditRecord('ALLOWED', 'ManagerApproval', 'hr_leave_decision', auditResource, 'Leave approved by manager');

      if (calendarSync.success) {
        await auditRecord(
          'ALLOWED',
          'CalendarSync',
          'hr_leave_calendar',
          auditResource,
          `Calendar event created after ${calendarSync.attempts} attempt(s)`,
        );
      } else {
        await auditRecord(
          'DENIED',
          'CalendarSync',
          'hr_leave_calendar',
          auditResource,
          approvedResults.calendarError as string,
        );
      }

      res.json({
        success: true,
        jobId,
        status: approvedResults.status,
        result: approvedResults,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HRLeaveRoute', `POST /decision failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  return router;
}

export default createHRLeaveRoutes;
