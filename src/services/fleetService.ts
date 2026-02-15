/**
 * Fleet Service - Business logic for fleet operations
 * Path: src/services/fleetService.ts
 * 
 * Handles:
 * - Fleet creation, updates, deletion
 * - Worker management within fleets
 * - Fleet health status calculation
 */

import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';

export interface FleetData {
  id: string;
  name: string;
  environment: string;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerData {
  id: string;
  fleet_id: string;
  name: string;
  url: string;
  cloudflare_id?: string;
  status: string;
  last_heartbeat?: string;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface FleetHealth {
  id: string;
  name: string;
  environment: string;
  status: string;
  worker_count: number;
  active_workers: number;
  error_rate: number; // percentage
  avg_latency_p95: number; // milliseconds
  last_update: string;
}

export class FleetService {
  constructor(private db: Database) {}

  /**
   * Get fleet health status
   */
  getFleetHealth(fleetId: string): FleetHealth | null {
    try {
      // Get fleet info
      const fleetStmt = this.db.prepare(`
        SELECT id, name, environment, status, created_at
        FROM cean_fleets
        WHERE id = ?
      `);

      const fleet = fleetStmt.get(fleetId) as FleetData | undefined;

      if (!fleet) {
        return null;
      }

      // Get worker stats
      const workerStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM cean_workers
        WHERE fleet_id = ?
      `);

      const workerStats = workerStmt.get(fleetId) as { total: number; active: number };

      // Get metrics aggregate
      const metricsStmt = this.db.prepare(`
        SELECT 
          AVG(error_rate) as avg_error_rate,
          AVG(latency_p95) as avg_latency_p95,
          MAX(timestamp) as last_update
        FROM cean_metrics_cache
        WHERE worker_id IN (
          SELECT id FROM cean_workers WHERE fleet_id = ?
        )
        AND timestamp >= datetime('now', '-5 minutes')
      `);

      const metrics = metricsStmt.get(fleetId) as {
        avg_error_rate: number | null;
        avg_latency_p95: number | null;
        last_update: string | null;
      };

      return {
        id: fleet.id,
        name: fleet.name,
        environment: fleet.environment,
        status: fleet.status,
        worker_count: workerStats.total || 0,
        active_workers: workerStats.active || 0,
        error_rate: (metrics.avg_error_rate as number) || 0,
        avg_latency_p95: (metrics.avg_latency_p95 as number) || 0,
        last_update: (metrics.last_update as string) || new Date().toISOString()
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `getFleetHealth error: ${msg}`);
      return null;
    }
  }

  /**
   * Get all fleets with health info
   */
  getAllFleetsWithHealth(): Array<FleetHealth & { description?: string }> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, name, environment, status, description, created_at
        FROM cean_fleets
        ORDER BY created_at DESC
      `);

      const fleets = stmt.all() as (FleetData & { description?: string })[];

      return fleets.map((fleet) => {
        const health = this.getFleetHealth(fleet.id);
        return { ...health, description: fleet.description } as FleetHealth & {
          description?: string;
        };
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `getAllFleetsWithHealth error: ${msg}`);
      return [];
    }
  }

  /**
   * Add worker to fleet
   */
  addWorkerToFleet(fleetId: string, workerName: string, workerUrl: string): WorkerData | null {
    try {
      const workerId = `worker-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        INSERT INTO cean_workers (id, fleet_id, name, url, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
      `);

      stmt.run(workerId, fleetId, workerName, workerUrl, now, now);

      logInfo('FleetService', `Worker added to fleet ${fleetId}: ${workerId}`);

      return {
        id: workerId,
        fleet_id: fleetId,
        name: workerName,
        url: workerUrl,
        status: 'active',
        error_count: 0,
        created_at: now,
        updated_at: now
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `addWorkerToFleet error: ${msg}`);
      return null;
    }
  }

  /**
   * Remove worker from fleet
   */
  removeWorkerFromFleet(workerId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM cean_workers WHERE id = ?');
      const result = stmt.run(workerId);

      const resultObj = result as unknown as Record<string, unknown>;
      if (resultObj.changes === 0) {
        return false;
      }

      logInfo('FleetService', `Worker removed: ${workerId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `removeWorkerFromFleet error: ${msg}`);
      return false;
    }
  }

  /**
   * Update worker status
   */
  updateWorkerStatus(workerId: string, newStatus: string): boolean {
    try {
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        UPDATE cean_workers
        SET status = ?, updated_at = ?, last_heartbeat = ?
        WHERE id = ?
      `);

      const result = stmt.run(newStatus, now, now, workerId);

      const resultObj = result as unknown as Record<string, unknown>;
      if (resultObj.changes === 0) {
        return false;
      }

      logInfo('FleetService', `Worker status updated: ${workerId} → ${newStatus}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `updateWorkerStatus error: ${msg}`);
      return false;
    }
  }

  /**
   * Increment worker error count
   */
  incrementWorkerErrorCount(workerId: string): boolean {
    try {
      const now = new Date().toISOString();

      const stmt = this.db.prepare(`
        UPDATE cean_workers
        SET error_count = error_count + 1, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(now, workerId);

      const resultObj = result as unknown as Record<string, unknown>;
      if (resultObj.changes === 0) {
        return false;
      }

      logInfo('FleetService', `Worker error count incremented: ${workerId}`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('FleetService', `incrementWorkerErrorCount error: ${msg}`);
      return false;
    }
  }
}
