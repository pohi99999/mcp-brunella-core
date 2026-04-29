/**
 * Tests for Metrics Archive Service
 * Path: test/metricsArchiveService.test.ts
 *
 * Test metrics storage, retrieval, and retention policies
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { archiveMetric, getMetricsHistory, deleteOldMetrics, getMetricsAggregate, getLatestMetricsSnapshot, initMetricsArchive, } from '@packages/core-logic/metricsArchiveService.js';
let db;
const testDbPath = path.join(process.cwd(), '.test-metrics-archive.db');
describe('MetricsArchiveService', () => {
    beforeEach(() => {
        // Create test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        db = new Database(testDbPath);
        // Create tables
        const schema = fs.readFileSync(path.join(process.cwd(), 'myai/agents/workers/schema/d1_schema.sql'), 'utf-8');
        db.exec(schema);
    });
    afterEach(() => {
        db.close();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });
    it('should archive a metric with timestamp and labels', async () => {
        const id = await archiveMetric(db, {
            metricName: 'fleet_requests_total',
            metricValue: 1000,
            fleetId: 'fleet-1',
            workerId: 'worker-1',
            labels: { region: 'us-west', status: 'healthy' },
        });
        expect(id).toBeTruthy();
        expect(id).toMatch(/^metric-/);
        // Verify in DB
        const row = db
            .prepare('SELECT * FROM cean_metrics_archive WHERE id = ?')
            .get(id);
        expect(row).toBeDefined();
        expect(row.metric_name).toBe('fleet_requests_total');
        expect(row.metric_value).toBe(1000);
        expect(row.fleet_id).toBe('fleet-1');
        expect(JSON.parse(row.labels)).toEqual({ region: 'us-west', status: 'healthy' });
    });
    it('should retrieve metrics history by fleet and time range', async () => {
        const fleetId = 'fleet-1';
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Archive multiple metrics
        await archiveMetric(db, {
            metricName: 'fleet_requests_total',
            metricValue: 100,
            fleetId,
            timestamp: oneDayAgo.toISOString(),
        });
        await archiveMetric(db, {
            metricName: 'fleet_errors_total',
            metricValue: 5,
            fleetId,
            timestamp: now.toISOString(),
        });
        // Query
        const results = await getMetricsHistory(db, {
            fleetId,
            startTime: oneDayAgo.toISOString(),
            endTime: now.toISOString(),
        });
        expect(results).toHaveLength(2);
    });
    it('should delete metrics older than retention period', async () => {
        const fleetId = 'fleet-1';
        const now = new Date();
        const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
        // Archive old metric
        await archiveMetric(db, {
            metricName: 'fleet_requests_total',
            metricValue: 100,
            fleetId,
            timestamp: thirtyFiveDaysAgo.toISOString(),
        });
        // Archive recent metric
        await archiveMetric(db, {
            metricName: 'fleet_requests_total',
            metricValue: 200,
            fleetId,
            timestamp: now.toISOString(),
        });
        // Run cleanup (keep 30 days)
        const deletedCount = await deleteOldMetrics(db, 30);
        expect(deletedCount).toBe(1);
        // Verify recent metric still exists
        const remaining = db
            .prepare('SELECT COUNT(*) as count FROM cean_metrics_archive')
            .get();
        expect(remaining.count).toBe(1);
    });
    it('should aggregate metrics (avg, min, max)', async () => {
        const fleetId = 'fleet-1';
        const now = new Date();
        const startTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        // Archive multiple values for same metric
        await archiveMetric(db, {
            metricName: 'worker_latency_ms',
            metricValue: 50,
            fleetId,
        });
        await archiveMetric(db, {
            metricName: 'worker_latency_ms',
            metricValue: 100,
            fleetId,
        });
        await archiveMetric(db, {
            metricName: 'worker_latency_ms',
            metricValue: 150,
            fleetId,
        });
        const endTime = new Date().toISOString();
        // Get aggregate
        const agg = await getMetricsAggregate(db, fleetId, startTime, endTime);
        expect(agg.worker_latency_ms).toBeDefined();
        expect(agg.worker_latency_ms.avg).toBe(100); // (50+100+150)/3
        expect(agg.worker_latency_ms.min).toBe(50);
        expect(agg.worker_latency_ms.max).toBe(150);
        expect(agg.worker_latency_ms.count).toBe(3);
    });
    it('should get latest metrics snapshot per worker', async () => {
        const fleetId = 'fleet-1';
        const workerId = 'worker-1';
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        // Archive old and new metrics for same worker
        await archiveMetric(db, {
            metricName: 'latency_p95',
            metricValue: 100,
            fleetId,
            workerId,
            timestamp: oneHourAgo.toISOString(),
        });
        await archiveMetric(db, {
            metricName: 'latency_p95',
            metricValue: 120,
            fleetId,
            workerId,
            timestamp: now.toISOString(),
        });
        // Get snapshot
        const snapshot = await getLatestMetricsSnapshot(db, fleetId);
        expect(snapshot[workerId]).toBeDefined();
        expect(snapshot[workerId].latency_p95.value).toBe(120); // Latest value
    });
    it('should initialize archive on startup with cleanup', async () => {
        // Archive some metrics
        await archiveMetric(db, {
            metricName: 'fleet_requests_total',
            metricValue: 100,
            fleetId: 'fleet-1',
        });
        // Init (should run cleanup)
        await initMetricsArchive(db);
        // Verify table exists
        const tables = db
            .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='cean_metrics_archive'")
            .get();
        expect(tables.count).toBe(1);
    });
    it('should handle concurrent archiving', async () => {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(archiveMetric(db, {
                metricName: `metric_${i}`,
                metricValue: i * 10,
                fleetId: 'fleet-1',
            }));
        }
        const ids = await Promise.all(promises);
        expect(ids).toHaveLength(10);
        // Verify all saved
        const count = db
            .prepare('SELECT COUNT(*) as count FROM cean_metrics_archive')
            .get();
        expect(count.count).toBe(10);
    });
});
