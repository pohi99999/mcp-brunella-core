/**
 * Fleet Service Tests
 * Path: test/fleetService.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { FleetService } from '../src/services/fleetService.js';

let db: Database.Database;
let fleetService: FleetService;

beforeEach(() => {
  // Create in-memory SQLite DB for testing
  db = new Database(':memory:');

  // Create D1 schema
  db.exec(`
    CREATE TABLE cean_fleets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE cean_workers (
      id TEXT PRIMARY KEY,
      fleet_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      url TEXT,
      error_count INTEGER DEFAULT 0,
      requests_total INTEGER DEFAULT 0,
      last_heartbeat TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (fleet_id) REFERENCES cean_fleets(id)
    );

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
      created_at TEXT NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES cean_workers(id)
    );
  `);

  fleetService = new FleetService(db);
});

afterEach(() => {
  db.close();
});

describe('FleetService', () => {
  it('should create a fleet', () => {
    const result = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    expect(result).toBeTruthy();

    const fleet = fleetService.getFleet(result);
    expect(fleet).toBeDefined();
    expect(fleet?.name).toBe('Test Fleet');
  });

  it('should retrieve all fleets', () => {
    fleetService.createFleet('fleet-1', 'us-west-1', 'Fleet 1');
    fleetService.createFleet('fleet-2', 'eu-west-1', 'Fleet 2');

    const fleets = fleetService.getAllFleets();
    expect(fleets).length(2);
    expect(fleets[0].name).toBe('Fleet 1');
  });

  it('should add a worker to fleet', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    const workerId = fleetService.addWorkerToFleet(
      fleetId,
      'worker-1',
      'test-worker',
      'https://worker.example.com'
    );

    expect(workerId).toBeTruthy();
    expect(workerId).toContain('worker-');
  });

  it('should get fleet health status', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');

    // Add 2 workers
    fleetService.addWorkerToFleet(fleetId, 'w1', 'worker-1', 'https://w1.com');
    fleetService.addWorkerToFleet(fleetId, 'w2', 'worker-2', 'https://w2.com');

    const health = fleetService.getFleetHealth(fleetId);

    expect(health).toBeDefined();
    expect(health?.worker_count).toBe(2);
    expect(health?.avg_error_rate).toBe(0);
  });

  it('should update worker status', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    const workerId = fleetService.addWorkerToFleet(
      fleetId,
      'w1',
      'worker-1',
      'https://w1.com'
    );

    fleetService.updateWorkerStatus(workerId, 'paused');

    const worker = fleetService.getWorker(workerId);
    expect(worker?.status).toBe('paused');
  });

  it('should increment worker error count', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    const workerId = fleetService.addWorkerToFleet(
      fleetId,
      'w1',
      'worker-1',
      'https://w1.com'
    );

    fleetService.incrementWorkerErrorCount(workerId, 5);

    const worker = fleetService.getWorker(workerId);
    expect(worker?.error_count).toBe(5);
  });

  it('should remove worker from fleet', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    const workerId = fleetService.addWorkerToFleet(
      fleetId,
      'w1',
      'worker-1',
      'https://w1.com'
    );

    const success = fleetService.removeWorkerFromFleet(workerId);
    expect(success).toBeTruthy();

    const worker = fleetService.getWorker(workerId);
    expect(worker).toBeUndefined();
  });

  it('should calculate error rate correctly', () => {
    const fleetId = fleetService.createFleet('test-fleet', 'us-west-1', 'Test Fleet');
    const workerId = fleetService.addWorkerToFleet(
      fleetId,
      'w1',
      'worker-1',
      'https://w1.com'
    );

    // Simulate 100 requests, 5 errors = 5% error rate
    const stmt = db.prepare(`
      UPDATE cean_workers
      SET requests_total = 100, error_count = 5
      WHERE id = ?
    `);
    stmt.run(workerId);

    const health = fleetService.getFleetHealth(fleetId);
    expect(health?.avg_error_rate).toBe(5); // 5% error rate
  });
});
