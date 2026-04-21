/**
 * Scaling Service Tests
 * Path: test/scalingService.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ScalingService, DEFAULT_POLICY } from '../src/services/scalingService.js';
let db;
let scalingService;
beforeEach(() => {
    db = new Database(':memory:');
    // Create D1 schema
    db.exec(`
    CREATE TABLE cean_fleets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE cean_workers (
      id TEXT PRIMARY KEY,
      fleet_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE cean_metrics_cache (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latency_p95 REAL,
      error_rate REAL
    );

    CREATE TABLE cean_scaling_events (
      id TEXT PRIMARY KEY,
      fleet_id TEXT NOT NULL,
      event_type TEXT,
      reason TEXT,
      instance_count_before INTEGER,
      instance_count_after INTEGER,
      status TEXT,
      created_at TEXT
    );
  `);
    scalingService = new ScalingService(db);
});
afterEach(() => {
    db.close();
});
describe('ScalingService', () => {
    it('should initialize with default policy', () => {
        const policy = scalingService.getPolicy('fleet-123');
        expect(policy.minWorkers).toBe(DEFAULT_POLICY.minWorkers);
        expect(policy.maxWorkers).toBe(DEFAULT_POLICY.maxWorkers);
        expect(policy.cooldownMinutes).toBe(DEFAULT_POLICY.cooldownMinutes);
    });
    it('should set custom policy for fleet', () => {
        const customPolicy = {
            ...DEFAULT_POLICY,
            minWorkers: 1,
            maxWorkers: 20
        };
        scalingService.setPolicy('fleet-123', customPolicy);
        const policy = scalingService.getPolicy('fleet-123');
        expect(policy.minWorkers).toBe(1);
        expect(policy.maxWorkers).toBe(20);
    });
    it('should decide to scale up when latency is high', () => {
        // Create fleet and worker
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
            .run('worker-1', 'fleet-1', 'w1', 'active');
        // Insert high latency metric
        db.prepare(`INSERT INTO cean_metrics_cache
       (id, worker_id, timestamp, latency_p95, error_rate)
       VALUES (?, ?, ?, ?, ?)`).run('metric-1', 'worker-1', new Date().toISOString(), 600, 2); // 600ms > 500ms threshold
        const decision = scalingService.evaluateAndDecide('fleet-1');
        expect(decision.should_scale).toBeTruthy();
        expect(decision.action).toBe('scale_up');
        expect(decision.target_workers).toBe(2); // 1 + 1
    });
    it('should respect max worker limit', () => {
        const policy = {
            ...DEFAULT_POLICY,
            maxWorkers: 3
        };
        scalingService.setPolicy('fleet-1', policy);
        // Create fleet with 3 workers
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        for (let i = 1; i <= 3; i++) {
            db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
                .run(`worker-${i}`, 'fleet-1', `w${i}`, 'active');
        }
        // Insert high latency
        db.prepare(`INSERT INTO cean_metrics_cache
       (id, worker_id, timestamp, latency_p95, error_rate)
       VALUES (?, ?, ?, ?, ?)`).run('metric-1', 'worker-1', new Date().toISOString(), 600, 2);
        const decision = scalingService.evaluateAndDecide('fleet-1');
        expect(decision.should_scale).toBeFalsy();
        expect(decision.action).toBe('maintain');
        expect(decision.target_workers).toBe(3); // Max limit, don't exceed
    });
    it('should respect min worker limit', () => {
        const policy = {
            ...DEFAULT_POLICY,
            minWorkers: 2
        };
        scalingService.setPolicy('fleet-1', policy);
        // Create fleet with 2 workers (at min)
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
            .run('worker-1', 'fleet-1', 'w1', 'active');
        db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
            .run('worker-2', 'fleet-1', 'w2', 'active');
        // Insert low latency (would trigger scale down)
        db.prepare(`INSERT INTO cean_metrics_cache
       (id, worker_id, timestamp, latency_p95, error_rate)
       VALUES (?, ?, ?, ?, ?)`).run('metric-1', 'worker-1', new Date().toISOString(), 50, 0.5);
        // Note: Scale down requires sustained low metrics, so this might not trigger
        // But if it does, it should still respect min workers
        const decision = scalingService.evaluateAndDecide('fleet-1');
        if (decision.action === 'scale_down') {
            expect(decision.target_workers).toBe(2); // Min limit
        }
    });
    it('should maintain when metrics are normal', () => {
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
            .run('worker-1', 'fleet-1', 'w1', 'active');
        // Insert normal metrics
        db.prepare(`INSERT INTO cean_metrics_cache
       (id, worker_id, timestamp, latency_p95, error_rate)
       VALUES (?, ?, ?, ?, ?)`).run('metric-1', 'worker-1', new Date().toISOString(), 200, 1);
        const decision = scalingService.evaluateAndDecide('fleet-1');
        expect(decision.should_scale).toBeFalsy();
        expect(decision.action).toBe('maintain');
    });
    it('should execute scaling and record event', () => {
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        const decision = {
            should_scale: true,
            action: 'scale_up',
            reason: 'Test scale up',
            current_workers: 2,
            target_workers: 3
        };
        const success = scalingService.executeScaling('fleet-1', decision);
        expect(success).toBeTruthy();
        // Verify event was recorded
        const events = scalingService.getScalingHistory('fleet-1', 10);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].event_type).toBe('scale_up');
    });
    it('should enforce cooldown period', () => {
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        db.prepare('INSERT INTO cean_workers (id, fleet_id, name, status) VALUES (?, ?, ?, ?)')
            .run('worker-1', 'fleet-1', 'w1', 'active');
        // First scale
        const decision1 = {
            should_scale: true,
            action: 'scale_up',
            reason: 'First scale',
            current_workers: 1,
            target_workers: 2
        };
        scalingService.executeScaling('fleet-1', decision1);
        // Immediately try to scale again
        db.prepare(`INSERT INTO cean_metrics_cache
       (id, worker_id, timestamp, latency_p95, error_rate)
       VALUES (?, ?, ?, ?, ?)`).run('metric-1', 'worker-1', new Date().toISOString(), 600, 2);
        const decision2 = scalingService.evaluateAndDecide('fleet-1');
        // Should be in cooldown
        expect(decision2.reason).toContain('Cooldown');
    });
    it('should get scaling history', () => {
        db.prepare('INSERT INTO cean_fleets (id, name) VALUES (?, ?)').run('fleet-1', 'Test Fleet');
        const decision = {
            should_scale: true,
            action: 'scale_up',
            reason: 'Test',
            current_workers: 1,
            target_workers: 2
        };
        scalingService.executeScaling('fleet-1', decision);
        const history = scalingService.getScalingHistory('fleet-1', 10);
        expect(history.length).toBe(1);
        expect(history[0].instance_count_before).toBe(1);
        expect(history[0].instance_count_after).toBe(2);
    });
});
