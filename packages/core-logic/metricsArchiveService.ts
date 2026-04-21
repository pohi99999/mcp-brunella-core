/**
 * Metrics Archive Service
 * Path: src/services/metricsArchiveService.ts
 *
 * Handle long-term metrics storage and retention for CEAN fleet monitoring
 * Archives metrics from Prometheus to D1 for historical analysis
 */

import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarn } from '@packages/utils/logger.js';

export interface MetricRecord {
  metricName: string;
  metricValue: number;
  fleetId?: string;
  workerId?: string;
  labels?: Record<string, string>;
  timestamp?: string;
}

export interface MetricsHistoryQuery {
  fleetId?: string;
  workerId?: string;
  metricName?: string;
  startTime: string; // ISO-8601
  endTime: string; // ISO-8601
  limit?: number;
}

/**
 * Archive a metric with timestamp, labels, and fleet context
 */
export async function archiveMetric(
  db: Database,
  record: MetricRecord
): Promise<string> {
  try {
    const id = `metric-${uuidv4()}`;
    const timestamp = record.timestamp || new Date().toISOString();
    const labelsJson = record.labels ? JSON.stringify(record.labels) : null;

    const stmt = db.prepare(`
      INSERT INTO cean_metrics_archive (
        id, timestamp, fleet_id, worker_id, 
        metric_name, metric_value, labels, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      timestamp,
      record.fleetId || null,
      record.workerId || null,
      record.metricName,
      record.metricValue,
      labelsJson,
      new Date().toISOString()
    );

    logInfo('metricsArchive', `Archived metric: ${record.metricName} = ${record.metricValue}`);
    return id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Failed to archive metric: ${msg}`);
    throw e;
  }
}

/**
 * Get metrics history for a fleet or worker
 */
export async function getMetricsHistory(
  db: Database,
  query: MetricsHistoryQuery
): Promise<any[]> {
  try {
    let sql = 'SELECT * FROM cean_metrics_archive WHERE 1=1';
    const params: any[] = [];

    if (query.fleetId) {
      sql += ' AND fleet_id = ?';
      params.push(query.fleetId);
    }

    if (query.workerId) {
      sql += ' AND worker_id = ?';
      params.push(query.workerId);
    }

    if (query.metricName) {
      sql += ' AND metric_name = ?';
      params.push(query.metricName);
    }

    // Time range filter
    sql += ' AND timestamp BETWEEN ? AND ?';
    params.push(query.startTime, query.endTime);

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const stmt = db.prepare(sql);
    const results = stmt.all(...params) as any[];

    logInfo('metricsArchive', `Retrieved ${results.length} metric records`);
    return results;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Failed to retrieve metrics history: ${msg}`);
    throw e;
  }
}

/**
 * Delete metrics older than specified days (retention policy)
 * Default: 30 days
 */
export async function deleteOldMetrics(
  db: Database,
  daysToKeep: number = 30
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    const stmt = db.prepare(`
      DELETE FROM cean_metrics_archive 
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffIso) as any;
    const deletedCount = result.changes || 0;

    logInfo(
      'metricsArchive',
      `Cleanup: deleted ${deletedCount} metrics older than ${daysToKeep} days`
    );

    return deletedCount;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Retention policy failed: ${msg}`);
    throw e;
  }
}

/**
 * Aggregate metrics for a fleet in a time window
 * Returns average, min, max for each metric type
 */
export async function getMetricsAggregate(
  db: Database,
  fleetId: string,
  startTime: string,
  endTime: string
): Promise<Record<string, { avg: number; min: number; max: number; count: number }>> {
  try {
    const sql = `
      SELECT 
        metric_name,
        AVG(metric_value) as avg,
        MIN(metric_value) as min,
        MAX(metric_value) as max,
        COUNT(*) as count
      FROM cean_metrics_archive
      WHERE fleet_id = ?
        AND timestamp BETWEEN ? AND ?
      GROUP BY metric_name
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(fleetId, startTime, endTime) as any[];

    const aggregated: Record<string, any> = {};
    for (const row of results) {
      aggregated[row.metric_name] = {
        avg: row.avg,
        min: row.min,
        max: row.max,
        count: row.count,
      };
    }

    logInfo('metricsArchive', `Aggregated ${results.length} metric groups for fleet ${fleetId}`);
    return aggregated;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Failed to aggregate metrics: ${msg}`);
    throw e;
  }
}

/**
 * Get latest metrics snapshot per worker (most recent values)
 */
export async function getLatestMetricsSnapshot(
  db: Database,
  fleetId: string
): Promise<Record<string, any>> {
  try {
    const sql = `
      SELECT 
        worker_id,
        metric_name,
        metric_value,
        timestamp,
        labels
      FROM cean_metrics_archive
      WHERE fleet_id = ? 
        AND timestamp = (
          SELECT MAX(timestamp) 
          FROM cean_metrics_archive 
          WHERE fleet_id = ? AND worker_id = cean_metrics_archive.worker_id
        )
      ORDER BY worker_id, metric_name
    `;

    const stmt = db.prepare(sql);
    const results = stmt.all(fleetId, fleetId) as any[];

    const snapshot: Record<string, any> = {};
    for (const row of results) {
      if (!snapshot[row.worker_id]) {
        snapshot[row.worker_id] = {};
      }
      snapshot[row.worker_id][row.metric_name] = {
        value: row.metric_value,
        timestamp: row.timestamp,
        labels: row.labels ? JSON.parse(row.labels) : null,
      };
    }

    logInfo('metricsArchive', `Got latest snapshot for ${Object.keys(snapshot).length} workers`);
    return snapshot;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Failed to get latest snapshot: ${msg}`);
    throw e;
  }
}

/**
 * Initialize metrics archive on server startup
 * - Run retention cleanup
 * - Log statistics
 */
export async function initMetricsArchive(db: Database): Promise<void> {
  try {
    // Check table exists
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cean_metrics_archive'"
      )
      .all();

    if (tables.length === 0) {
      logWarn('metricsArchive', 'Table cean_metrics_archive does not exist - schema may not be initialized');
      return;
    }

    // Run cleanup (keep last 30 days)
    await deleteOldMetrics(db, 30);

    // Get current record count
    const countRow = db.prepare('SELECT COUNT(*) as count FROM cean_metrics_archive').get() as any;
    logInfo('metricsArchive', `Initialized - current archive size: ${countRow.count} records`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('metricsArchive', `Initialization failed: ${msg}`);
  }
}

