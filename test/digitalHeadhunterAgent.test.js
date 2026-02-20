/**
 * Unit tests for DigitalHeadhunterAgent
 * Tests CV parsing, candidate matching, and interview scheduling
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DigitalHeadhunterAgent } from '../src/agents/DigitalHeadhunterAgent.js';
describe('DigitalHeadhunterAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new DigitalHeadhunterAgent();
    });
    describe('Agent Metadata', () => {
        it('should have correct name', () => {
            expect(agent.name).toBe('DigitalHeadhunter');
        });
        it('should have correct capabilities', () => {
            expect(agent.capabilities).toContain('cv_parsing');
            expect(agent.capabilities).toContain('candidate_matching');
            expect(agent.capabilities).toContain('interview_scheduling');
            expect(agent.capabilities).toContain('linkedin_integration');
        });
    });
    describe('CV Parsing', () => {
        it('should parse CV data', async () => {
            const task = JSON.stringify({
                cvPath: '/cvs/candidate-123.pdf',
                position: 'Senior Developer',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.parsedCV).toBeDefined();
            expect(result.data.parsedCV).toHaveProperty('skills');
            expect(result.data.parsedCV).toHaveProperty('experience');
        });
        it('should extract skills from CV', async () => {
            const task = JSON.stringify({
                cvText: 'TypeScript, React, Node.js, 5 years experience',
                position: 'Frontend Developer',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.parsedCV.skills).toBeDefined();
            expect(result.data.parsedCV.skills.length).toBeGreaterThan(0);
        });
    });
    describe('Candidate Matching', () => {
        it('should match candidates to positions', async () => {
            const task = JSON.stringify({
                position: 'DevOps Engineer',
                requiredSkills: ['Docker', 'Kubernetes', 'AWS'],
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.matchScore).toBeDefined();
            expect(result.data.matchScore).toBeGreaterThanOrEqual(0);
            expect(result.data.matchScore).toBeLessThanOrEqual(100);
        });
        it('should prioritize high-match candidates', async () => {
            const task = JSON.stringify({
                position: 'Data Scientist',
                requiredSkills: ['Python', 'Machine Learning', 'SQL'],
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.topCandidates).toBeDefined();
        });
    });
    describe('Interview Scheduling', () => {
        it('should suggest interview slots', async () => {
            const task = JSON.stringify({
                candidateEmail: 'candidate@example.com',
                position: 'Product Manager',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.interviewSlots).toBeDefined();
        });
        it('should generate interview invitation email', async () => {
            const task = JSON.stringify({
                candidateName: 'Jane Doe',
                position: 'UX Designer',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.invitationEmail).toBeDefined();
            expect(result.data.invitationEmail).toHaveProperty('subject');
            expect(result.data.invitationEmail).toHaveProperty('body');
        });
    });
    describe('LinkedIn Integration', () => {
        it('should search LinkedIn for candidates', async () => {
            const task = JSON.stringify({
                position: 'Marketing Manager',
                location: 'Budapest',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.linkedInProfiles).toBeDefined();
        });
    });
    describe('Error Handling', () => {
        it('should handle missing CV file', async () => {
            const task = JSON.stringify({
                cvPath: '/nonexistent.pdf',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
        });
    });
});
