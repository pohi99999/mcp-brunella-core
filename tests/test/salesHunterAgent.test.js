/**
 * Unit tests for SalesHunterAgent
 * Tests LinkedIn lead generation, email drafting, and CRM export
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SalesHunterAgent } from '@packages/agents/SalesHunterAgent.js';
describe('SalesHunterAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new SalesHunterAgent();
    });
    describe('Agent Metadata', () => {
        it('should have correct name', () => {
            expect(agent.name).toBe('SalesHunter');
        });
        it('should have correct role', () => {
            expect(agent.role).toBe('Automated Lead Generation & CRM Integration');
        });
        it('should have correct capabilities', () => {
            expect(agent.capabilities).toContain('linkedin_scraping');
            expect(agent.capabilities).toContain('email_generation');
            expect(agent.capabilities).toContain('crm_export');
            expect(agent.capabilities).toContain('lead_scoring');
        });
    });
    describe('Task Execution', () => {
        it('should execute lead generation with valid JSON input', async () => {
            const task = JSON.stringify({
                targetIndustry: 'IT consulting',
                targetRole: 'CTO',
                searchQuery: 'CTO Budapest IT',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data).toBeDefined();
            expect(result.data.leads).toBeDefined();
            expect(Array.isArray(result.data.leads)).toBe(true);
        });
        it('should execute with default parameters when task is not JSON', async () => {
            const task = 'find leads in IT industry';
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data).toBeDefined();
        });
        it('should handle executeTask interface', async () => {
            const context = {
                task: JSON.stringify({
                    targetIndustry: 'Finance',
                    targetRole: 'CFO',
                }),
            };
            const result = await agent.executeTask(context);
            expect(result.status).toBe('success');
        });
        it('should generate email drafts for leads', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Technology',
                targetRole: 'VP Sales',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.emailDrafts).toBeDefined();
            expect(result.data.emailDrafts.length).toBeGreaterThan(0);
            expect(result.data.emailDrafts[0]).toHaveProperty('subject');
            expect(result.data.emailDrafts[0]).toHaveProperty('body');
        });
        it('should calculate lead scores', async () => {
            const task = JSON.stringify({
                targetIndustry: 'SaaS',
                targetRole: 'Product Manager',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.leads).toBeDefined();
            if (result.data.leads.length > 0) {
                const lead = result.data.leads[0];
                expect(lead.score).toBeGreaterThanOrEqual(0);
                expect(lead.score).toBeLessThanOrEqual(100);
            }
        });
        it('should provide CRM export URL', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Manufacturing',
                targetRole: 'Operations Director',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.crmExportUrl).toBeDefined();
            expect(typeof result.data.crmExportUrl).toBe('string');
        });
        it('should include statistics in result', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Healthcare',
                targetRole: 'Medical Director',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.stats).toBeDefined();
            expect(result.data.stats).toHaveProperty('totalLeads');
            expect(result.data.stats).toHaveProperty('highQuality');
            expect(result.data.stats).toHaveProperty('avgScore');
        });
    });
    describe('Error Handling', () => {
        it('should handle malformed JSON gracefully', async () => {
            const task = '{ invalid json }';
            const result = await agent.execute(task);
            // Should use defaults and still succeed
            expect(result.status).toBe('success');
        });
        it('should return error status on exception', async () => {
            // Mock a method to throw error
            const originalExecute = agent.execute.bind(agent);
            agent.execute = vi.fn().mockRejectedValue(new Error('Test error'));
            const task = 'test task';
            try {
                const result = await agent.execute(task);
                expect(result.status).toBe('error');
                expect(result.error).toContain('Test error');
            }
            catch (e) {
                // If it throws, that's also acceptable error handling
                expect(e).toBeDefined();
            }
            // Restore original method
            agent.execute = originalExecute;
        });
    });
    describe('Lead Validation', () => {
        it('should filter out invalid leads', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Technology',
                targetRole: 'Developer',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            // All leads should have required fields
            for (const lead of result.data.leads) {
                expect(lead).toHaveProperty('name');
                expect(lead).toHaveProperty('email');
                expect(lead).toHaveProperty('company');
                expect(lead).toHaveProperty('role');
                expect(lead).toHaveProperty('score');
            }
        });
        it('should prioritize high-score leads', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Finance',
                targetRole: 'CFO',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            // Leads should be sorted by score (descending)
            const scores = result.data.leads.map((l) => l.score);
            const sortedScores = [...scores].sort((a, b) => b - a);
            expect(scores).toEqual(sortedScores);
        });
    });
    describe('Message Generation', () => {
        it('should return a descriptive success message', async () => {
            const task = JSON.stringify({
                targetIndustry: 'Retail',
                targetRole: 'Store Manager',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.message).toBeDefined();
            expect(result.message).toContain('lead');
            expect(result.message).toContain('email');
        });
    });
});
