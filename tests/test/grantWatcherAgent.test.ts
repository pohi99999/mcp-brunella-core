/**
 * Unit tests for GrantWatcherAgent
 * Tests grant tracking, deadline monitoring, and application drafting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GrantWatcherAgent } from '@packages/agents/GrantWatcherAgent.js';

describe('GrantWatcherAgent', () => {
  let agent: GrantWatcherAgent;

  beforeEach(() => {
    agent = new GrantWatcherAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('GrantWatcher');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('grant_tracking');
      expect(agent.capabilities).toContain('deadline_monitoring');
      expect(agent.capabilities).toContain('application_drafting');
      expect(agent.capabilities).toContain('eligibility_check');
    });
  });

  describe('Grant Tracking', () => {
    it('should track available grants', async () => {
      const task = JSON.stringify({
        industry: 'IT',
        location: 'Hungary',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.grants).toBeDefined();
      expect(Array.isArray(result.data.grants)).toBe(true);
    });

    it('should filter grants by industry', async () => {
      const task = JSON.stringify({
        industry: 'Agriculture',
        location: 'EU',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.grants).toBeDefined();
    });
  });

  describe('Deadline Monitoring', () => {
    it('should identify approaching deadlines', async () => {
      const task = JSON.stringify({
        industry: 'Healthcare',
        location: 'Hungary',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.upcomingDeadlines).toBeDefined();
    });
  });

  describe('Application Drafting', () => {
    it('should generate application draft', async () => {
      const task = JSON.stringify({
        grantId: 'EU-INNOVATION-2026',
        companyName: 'TechStartup Kft.',
        projectDescription: 'AI-powered business automation',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.applicationDraft).toBeDefined();
      expect(result.data.applicationDraft).toHaveProperty('sections');
    });
  });

  describe('Execution Bridge', () => {
    it('should map AgentContext task input through executeTask', async () => {
      const result = await agent.executeTask({
        task: JSON.stringify({
          grantId: 'EU-INNOVATION-2026',
          companyName: 'TechStartup Kft.',
          projectDescription: 'AI-powered business automation',
        }),
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('eligible grants');
      expect(result.data).toBeDefined();
    });
  });

  describe('Eligibility Check', () => {
    it('should check grant eligibility', async () => {
      const task = JSON.stringify({
        industry: 'Technology',
        companySize: 'SME',
        revenue: 50000000,
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.grants).toBeDefined();
      
      // Grants should have eligibility flags
      if (result.data.grants.length > 0) {
        expect(result.data.grants[0]).toHaveProperty('isEligible');
      }
    });

    it('should find an environmental match for the Iszapfaló profile', async () => {
      const task = JSON.stringify({
        teaorCode: '7210',
        employeeCount: 1,
        annualRevenue: 165800000,
        location: 'Pest',
        projectDescription: 'Iszapkezelési és vízminőség-javító K+F pilot',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.eligibleGrants.length).toBeGreaterThan(0);
      expect(result.data.eligibleGrants[0].grant.title).toContain('Környezettechnológiai');
      expect(result.data.eligibleGrants[0].matchScore).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing parameters', async () => {
      const task = '{}';

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
    });
  });
});
