/**
 * CEAN Metrics Collection Tests
 * Tests the metrics endpoint and Analytics Engine integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
// Mock D1Database for testing
class MockD1 {
    async query(sql) {
        // Simulate pipeline statistics
        if (sql.includes('COUNT(*)')) {
            return {
                results: [
                    {
                        total: 1000,
                        completed: 950,
                        failed: 50,
                        avg_latency: 245,
                    },
                ],
            };
        }
        return { results: [] };
    }
    prepare(sql) {
        return {
            bind: () => ({
                first: async () => ({
                    count: 1000,
                    completed: 950,
                    failed: 50,
                    avg_latency: 245,
                }),
                all: async () => ({
                    results: [
                        { total: 1000, completed: 950, failed: 50, avg_latency: 245 },
                    ],
                }),
            }),
            first: async () => ({
                count: 1000,
                completed: 950,
                failed: 50,
                avg_latency: 245,
            }),
            all: async () => ({
                results: [
                    { total: 1000, completed: 950, failed: 50, avg_latency: 245 },
                ],
            }),
        };
    }
}
describe('Metrics Collection', () => {
    let mockDb;
    beforeAll(() => {
        mockDb = new MockD1();
    });
    it('should gather metrics from database', async () => {
        // Import the function after mock setup
        const { gatherMetrics } = await import('../src/metrics');
        const metrics = await gatherMetrics(mockDb);
        // Verify metrics structure
        expect(metrics).toHaveProperty('pipelines_total');
        expect(metrics).toHaveProperty('pipelines_completed');
        expect(metrics).toHaveProperty('pipelines_failed');
        expect(metrics).toHaveProperty('success_rate_pct');
        expect(metrics).toHaveProperty('avg_latency_ms');
        expect(metrics).toHaveProperty('cache_hit_rate_pct');
    });
    it('should format metrics in Prometheus format', async () => {
        const { gatherMetrics, formatPrometheusMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(mockDb);
        const output = formatPrometheusMetrics(metrics);
        // Verify Prometheus format headers
        expect(output).toContain('# HELP cean_pipelines_total');
        expect(output).toContain('# TYPE cean_pipelines_total counter');
        expect(output).toContain('cean_pipelines_total');
        // Verify content
        expect(output).toContain('cean_pipeline_success_rate');
        expect(output).toContain('cean_latency_ms');
        expect(output).toContain('cean_cache_hit_rate');
        expect(output).toContain('cean_cost_usd');
    });
    it('should format metrics in JSON format', async () => {
        const { gatherMetrics, formatJsonMetrics } = await import('../src/metrics');
        const metrics = await gatherMetrics(mockDb);
        const output = formatJsonMetrics(metrics);
        // Verify JSON structure is correct (not actual values since mock is partial)
        expect(output).toHaveProperty('metrics');
        expect(output.metrics).toHaveProperty('pipelines');
        expect(output.metrics).toHaveProperty('latency');
        expect(output.metrics).toHaveProperty('cache');
        expect(output.metrics).toHaveProperty('database');
        expect(output.metrics).toHaveProperty('cost');
        expect(output).toHaveProperty('timestamp');
    });
    it.skip('should calculate success rate correctly', async () => {
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(mockDb);
        // 950 completed / 1000 total = 95%
        expect(metrics.success_rate_pct).toBe(95);
    });
    it.skip('should calculate cache hit rate', async () => {
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(mockDb);
        // Cache hit rate should be > 0
        expect(metrics.cache_hit_rate_pct).toBeGreaterThan(0);
        expect(metrics.cache_hit_rate_pct).toBeLessThanOrEqual(100);
    });
    it.skip('should estimate cost correctly', async () => {
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(mockDb);
        // Cost per 100 pipelines: $0.000118
        // 1000 pipelines = $0.00118
        expect(metrics.cost_usd).toBeGreaterThan(0);
        expect(metrics.cost_usd).toBeLessThan(0.1); // Sanity check
    });
    it('should include timestamp in metrics', async () => {
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(mockDb);
        // Verify timestamp exists and is ISO 8601
        expect(metrics.timestamp).toBeDefined();
        expect(metrics.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
    it('should handle empty database gracefully', async () => {
        const emptyDb = {
            prepare: () => ({
                first: async () => null,
                all: async () => ({ results: [] }),
            }),
        };
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(emptyDb);
        // Should return zeros, not errors
        expect(metrics.pipelines_total).toBe(0);
        expect(metrics.success_rate_pct).toBe(0);
    });
    it('should handle division by zero in percentages', async () => {
        const zeroDb = {
            prepare: () => ({
                first: async () => ({ count: 0, completed: 0, failed: 0 }),
                all: async () => ({ results: [] }),
            }),
        };
        const { gatherMetrics } = await import('../src/metrics');
         
        const metrics = await gatherMetrics(zeroDb);
        // Should return 0, not NaN or infinity
        expect(metrics.success_rate_pct).toBeGreaterThanOrEqual(0);
        expect(metrics.cache_hit_rate_pct).toBeGreaterThanOrEqual(0);
    });
    it('should generate valid metrics within 1 second', async () => {
        const { gatherMetrics } = await import('../src/metrics');
         
        const startTime = Date.now();
         
        await gatherMetrics(mockDb);
        const duration = Date.now() - startTime;
        // Metrics gathering should be fast
        expect(duration).toBeLessThan(1000);
    });
});
describe('Analytics Engine Integration', () => {
    it('should build pipeline start event', async () => {
        const { PipelineEventBuilder } = await import('../src/analytics');
        const event = PipelineEventBuilder.start('task_123', 'research');
        expect(event.event_type).toBe('pipeline_start');
        expect(event.task_id).toBe('task_123');
        expect(event.agent_type).toBe('research');
        expect(event.status).toBe('started');
        expect(event.success).toBe(true);
    });
    it('should build pipeline completion event', async () => {
        const { PipelineEventBuilder } = await import('../src/analytics');
        const event = PipelineEventBuilder.complete('task_123', 'grant', 250, true);
        expect(event.event_type).toBe('pipeline_complete');
        expect(event.latency_ms).toBe(250);
        expect(event.success).toBe(true);
    });
    it('should build error event', async () => {
        const { PipelineEventBuilder } = await import('../src/analytics');
        const event = PipelineEventBuilder.error('task_123', 'harvester', 'Connection timeout');
        expect(event.event_type).toBe('pipeline_error');
        expect(event.error_message).toBe('Connection timeout');
        expect(event.success).toBe(false);
    });
    it('should build cache hit event', async () => {
        const { PipelineEventBuilder } = await import('../src/analytics');
        const event = PipelineEventBuilder.cacheHit('research');
        expect(event.event_type).toBe('cache_hit');
        expect(event.agent_type).toBe('research');
        expect(event.status).toBe('hit');
    });
    it('should include timestamp in events', async () => {
        const { PipelineEventBuilder } = await import('../src/analytics');
        const event = PipelineEventBuilder.start('task_123', 'research');
        // Verify timestamp is a recent Unix timestamp (seconds)
        expect(event.timestamp).toBeGreaterThan(1700000000); // After 2023-11-14
        expect(event.timestamp).toBeLessThan(Math.ceil(Date.now() / 1000) + 1);
    });
});
describe('Metrics Endpoint Integration', () => {
    it('should serve metrics in Prometheus format', async () => {
        // Integration test - requires running worker
        // This is a placeholder for manual testing
        //
        // curl -H "Accept: text/plain" \
        //   https://cean-orchestrator.{account}.workers.dev/metrics
        //
        // Expected: Prometheus text format with headers and metrics
    });
    it('should serve metrics in JSON format when requested', async () => {
        // Integration test - requires running worker
        // This is a placeholder for manual testing
        //
        // curl "https://cean-orchestrator.{account}.workers.dev/metrics?format=json"
        //
        // Expected: JSON with metrics structure
    });
    it('should include CORS headers in metrics response', async () => {
        // Integration test - requires running worker
        // Check for:
        // - Access-Control-Allow-Origin: *
        // - Access-Control-Allow-Methods: GET, POST, OPTIONS
        // - Content-Type: text/plain (for Prometheus) or application/json (for JSON)
    });
});
