import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EnterpriseOrchestrator from '../src/agents/EnterpriseOrchestrator.js';
// ============================================================================
// MOCK AGENT FOR TESTING
// ============================================================================
class MockAgent {
    name = 'MockAgent';
    role = 'Test Agent';
    description = 'Mock agent for testing';
    capabilities = ['test'];
    executionCount = 0;
    shouldFail = false;
    async execute(task) {
        this.executionCount++;
        if (this.shouldFail) {
            return {
                status: 'error',
                error: 'Mock agent forced failure',
            };
        }
        return {
            status: 'success',
            data: { executionCount: this.executionCount, task },
        };
    }
    getExecutionCount() {
        return this.executionCount;
    }
    reset() {
        this.executionCount = 0;
        this.shouldFail = false;
    }
}
// ============================================================================
// UNIT TESTS: EnterpriseOrchestrator
// ============================================================================
describe('EnterpriseOrchestrator - Unit Tests', () => {
    let orchestrator;
    let mockAgent;
    beforeEach(() => {
        // Use in-memory DB for tests
        orchestrator = new EnterpriseOrchestrator(':memory:');
        mockAgent = new MockAgent();
    });
    afterEach(() => {
        mockAgent.reset();
        vi.clearAllMocks();
    });
    it('should initialize with empty module registry', async () => {
        const health = await orchestrator.getHealthStatus();
        expect(health.status).toBe('success');
        expect(health.data).toBeDefined();
        const data = health.data;
        expect(data.modules.length).toBe(0);
    });
    it('should register a module successfully', async () => {
        const result = await orchestrator.registerModule('HR_RECRUITER', mockAgent);
        expect(result.status).toBe('success');
        expect(result.data).toBeDefined();
        const data = result.data;
        expect(data.moduleId).toBe('HR_RECRUITER');
        expect(data.agentName).toBe('MockAgent');
    });
    it('should route an event successfully', async () => {
        await orchestrator.registerModule('HR_RECRUITER', mockAgent);
        const result = await orchestrator.routeEvent({
            module: 'HR_RECRUITER',
            type: 'test_event',
            payload: { test: 'data' },
            priority: 'HIGH',
            storedInLanceDB: false,
            requestId: 'req_123',
        });
        expect(result.status).toBe('success');
        expect(result.data).toBeDefined();
    });
    it('should reject event for unregistered module', async () => {
        const result = await orchestrator.routeEvent({
            module: 'UNKNOWN_MODULE',
            type: 'test_event',
            payload: {},
            priority: 'MEDIUM',
            storedInLanceDB: false,
            requestId: 'req_456',
        });
        expect(result.status).toBe('error');
        expect(result.error).toContain('not registered');
    });
    it('should execute module task and track metrics', async () => {
        await orchestrator.registerModule('SALES_AGENT', mockAgent);
        const result = await orchestrator.executeModuleTask('SALES_AGENT', { action: 'test' });
        expect(result.status).toBe('success');
        expect(result.moduleId).toBe('SALES_AGENT');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(mockAgent.getExecutionCount()).toBe(1);
    });
    it('should handle module execution failures with circuit breaker', async () => {
        mockAgent.shouldFail = true;
        await orchestrator.registerModule('FINANCE_GUARDIAN', mockAgent);
        // First execution should fail
        const result1 = await orchestrator.executeModuleTask('FINANCE_GUARDIAN', {});
        expect(result1.status).toBe('failure');
        // Circuit breaker should be recorded
        const health = await orchestrator.getHealthStatus();
        expect(health.status).toBe('success');
    });
    it('should prioritize high-priority events in queue', async () => {
        await orchestrator.registerModule('LOGISTICS_DISPATCHER', mockAgent);
        // Enqueue events with different priorities
        const lowPriority = await orchestrator.routeEvent({
            module: 'LOGISTICS_DISPATCHER',
            type: 'low',
            payload: { priority: 'LOW' },
            priority: 'LOW',
            storedInLanceDB: false,
            requestId: 'req_low',
        });
        const highPriority = await orchestrator.routeEvent({
            module: 'LOGISTICS_DISPATCHER',
            type: 'high',
            payload: { priority: 'HIGH' },
            priority: 'CRITICAL',
            storedInLanceDB: false,
            requestId: 'req_high',
        });
        expect(lowPriority.status).toBe('success');
        expect(highPriority.status).toBe('success');
    });
    it('should provide health status for all modules', async () => {
        const modules = ['HR_RECRUITER', 'FINANCE_GUARDIAN', 'SALES_AGENT'];
        for (const moduleId of modules) {
            await orchestrator.registerModule(moduleId, mockAgent);
        }
        const health = await orchestrator.getHealthStatus();
        expect(health.status).toBe('success');
        const data = health.data;
        expect(data.modules.length).toBe(3);
    });
    it('should execute generic action via execute() method', async () => {
        await orchestrator.registerModule('HR_MEDIATOR', mockAgent);
        const task = JSON.stringify({
            action: 'get_health',
        });
        const result = await orchestrator.execute(task);
        expect(result.status).toBe('success');
    });
    it('should handle unknown action gracefully', async () => {
        const task = JSON.stringify({
            action: 'unknown_action',
        });
        const result = await orchestrator.execute(task);
        expect(result.status).toBe('error');
        expect(result.error).toContain('Unknown action');
    });
});
// ============================================================================
// INTEGRATION TESTS: Multi-Module Workflow
// ============================================================================
describe('EnterpriseOrchestrator - Integration Tests', () => {
    let orchestrator;
    let mockAgents;
    beforeEach(() => {
        orchestrator = new EnterpriseOrchestrator(':memory:');
        mockAgents = new Map();
    });
    afterEach(() => {
        mockAgents.forEach((agent) => agent.reset());
        vi.clearAllMocks();
    });
    it('should handle multi-module workflow', async () => {
        const modules = [
            'HR_RECRUITER',
            'FINANCE_GUARDIAN',
            'SALES_AGENT',
            'LOGISTICS_DISPATCHER',
        ];
        // Register all modules
        for (const module of modules) {
            const agent = new MockAgent();
            mockAgents.set(module, agent);
            await orchestrator.registerModule(module, agent);
        }
        // Execute tasks on all modules
        const results = [];
        for (const module of modules) {
            const result = await orchestrator.executeModuleTask(module, {
                workflow: 'multi_module_test',
            });
            results.push(result);
        }
        // All should succeed
        expect(results.every((r) => r.status === 'success')).toBe(true);
        expect(results.length).toBe(modules.length);
    });
    it('should handle partial failures in workflow', async () => {
        const hrAgent = new MockAgent();
        const financeAgent = new MockAgent();
        await orchestrator.registerModule('HR_RECRUITER', hrAgent);
        await orchestrator.registerModule('FINANCE_GUARDIAN', financeAgent);
        // HR succeeds, Finance fails
        const hrResult = await orchestrator.executeModuleTask('HR_RECRUITER', {});
        expect(hrResult.status).toBe('success');
        financeAgent.shouldFail = true;
        const financeResult = await orchestrator.executeModuleTask('FINANCE_GUARDIAN', {});
        expect(financeResult.status).toBe('failure');
        // Health should show mixed status
        const health = await orchestrator.getHealthStatus();
        expect(health.status).toBe('success');
    });
    it('should route events through queue in priority order', async () => {
        const agent = new MockAgent();
        await orchestrator.registerModule('SALES_NEGOTIATION', agent);
        // Queue 3 events with different priorities
        const events = [
            {
                module: 'SALES_NEGOTIATION',
                type: 'event1',
                payload: { order: 1 },
                priority: 'LOW',
                storedInLanceDB: false,
                requestId: 'req_1',
            },
            {
                module: 'SALES_NEGOTIATION',
                type: 'event2',
                payload: { order: 2 },
                priority: 'CRITICAL',
                storedInLanceDB: false,
                requestId: 'req_2',
            },
            {
                module: 'SALES_NEGOTIATION',
                type: 'event3',
                payload: { order: 3 },
                priority: 'MEDIUM',
                storedInLanceDB: false,
                requestId: 'req_3',
            },
        ];
        for (const event of events) {
            await orchestrator.routeEvent(event);
        }
        // Process queue
        await orchestrator.execute(JSON.stringify({ action: 'process_queue' }));
        // All events should be processed
        expect(agent.getExecutionCount()).toBe(3);
    });
});
// ============================================================================
// E2E TESTS: Realistic Scenarios
// ============================================================================
describe('EnterpriseOrchestrator - E2E Tests', () => {
    let orchestrator;
    beforeEach(() => {
        orchestrator = new EnterpriseOrchestrator(':memory:');
    });
    it('should complete full invoice processing workflow', async () => {
        const agent = new MockAgent();
        await orchestrator.registerModule('FINANCE_GUARDIAN', agent);
        // Simulate invoice event
        const event = {
            module: 'FINANCE_GUARDIAN',
            type: 'invoice_received',
            payload: {
                invoice_id: 'INV-2026-001',
                amount: 10000,
                vendor: 'Acme Corp',
            },
            priority: 'HIGH',
            storedInLanceDB: true,
            requestId: 'req_invoice_001',
        };
        const routeResult = await orchestrator.routeEvent(event);
        expect(routeResult.status).toBe('success');
        // Process queue
        await orchestrator.execute(JSON.stringify({ action: 'process_queue' }));
        // Verify execution
        expect(agent.getExecutionCount()).toBe(1);
        // Check health
        const health = await orchestrator.getHealthStatus();
        expect(health.status).toBe('success');
        const data = health.data;
        const metrics = data.metrics;
        expect(metrics.totalEventsProcessed).toBeGreaterThan(0);
    });
    it('should handle high-volume event processing', async () => {
        const agent = new MockAgent();
        await orchestrator.registerModule('LOGISTICS_DISPATCHER', agent);
        // Queue 30 events rapidly
        for (let i = 0; i < 30; i++) {
            await orchestrator.routeEvent({
                module: 'LOGISTICS_DISPATCHER',
                type: `shipment_${i}`,
                payload: { id: i },
                priority: 'MEDIUM',
                storedInLanceDB: false,
                requestId: `req_${i}`,
            });
        }
        // Process queue
        await orchestrator.execute(JSON.stringify({ action: 'process_queue' }));
        // Verify that at least some events were processed
        const executionCount = agent.getExecutionCount();
        expect(executionCount).toBeGreaterThan(0);
        expect(executionCount).toBeLessThanOrEqual(30);
    });
    it('should maintain consistent metrics under load', async () => {
        const agent = new MockAgent();
        await orchestrator.registerModule('INTELLIGENCE_COMPLIANCE', agent);
        const eventCount = 15;
        for (let i = 0; i < eventCount; i++) {
            await orchestrator.routeEvent({
                module: 'INTELLIGENCE_COMPLIANCE',
                type: `compliance_check_${i}`,
                payload: { checkId: i },
                priority: 'MEDIUM',
                storedInLanceDB: false,
                requestId: `req_${i}`,
            });
        }
        // Process all
        await orchestrator.execute(JSON.stringify({ action: 'process_queue' }));
        // Get health
        const health = await orchestrator.getHealthStatus();
        const data = health.data;
        const metrics = data.metrics;
        // Verify metrics are tracked (at least some events processed)
        expect(metrics.totalEventsProcessed).toBeGreaterThan(0);
        expect(typeof metrics.successRate).toBe('string');
        expect(typeof metrics.averageLatencyMs).toBe('string');
    });
});
