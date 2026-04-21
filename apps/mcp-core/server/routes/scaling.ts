/**
 * CEAN Auto-scaling API Routes
 * Path: src/server/routes/scaling.ts
 * 
 * Endpoints:
 *   GET    /api/scaling/policies              - Get scaling policies
 *   PUT    /api/scaling/policies              - Update policies
 *   GET    /api/scaling/history/:fleetId      - Scaling history
 *   POST   /api/scaling/trigger               - Manual scale trigger (dev)
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';

interface ScalingPolicy {
  scaleUpThreshold: {
    latencyP95Ms: number;
    errorRatePercent: number;
  };
  scaleDownThreshold: {
    latencyP95Ms: number;
    errorRatePercent: number;
    durationMinutes: number;
  };
  cooldownMinutes: number;
  minWorkers: number;
  maxWorkers: number;
}

// Default policy
const DEFAULT_POLICY: ScalingPolicy = {
  scaleUpThreshold: {
    latencyP95Ms: 500,
    errorRatePercent: 5
  },
  scaleDownThreshold: {
    latencyP95Ms: 100,
    errorRatePercent: 1,
    durationMinutes: 5
  },
  cooldownMinutes: 5,
  minWorkers: 2,
  maxWorkers: 10
};

// In-memory policy store (can be moved to DB later)
const policyStore: Map<string, ScalingPolicy> = new Map();

export function createScalingRouter(db: Database) {
  const router = Router();

  /**
   * GET /api/scaling/policies
   * Get current scaling policies for all fleets
   */
  router.get('/policies', (req: Request, res: Response) => {
    try {
      const { fleet_id } = req.query;

      if (fleet_id) {
        const policy = policyStore.get(fleet_id as string) || DEFAULT_POLICY;
        logInfo('ScalingAPI', `Retrieved policy for fleet ${fleet_id}`);
        return res.json({ fleet_id, policy });
      }

      // Return all policies
      const stmt = db.prepare('SELECT id FROM cean_fleets');
      const fleets = stmt.all() as Array<{ id: string }>;

      const policies: Record<string, ScalingPolicy> = {};
      for (const fleet of fleets) {
        policies[fleet.id] = policyStore.get(fleet.id) || DEFAULT_POLICY;
      }

      logInfo('ScalingAPI', `Retrieved ${fleets.length} fleet policies`);
      return res.json(policies);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingAPI', `Get policies error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * PUT /api/scaling/policies
   * Update scaling policy
   */
  router.put('/policies', (req: Request, res: Response) => {
    try {
      const { fleet_id, policy } = req.body;

      if (!fleet_id || !policy) {
        return res.status(400).json({ error: 'fleet_id and policy are required' });
      }

      // Validate policy structure
      if (
        !policy.scaleUpThreshold ||
        !policy.scaleDownThreshold ||
        policy.cooldownMinutes === undefined ||
        policy.minWorkers === undefined ||
        policy.maxWorkers === undefined
      ) {
        return res.status(400).json({ error: 'Invalid policy structure' });
      }

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleet_id);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      // Store policy
      policyStore.set(fleet_id, policy);

      logInfo('ScalingAPI', `Policy updated for fleet ${fleet_id}`);
      return res.json({ fleet_id, policy });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingAPI', `Update policy error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/scaling/history/:fleetId
   * Get scaling history for a fleet
   */
  router.get('/history/:fleetId', (req: Request, res: Response) => {
    try {
      const { fleetId } = req.params;
      const { limit = 50 } = req.query;

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleetId);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      const stmt = db.prepare(`
        SELECT id, fleet_id, event_type, reason, instance_count_before, instance_count_after,
               status, error_message, created_at
        FROM cean_scaling_events
        WHERE fleet_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const events = stmt.all(fleetId, parseInt(limit as string) || 50);

      logInfo('ScalingAPI', `Retrieved ${events.length} scaling events for fleet ${fleetId}`);
      return res.json(events);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingAPI', `Get history error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/scaling/trigger
   * Manually trigger scaling (dev/admin endpoint)
   * Body: { fleet_id, action: 'scale_up' | 'scale_down' }
   */
  router.post('/trigger', (req: Request, res: Response) => {
    try {
      const { fleet_id, action } = req.body;

      if (!fleet_id || !action) {
        return res.status(400).json({ error: 'fleet_id and action are required' });
      }

      if (!['scale_up', 'scale_down'].includes(action)) {
        return res.status(400).json({ error: 'action must be scale_up or scale_down' });
      }

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleet_id);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      // Get current worker count
      const workerStmt = db.prepare(
        'SELECT COUNT(*) as count FROM cean_workers WHERE fleet_id = ? AND status = "active"'
      );
      const { count: currentCount } = workerStmt.get(fleet_id) as { count: number };

      // Get scaling policy
      const policy = policyStore.get(fleet_id) || DEFAULT_POLICY;

      // Calculate new count based on action
      let newCount = currentCount;
      let reason = '';

      if (action === 'scale_up') {
        newCount = Math.min(currentCount + 1, policy.maxWorkers);
        reason = 'Manual scale_up trigger (dev)';
      } else if (action === 'scale_down') {
        newCount = Math.max(currentCount - 1, policy.minWorkers);
        reason = 'Manual scale_down trigger (dev)';
      }

      // Record scaling event
      const eventId = `scale-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const eventStmt = db.prepare(`
        INSERT INTO cean_scaling_events
        (id, fleet_id, event_type, reason, instance_count_before, instance_count_after, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
      `);

      eventStmt.run(eventId, fleet_id, action, reason, currentCount, newCount, now);

      logInfo('ScalingAPI', `Scaling triggered for fleet ${fleet_id}: ${currentCount} → ${newCount}`);

      return res.json({
        event_id: eventId,
        fleet_id,
        action,
        instance_count_before: currentCount,
        instance_count_after: newCount,
        reason,
        timestamp: now
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('ScalingAPI', `Trigger scaling error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}
