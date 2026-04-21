/**
 * Unit tests for ProcurementAgent
 * Tests automated negotiation, price comparison, and email drafting
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProcurementAgent } from '../src/agents/ProcurementAgent.js';
describe('ProcurementAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new ProcurementAgent();
    });
    describe('Agent Metadata', () => {
        it('should have correct name', () => {
            expect(agent.name).toBe('Procurement');
        });
        it('should have correct capabilities', () => {
            expect(agent.capabilities).toContain('price_comparison');
            expect(agent.capabilities).toContain('auto_negotiation');
            expect(agent.capabilities).toContain('email_drafting');
            expect(agent.capabilities).toContain('source_validation');
        });
    });
    describe('Price Comparison', () => {
        it('should compare prices across suppliers', async () => {
            const task = JSON.stringify({
                productCategory: 'Office Supplies',
                currentSupplier: 'SupplierA',
                currentPrice: 100000,
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.suppliers).toBeDefined();
            expect(Array.isArray(result.data.suppliers)).toBe(true);
        });
        it('should identify cost savings opportunities', async () => {
            const task = JSON.stringify({
                productCategory: 'Cloud Services',
                currentSupplier: 'Azure',
                currentPrice: 500000,
                targetPriceReduction: 15,
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.savingsOpportunity).toBeDefined();
        });
    });
    describe('Negotiation Email Generation', () => {
        it('should generate negotiation emails', async () => {
            const task = JSON.stringify({
                productCategory: 'IT Equipment',
                currentSupplier: 'Dell',
                currentPrice: 200000,
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.negotiationEmail).toBeDefined();
            expect(result.data.negotiationEmail).toHaveProperty('subject');
            expect(result.data.negotiationEmail).toHaveProperty('body');
        });
        it('should personalize email based on supplier', async () => {
            const task = JSON.stringify({
                productCategory: 'Software Licenses',
                currentSupplier: 'Microsoft',
                currentPrice: 1000000,
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.negotiationEmail.body).toBeDefined();
            // Should mention price or discount
            expect(result.data.negotiationEmail.body.toLowerCase()).toMatch(/ár|price|kedvezmény|discount/);
        });
    });
    describe('Source Validation', () => {
        it('should validate supplier credibility', async () => {
            const task = JSON.stringify({
                productCategory: 'Servers',
                currentSupplier: 'TechCorp',
                currentPrice: 5000000,
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.suppliers).toBeDefined();
            // Suppliers should have credibility scores
            if (result.data.suppliers.length > 0) {
                expect(result.data.suppliers[0]).toHaveProperty('credibility');
            }
        });
    });
    describe('Error Handling', () => {
        it('should handle invalid price values', async () => {
            const task = JSON.stringify({
                productCategory: 'Test',
                currentSupplier: 'Test',
                currentPrice: -100, // Invalid
            });
            const result = await agent.execute(task);
            // Should still succeed with defaults
            expect(result.status).toBe('success');
        });
    });
});
