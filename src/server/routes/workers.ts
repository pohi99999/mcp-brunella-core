/**
 * CEAN Worker Management API Routes
 * Path: src/server/routes/workers.ts
 * 
 * Endpoints:
 *   POST   /api/fleet/:fleetId/workers/add       - Add worker to fleet
 *   GET    /api/fleet/:fleetId/workers           - List fleet workers
 *   PUT    /api/fleet/:fleetId/workers/:id/status - Update worker status
 *   DELETE /api/fleet/:fleetId/workers/:id       - Remove worker
 */

import { Router, Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';

export function createWorkersRouter(db: Database) {
  const router = Router();

  /**
   * POST /api/fleet/:fleetId/workers/add
   * Add a worker to a fleet
   */
  router.post('/:fleetId/workers/add', (req: Request, res: Response) => {
    try {
      const { fleetId } = req.params;
      const { name, url, cloudflare_id } = req.body;

      if (!name || !url) {
        return res.status(400).json({ error: 'Worker name and URL are required' });
      }

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleetId);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      const workerId = `worker-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO cean_workers (id, fleet_id, name, url, cloudflare_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `);

      stmt.run(workerId, fleetId, name, url, cloudflare_id || null, now, now);

      logInfo('WorkersAPI', `Worker added to fleet ${fleetId}: ${workerId}`);

      return res.status(201).json({
        id: workerId,
        fleet_id: fleetId,
        name,
        url,
        cloudflare_id: cloudflare_id || null,
        status: 'active',
        created_at: now
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkersAPI', `Add worker error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/fleet/:fleetId/workers
   * List all workers in a fleet
   */
  router.get('/:fleetId/workers', (req: Request, res: Response) => {
    try {
      const { fleetId } = req.params;

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleetId);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      const stmt = db.prepare(`
        SELECT id, fleet_id, name, url, cloudflare_id, status, last_heartbeat, error_count, created_at, updated_at
        FROM cean_workers
        WHERE fleet_id = ?
        ORDER BY created_at DESC
      `);

      const workers = stmt.all(fleetId);

      logInfo('WorkersAPI', `Listed ${workers.length} workers for fleet ${fleetId}`);
      return res.json(workers);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkersAPI', `List workers error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * PUT /api/fleet/:fleetId/workers/:workerId/status
   * Update worker status (active, paused, draining)
   */
  router.put('/:fleetId/workers/:workerId/status', (req: Request, res: Response) => {
    try {
      const { fleetId, workerId } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'paused', 'draining', 'removing'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      const now = new Date().toISOString();

      const stmt = db.prepare(`
        UPDATE cean_workers
        SET status = ?, updated_at = ?
        WHERE id = ? AND fleet_id = ?
      `);

      const result = stmt.run(status, now, workerId, fleetId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      logInfo('WorkersAPI', `Worker status updated: ${workerId} → ${status}`);

      // Return updated worker
      const getStmt = db.prepare(
        'SELECT * FROM cean_workers WHERE id = ? AND fleet_id = ?'
      );
      const updatedWorker = getStmt.get(workerId, fleetId);

      return res.json(updatedWorker);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkersAPI', `Update worker status error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * DELETE /api/fleet/:fleetId/workers/:workerId
   * Remove a worker from fleet
   */
  router.delete('/:fleetId/workers/:workerId', (req: Request, res: Response) => {
    try {
      const { fleetId, workerId } = req.params;

      // Check if worker exists
      const getStmt = db.prepare(
        'SELECT id FROM cean_workers WHERE id = ? AND fleet_id = ?'
      );
      const worker = getStmt.get(workerId, fleetId);

      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Delete worker (cascades to metrics)
      const deleteStmt = db.prepare('DELETE FROM cean_workers WHERE id = ? AND fleet_id = ?');
      deleteStmt.run(workerId, fleetId);

      logInfo('WorkersAPI', `Worker removed: ${workerId}`);
      return res.json({ message: `Worker ${workerId} removed`, id: workerId });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkersAPI', `Delete worker error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}
