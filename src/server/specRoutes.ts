/**
 * Gold Protocol G7.1: Spec Management API Routes
 *
 * RULE-UI3: CLI és Dashboard ugyanazon API-t használja
 * RULE-UI4: Routes külön *Routes.ts fájlokban (clean separation)
 *
 * Endpoints:
 *   GET /api/specs - List all specs with status
 *   GET /api/specs/:trackId - Get spec details
 *   POST /api/specs/:trackId/approve - Approve spec
 *   POST /api/specs/:trackId/reject - Reject spec
 */

import { Router } from 'express';
import {
  listSpecStatuses,
  getSpecStatus,
  approveSpec,
  rejectSpec,
  isSpecApproved,
} from '../agents/specStatus.js';
import { logInfo } from '../utils/logger.js';
import { socketService } from './SocketService.js';
import fs from 'fs/promises';
import path from 'path';

export function createSpecRouter(): Router {
  const router = Router();

  /**
   * GET /api/specs
   * List all tracks with their spec statuses
   */
  router.get('/', async (_req, res) => {
    try {
      const specs = await listSpecStatuses();
      res.json({ specs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/specs/:trackId
   * Get detailed spec information for a specific track
   */
  router.get('/:trackId', async (req, res) => {
    try {
      const { trackId } = req.params;
      const status = await getSpecStatus(trackId);
      const approved = await isSpecApproved(trackId);

      // Try to read spec.md content
      const specPath = path.join(process.cwd(), 'conductor', 'tracks', trackId, 'spec.md');
      let content = '';
      try {
        content = await fs.readFile(specPath, 'utf-8');
      } catch {
        // spec.md not found
      }

      // Try to read plan.md content
      const planPath = path.join(process.cwd(), 'conductor', 'tracks', trackId, 'plan.md');
      let plan = '';
      try {
        plan = await fs.readFile(planPath, 'utf-8');
      } catch {
        // plan.md not found
      }

      res.json({
        trackId,
        status,
        approved,
        specContent: content,
        planContent: plan,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/specs/:trackId/approve
   * Approve a track specification
   */
  router.post('/:trackId/approve', async (req, res) => {
    try {
      const { trackId } = req.params;
      const success = await approveSpec(trackId);

      if (success) {
        logInfo('SpecRoutes', `Spec approved via API: ${trackId}`);
        socketService.emit('gold:spec_changed', { trackId, spec_status: 'approved', timestamp: new Date().toISOString() });
        res.json({ success: true, message: `Spec approved for track: ${trackId}` });
      } else {
        res.status(400).json({ success: false, message: 'Failed to approve spec' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/specs/:trackId/reject
   * Reject a track specification
   */
  router.post('/:trackId/reject', async (req, res) => {
    try {
      const { trackId } = req.params;
      const { reason } = req.body;
      const success = await rejectSpec(trackId, reason);

      if (success) {
        logInfo('SpecRoutes', `Spec rejected via API: ${trackId} (reason: ${reason || 'none'})`);
        socketService.emit('gold:spec_changed', { trackId, spec_status: 'rejected', reason, timestamp: new Date().toISOString() });
        res.json({ success: true, message: `Spec rejected for track: ${trackId}` });
      } else {
        res.status(400).json({ success: false, message: 'Failed to reject spec' });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
