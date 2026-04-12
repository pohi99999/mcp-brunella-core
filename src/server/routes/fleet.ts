/**
 * CEAN Fleet Management API Routes
 * Path: src/server/routes/fleet.ts
 * 
 * Endpoints:
 *   POST   /api/fleet/create       - Create new fleet
 *   GET    /api/fleet/list         - List all fleets
 *   GET    /api/fleet/:id          - Get fleet details
 *   PUT    /api/fleet/:id          - Update fleet
 *   DELETE /api/fleet/:id          - Delete fleet
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';
import { agentManager } from '../../agents/AgentManager.js';

export function createFleetRouter(db: Database) {
  const router = Router();

  /**
   * POST /api/fleet/create
   * Create a new worker fleet
   */
  router.post('/create', (req: any, res: any) => {
    try {
      const { name, environment = 'production', description = '' } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Fleet name is required' });
      }

      const fleetId = `fleet-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO cean_fleets (id, name, environment, status, description, config, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, '{}', ?, ?)
      `);

      stmt.run(fleetId, name, environment, description, now, now);

      logInfo('FleetAPI', `Fleet created: ${fleetId} (${name})`);

      return res.status(201).json({
        id: fleetId,
        name,
        environment,
        status: 'active',
        description,
        created_at: now
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetAPI', `Create fleet error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/fleet/list
   * List all fleets (including Brunella Agents as workers)
   */
  router.get('/list', (req: any, res: any) => {
    try {
      const stmt = db.prepare(`
        SELECT id, name, environment, status, description, created_at, updated_at
        FROM cean_fleets
        ORDER BY created_at DESC
      `);

      const fleets = stmt.all() as Array<{
        id: string;
        name: string;
        environment: string;
        status: string;
        description: string;
        created_at: string;
        updated_at: string;
      }>;

      // Enrich Brunella Agents fleet with actual agent count
      const enrichedFleets = fleets.map(fleet => {
        if (fleet.id === 'fleet-brunella-agents') {
          const agentStatuses = agentManager.listAgentStatuses();
          return {
            ...fleet,
            worker_count: agentStatuses.length,
            enabled: true,
            region: 'local'
          };
        }
        return {
          ...fleet,
          enabled: fleet.status === 'active',
          region: fleet.environment
        };
      });

      logInfo('FleetAPI', `Listed ${enrichedFleets.length} fleets`);
      return res.json({ success: true, data: enrichedFleets });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetAPI', `List fleets error: ${msg}`);
      return res.status(500).json({ success: false, error: msg });
    }
  });

  /**
   * GET /api/fleet/:id
   * Get fleet details with worker count
   */
  router.get('/:id', (req: any, res: any) => {
    try {
      const { id } = req.params;

      const stmt = db.prepare(`
        SELECT id, name, environment, status, description, created_at, updated_at
        FROM cean_fleets
        WHERE id = ?
      `);

      const fleet = stmt.get(id) as Record<string, unknown> | undefined;

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      // Get worker count
      const workerStmt = db.prepare(
        'SELECT COUNT(*) as count FROM cean_workers WHERE fleet_id = ? AND status = "active"'
      );
      const workerCount = (workerStmt.get(id) as { count: number }).count;

      logInfo('FleetAPI', `Retrieved fleet: ${id}`);
      return res.json({ ...fleet, worker_count: workerCount });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetAPI', `Get fleet error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * PUT /api/fleet/:id
   * Update fleet (name, environment, status)
   */
  router.put('/:id', (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, environment, status, description } = req.body;

      const now = new Date().toISOString();

      const updateStmt = db.prepare(`
        UPDATE cean_fleets
        SET name = COALESCE(?, name),
            environment = COALESCE(?, environment),
            status = COALESCE(?, status),
            description = COALESCE(?, description),
            updated_at = ?
        WHERE id = ?
      `);

      const result = updateStmt.run(name, environment, status, description, now, id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      logInfo('FleetAPI', `Fleet updated: ${id}`);

      // Return updated fleet
      const getStmt = db.prepare(
        'SELECT * FROM cean_fleets WHERE id = ?'
      );
      const updatedFleet = getStmt.get(id);

      return res.json(updatedFleet);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetAPI', `Update fleet error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * DELETE /api/fleet/:id
   * Delete fleet and all associated workers
   */
  router.delete('/:id', (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Check if fleet exists
      const getStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = getStmt.get(id);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      // Delete fleet (cascades to workers and metrics)
      const deleteStmt = db.prepare('DELETE FROM cean_fleets WHERE id = ?');
      deleteStmt.run(id);

      logInfo('FleetAPI', `Fleet deleted: ${id}`);
      return res.json({ message: `Fleet ${id} deleted`, id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetAPI', `Delete fleet error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}
