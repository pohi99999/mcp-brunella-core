/**
 * Unit tests for ConflictMediatorAgent
 * Tests conflict detection, resolution suggestions, and HR notifications
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictMediatorAgent } from '@packages/agents/ConflictMediatorAgent.js';
describe('ConflictMediatorAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new ConflictMediatorAgent();
    });
    describe('Agent Metadata', () => {
        it('should have correct name', () => {
            expect(agent.name).toBe('ConflictMediator');
        });
        it('should have correct capabilities', () => {
            expect(agent.capabilities).toContain('conflict_detection');
            expect(agent.capabilities).toContain('sentiment_analysis');
            expect(agent.capabilities).toContain('resolution_suggestions');
            expect(agent.capabilities).toContain('hr_notification');
        });
    });
    describe('Conflict Detection', () => {
        it('should detect conflicts in messages', async () => {
            const task = JSON.stringify({
                message: 'This is completely unacceptable! You never deliver on time!',
                from: 'employee1@company.com',
                to: 'employee2@company.com',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.conflictDetected).toBe(true);
        });
        it('should not flag normal communication', async () => {
            const task = JSON.stringify({
                message: 'Thanks for the update, looks good!',
                from: 'manager@company.com',
                to: 'team@company.com',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.conflictDetected).toBe(false);
        });
    });
    describe('Sentiment Analysis', () => {
        it('should analyze negative sentiment', async () => {
            const task = JSON.stringify({
                message: 'I am extremely frustrated with this situation.',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.sentimentScore).toBeLessThan(5);
        });
        it('should analyze positive sentiment', async () => {
            const task = JSON.stringify({
                message: 'Great work everyone! This is amazing progress.',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.sentimentScore).toBeGreaterThan(7);
        });
    });
    describe('Resolution Suggestions', () => {
        it('should suggest conflict resolution steps', async () => {
            const task = JSON.stringify({
                conflictType: 'deadline_dispute',
                parties: ['TeamA', 'TeamB'],
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.resolutionSteps).toBeDefined();
            expect(Array.isArray(result.data.resolutionSteps)).toBe(true);
            expect(result.data.resolutionSteps.length).toBeGreaterThan(0);
        });
    });
    describe('HR Notification', () => {
        it('should notify HR for severe conflicts', async () => {
            const task = JSON.stringify({
                conflictSeverity: 'high',
                message: 'Serious workplace harassment incident',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.hrNotified).toBe(true);
        });
        it('should not notify HR for minor issues', async () => {
            const task = JSON.stringify({
                conflictSeverity: 'low',
                message: 'Minor scheduling disagreement',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.hrNotified).toBe(false);
        });
    });
    describe('Error Handling', () => {
        it('should handle empty messages', async () => {
            const task = JSON.stringify({
                message: '',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
        });
    });
});
