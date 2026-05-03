import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getBusinessJobs, saveBusinessJob } from '@packages/utils/db.js';
import {
  getHROnboardingSamplePayloads,
} from '@packages/utils/hrOnboarding.js';
import { buildHROnboardingDryRunReport } from '@packages/utils/hrOnboardingDryRun.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError, logInfo } from '@packages/utils/logger.js';

function parseLimit(value: unknown, fallback = 10): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value.trim(), 10) : Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.trunc(parsed), 50);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createHROnboardingRoutes(): Router {
  const router = Router();

  router.get('/samples', (_req, res) => {
    res.json({
      success: true,
      samples: getHROnboardingSamplePayloads(),
    });
  });

  router.get('/jobs', async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 10);
      const jobs = await getBusinessJobs(limit, 'hr_onboarding');
      res.json({ success: true, jobs });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HROnboardingRoute', `GET /jobs failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: 'Failed to list HR onboarding jobs' });
    }
  });

  router.post('/dry-run', async (req, res) => {
    try {
      const dryRun = buildHROnboardingDryRunReport(isRecord(req.body) ? req.body : {});
      const jobId = uuidv4();
      const query = `${dryRun.normalized.employeeName} · ${dryRun.normalized.jobTitle}`;

      await saveBusinessJob({
        id: jobId,
        type: 'hr_onboarding',
        query,
        metadata: JSON.stringify({
          trigger: dryRun.normalized.trigger,
          source: dryRun.normalized.source,
          employeeId: dryRun.normalized.employeeId,
          employeeName: dryRun.normalized.employeeName,
        }),
        status: dryRun.report.status === 'ready' ? 'completed' : 'blocked',
        resultsJson: JSON.stringify(dryRun),
      });

      logInfo('HROnboardingRoute', `Dry-run completed for ${dryRun.normalized.employeeName}`);

      res.status(201).json({
        success: true,
        jobId,
        report: dryRun.report,
        normalized: dryRun.normalized,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HROnboardingRoute', `POST /dry-run failed: ${normalized.message}`);
      res.status(400).json({
        success: false,
        error: normalized.message,
      });
    }
  });

  return router;
}

export default createHROnboardingRoutes;
