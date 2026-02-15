/**
 * CEAN Metrics API Routes
 * Path: src/server/routes/metrics.ts
 * 
 * Endpoints:
 *   GET    /api/metrics/:workerId/latest    - Latest worker metrics
 *   GET    /api/metrics/:workerId/range     - Metrics in time range
 *   GET    /api/metrics/fleet/:fleetId/summary - Fleet aggregate metrics
 *   POST   /api/metrics/prometheus/scrape   - Prometheus scrape endpoint
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';

export function createMetricsRouter(db: Database) {
  const router = Router();

  /**
   * GET /api/metrics/:workerId/latest
   * Get latest metrics for a worker
   */
  router.get('/:workerId/latest', (req: Request, res: Response) => {
    try {
      const { workerId } = req.params;

      const stmt = db.prepare(`
        SELECT id, worker_id, timestamp, latency_p50, latency_p95, latency_p99,
               request_count, error_count, error_rate, memory_usage_mb, cloudflare_location
        FROM cean_metrics_cache
        WHERE worker_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const metric = stmt.get(workerId);

      if (!metric) {
        return res.status(404).json({ error: 'No metrics found for worker' });
      }

      logInfo('MetricsAPI', `Retrieved latest metrics for worker ${workerId}`);
      return res.json(metric);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsAPI', `Get latest metrics error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/metrics/:workerId/range?from=ISO&to=ISO
   * Get metrics in time range
   */
  router.get('/:workerId/range', (req: Request, res: Response) => {
    try {
      const { workerId } = req.params;
      const { from, to, limit = 100 } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: 'from and to query parameters are required (ISO-8601 format)' });
      }

      const stmt = db.prepare(`
        SELECT id, worker_id, timestamp, latency_p50, latency_p95, latency_p99,
               request_count, error_count, error_rate, memory_usage_mb, cloudflare_location
        FROM cean_metrics_cache
        WHERE worker_id = ? AND timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const metrics = stmt.all(workerId, from, to, parseInt(limit as string) || 100);

      logInfo('MetricsAPI', `Retrieved ${metrics.length} metrics for worker ${workerId}`);
      return res.json(metrics);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsAPI', `Get metrics range error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /api/metrics/fleet/:fleetId/summary
   * Get aggregate metrics for entire fleet
   */
  router.get('/fleet/:fleetId/summary', (req: Request, res: Response) => {
    try {
      const { fleetId } = req.params;

      // Verify fleet exists
      const fleetStmt = db.prepare('SELECT id FROM cean_fleets WHERE id = ?');
      const fleet = fleetStmt.get(fleetId);

      if (!fleet) {
        return res.status(404).json({ error: 'Fleet not found' });
      }

      // Get latest metrics for all workers in fleet
      const stmt = db.prepare(`
        SELECT 
          COUNT(DISTINCT w.id) as worker_count,
          AVG(m.latency_p50) as avg_latency_p50,
          AVG(m.latency_p95) as avg_latency_p95,
          AVG(m.latency_p99) as avg_latency_p99,
          AVG(m.error_rate) as avg_error_rate,
          SUM(m.request_count) as total_requests,
          SUM(m.error_count) as total_errors,
          MAX(m.timestamp) as last_update
        FROM cean_workers w
        LEFT JOIN (
          SELECT DISTINCT ON (worker_id) worker_id, timestamp, latency_p50, latency_p95,
                 latency_p99, error_rate, request_count, error_count
          FROM cean_metrics_cache
          ORDER BY worker_id, timestamp DESC
        ) m ON w.id = m.worker_id
        WHERE w.fleet_id = ?
      `);

      const summary = stmt.get(fleetId);

      logInfo('MetricsAPI', `Retrieved summary metrics for fleet ${fleetId}`);
      return res.json(summary);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsAPI', `Get fleet summary error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/metrics/prometheus/scrape
   * Prometheus scrape endpoint - returns metrics in Prometheus text format
   */
  router.post('/prometheus/scrape', (req: Request, res: Response) => {
    try {
      // Get all latest metrics
      const stmt = db.prepare(`
        SELECT DISTINCT ON (worker_id)
          w.id as worker_id,
          w.name as worker_name,
          f.environment,
          m.latency_p50, m.latency_p95, m.latency_p99,
          m.error_rate, m.request_count,
          m.cloudflare_location
        FROM cean_workers w
        LEFT JOIN cean_fleets f ON w.fleet_id = f.id
        LEFT JOIN cean_metrics_cache m ON w.id = m.worker_id
        ORDER BY worker_id, m.timestamp DESC
      `);

      const metrics = stmt.all() as Array<Record<string, unknown>>;

      // Generate Prometheus format output
      let prometheusOutput = '';

      // HELP and TYPE comments
      prometheusOutput += '# HELP cean_worker_latency_p50 Worker response latency p50 in milliseconds\n';
      prometheusOutput += '# TYPE cean_worker_latency_p50 gauge\n';

      // Metrics
      for (const m of metrics) {
        const labels = `worker_id="${m.worker_id}",worker_name="${m.worker_name}",env="${m.environment}"`;
        if (m.latency_p50 !== null) {
          prometheusOutput += `cean_worker_latency_p50{${labels}} ${m.latency_p50}\n`;
        }
      }

      prometheusOutput += '# HELP cean_worker_latency_p95 Worker response latency p95 in milliseconds\n';
      prometheusOutput += '# TYPE cean_worker_latency_p95 gauge\n';
      for (const m of metrics) {
        const labels = `worker_id="${m.worker_id}",worker_name="${m.worker_name}",env="${m.environment}"`;
        if (m.latency_p95 !== null) {
          prometheusOutput += `cean_worker_latency_p95{${labels}} ${m.latency_p95}\n`;
        }
      }

      prometheusOutput += '# HELP cean_worker_latency_p99 Worker response latency p99 in milliseconds\n';
      prometheusOutput += '# TYPE cean_worker_latency_p99 gauge\n';
      for (const m of metrics) {
        const labels = `worker_id="${m.worker_id}",worker_name="${m.worker_name}",env="${m.environment}"`;
        if (m.latency_p99 !== null) {
          prometheusOutput += `cean_worker_latency_p99{${labels}} ${m.latency_p99}\n`;
        }
      }

      prometheusOutput += '# HELP cean_worker_error_rate Worker error rate in percentage\n';
      prometheusOutput += '# TYPE cean_worker_error_rate gauge\n';
      for (const m of metrics) {
        const labels = `worker_id="${m.worker_id}",worker_name="${m.worker_name}",env="${m.environment}"`;
        if (m.error_rate !== null) {
          prometheusOutput += `cean_worker_error_rate{${labels}} ${m.error_rate}\n`;
        }
      }

      prometheusOutput += '# HELP cean_worker_requests_total Total requests\n';
      prometheusOutput += '# TYPE cean_worker_requests_total counter\n';
      for (const m of metrics) {
        const labels = `worker_id="${m.worker_id}",worker_name="${m.worker_name}",env="${m.environment}"`;
        if (m.request_count !== null) {
          prometheusOutput += `cean_worker_requests_total{${labels}} ${m.request_count}\n`;
        }
      }

      logInfo('MetricsAPI', `Prometheus scrape endpoint called, exported ${metrics.length} metrics`);

      // Return as plain text (Prometheus format)
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      return res.send(prometheusOutput);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsAPI', `Prometheus scrape error: ${msg}`);
      return res.status(500).send(`# ERROR: ${msg}\n`);
    }
  });

  /**
   * POST /api/metrics/save
   * Save metrics to cache (internal endpoint, called by workers/orchestrator)
   */
  router.post('/save', (req: Request, res: Response) => {
    try {
      const {
        worker_id,
        latency_p50,
        latency_p95,
        latency_p99,
        request_count = 0,
        error_count = 0,
        error_rate = 0,
        memory_usage_mb = 0,
        cloudflare_location = null
      } = req.body;

      if (!worker_id) {
        return res.status(400).json({ error: 'worker_id is required' });
      }

      const metricId = `metric-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO cean_metrics_cache
        (id, worker_id, timestamp, latency_p50, latency_p95, latency_p99, request_count,
         error_count, error_rate, memory_usage_mb, cloudflare_location, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        metricId,
        worker_id,
        now,
        latency_p50 || null,
        latency_p95 || null,
        latency_p99 || null,
        request_count,
        error_count,
        error_rate,
        memory_usage_mb,
        cloudflare_location,
        now
      );

      logInfo('MetricsAPI', `Metrics saved for worker ${worker_id}`);
      return res.status(201).json({ id: metricId, worker_id, timestamp: now });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MetricsAPI', `Save metrics error: ${msg}`);
      return res.status(500).json({ error: msg });
    }
  });

  return router;
}
