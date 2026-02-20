/**
 * Enterprise Orchestrator Agent - Unit Tests
 *
 * Test suite for enterprise event parsing, routing, and priority assignment.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EnterpriseOrchestratorAgent } from '../src/agents/EnterpriseOrchestratorAgent.js';
describe('EnterpriseOrchestratorAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new EnterpriseOrchestratorAgent();
    });
    // ==========================================================================
    // Basic Initialization
    // ==========================================================================
    describe('Initialization', () => {
        it('should initialize with correct properties', () => {
            expect(agent.name).toBe('EnterpriseOrchestrator');
            expect(agent.role).toBe('Enterprise Suite Coordinator');
            expect(agent.capabilities).toContain('enterprise_event_parsing');
            expect(agent.capabilities).toContain('priority_assignment');
            expect(agent.capabilities).toContain('module_routing');
        });
    });
    // ==========================================================================
    // Module Detection
    // ==========================================================================
    describe('Module Detection', () => {
        it('should detect HR module from recruitment keywords', async () => {
            const input = 'We need to hire a software developer, please screen CVs';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.module).toBe('HR');
            expect(event.type).toBe('recruitment');
        });
        it('should detect FINANCE module from invoice keywords', async () => {
            const input = 'Process this invoice from Test Supplier Ltd.';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.module).toBe('FINANCE');
            expect(event.type).toBe('invoice_processing');
        });
        it('should detect SALES module from lead generation keywords', async () => {
            const input = 'Generate leads for industrial equipment companies';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.module).toBe('SALES');
            expect(event.type).toBe('lead_generation');
        });
    });
    // ==========================================================================
    // Priority Assignment
    // ==========================================================================
    describe('Priority Assignment', () => {
        it('should assign CRITICAL priority for urgent keywords', async () => {
            const input = 'URGENT: Invoice overdue, payment required immediately';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.priority).toBe('CRITICAL');
        });
        it('should assign HIGH priority for important keywords', async () => {
            const input = 'Important: New lead from potential client';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.priority).toBe('HIGH');
        });
        it('should assign MEDIUM priority by default', async () => {
            const input = 'Process this invoice';
            const event = await agent.parseEnterpriseIntent(input);
            expect(event.priority).toBe('MEDIUM');
        });
    });
    // ==========================================================================
    // Event Structure Validation
    // ==========================================================================
    describe('Event Structure', () => {
        it('should generate unique event IDs', async () => {
            const event1 = await agent.parseEnterpriseIntent('Test input 1');
            const event2 = await agent.parseEnterpriseIntent('Test input 2');
            expect(event1.id).toBeDefined();
            expect(event2.id).toBeDefined();
            expect(event1.id).not.toBe(event2.id);
        });
        it('should include timestamp in ISO format', async () => {
            const event = await agent.parseEnterpriseIntent('Test input');
            expect(event.timestamp).toBeDefined();
            expect(() => new Date(event.timestamp)).not.toThrow();
        });
        it('should set storedInLanceDB to true by default', async () => {
            const event = await agent.parseEnterpriseIntent('Test input');
            expect(event.storedInLanceDB).toBe(true);
        });
    });
});
