/**
 * Metrics Service Tests
 * Path: test/metricsService.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MetricsService } from '@packages/core-logic/metricsService.js';

let db: Database.Database;
let metricsService: MetricsService;

beforeEach(() => {
  db = new Database(':memory:');

  // Create D1 schema
  db.exec(`
    CREATE TABLE cean_metrics_cache (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latency_p50 REAL,
      latency_p95 REAL,
      latency_p99 REAL,
      request_count INTEGER,
      error_count INTEGER,
      error_rate REAL,
      memory_usage_mb REAL,
      cloudflare_location TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE cean_workers (
      id TEXT PRIMARY KEY,
      fleet_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE cean_fleets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  metricsService = new MetricsService(db);
});

afterEach(() => {
  db.close();
});

describe('MetricsService', () => {
  it('should save worker metrics', () => {
    const success = metricsService.saveWorkerMetrics('worker-1', {
      latency_p50: 100,
      latency_p95: 250,
      latency_p99: 500,
      request_count: 1000,
      error_count: 5,
      error_rate: 0.5,
      memory_usage_mb: 150
    });

    expect(success).toBeTruthy();
  });

  it('should retrieve latest worker metrics', () => {
    metricsService.saveWorkerMetrics('worker-1', {
      latency_p50: 100,
      latency_p95: 250,
      latency_p99: 500,
      request_count: 1000,
      error_count: 5,
      error_rate: 0.5
    });

    const metrics = metricsService.getLatestWorkerMetrics('worker-1');

    expect(metrics).toBeDefined();
    if (metrics) {
      expect(metrics.worker_id).toBe('worker-1');
      expect(metrics.latency_p95).toBe(250);
      expect(metrics.error_rate).toBe(0.5);
    }
  });

  it('should handle no metrics found', () => {
    const metrics = metricsService.getLatestWorkerMetrics('non-existent');
    expect(metrics).toBeNull();
  });

  it('should retrieve metrics in time range', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Save metrics BEFORE defining the time range
    metricsService.saveWorkerMetrics('worker-1', {
      latency_p50: 100,
      latency_p95: 250,
      error_rate: 0.5
    });

    // Now query the range (should include the saved metric)
    const metrics = metricsService.getMetricsInRange(
      'worker-1',
      oneHourAgo,
      new Date(now.getTime() + 1000).toISOString(), // +1s to ensure inclusion
      100
    );

    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0].worker_id).toBe('worker-1');
  });

  it('should aggregate metrics for fleet', () => {
    // Create fleet and workers in DB
    db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
    db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
      .run('worker-1', 'fleet-1', 'w1', 'active');
    db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
      .run('worker-2', 'fleet-1', 'w2', 'active');

    // Save metrics
    metricsService.saveWorkerMetrics('worker-1', {
      latency_p50: 100,
      latency_p95: 200,
      latency_p99: 300,
      error_rate: 1
    });

    metricsService.saveWorkerMetrics('worker-2', {
      latency_p50: 150,
      latency_p95: 300,
      latency_p99: 400,
      error_rate: 2
    });

    const aggregated = metricsService.getFleetAggregateMetrics('fleet-1');

    expect(aggregated).toBeDefined();
    if (aggregated) {
      expect(aggregated.worker_count).toBe(2);
      expect(aggregated.avg_latency_p95).toBe(250); // (200 + 300) / 2
      expect(aggregated.avg_error_rate).toBe(1.5); // (1 + 2) / 2
    }
  });

  it('should cleanup old metrics', () => {
    metricsService.saveWorkerMetrics('worker-1', {
      latency_p95: 250,
      error_rate: 0.5
    });

    const deletedCount = metricsService.cleanupOldMetrics(0); // Delete anything older than today

    // Since we just inserted, nothing should be deleted
    expect(deletedCount).toBe(0);
  });

  it('should save metrics with all optional fields', () => {
    const success = metricsService.saveWorkerMetrics('worker-1', {
      latency_p50: 50,
      latency_p95: 150,
      latency_p99: 300,
      request_count: 5000,
      error_count: 25,
      error_rate: 0.5,
      memory_usage_mb: 256,
      cloudflare_location: 'SFO'
    });

    expect(success).toBeTruthy();

    const metrics = metricsService.getLatestWorkerMetrics('worker-1');
    expect(metrics?.cloudflare_location).toBe('SFO');
    expect(metrics?.memory_usage_mb).toBe(256);
  });

  it('should handle saveWorkerMetrics error gracefully', () => {
    db.close(); // Close DB to simulate error

    const success = metricsService.saveWorkerMetrics('worker-1', {
      latency_p95: 250
    });

    expect(success).toBeFalsy();
  });
});
