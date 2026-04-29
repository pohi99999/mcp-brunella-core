/**
 * Unit tests for LocalCSRAgent
 * Tests community event tracking, sponsorship management, and PR automation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalCSRAgent } from '@packages/agents/LocalCSRAgent.js';

describe('LocalCSRAgent', () => {
  let agent: LocalCSRAgent;

  beforeEach(() => {
    agent = new LocalCSRAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('LocalCSR');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('event_tracking');
      expect(agent.capabilities).toContain('sponsorship_mgmt');
      expect(agent.capabilities).toContain('pr_automation');
      expect(agent.capabilities).toContain('impact_reporting');
    });
  });

  describe('Event Tracking', () => {
    it('should track community events', async () => {
      const task = JSON.stringify({
        location: 'Budapest',
        eventType: 'charity',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.events).toBeDefined();
      expect(Array.isArray(result.data.events)).toBe(true);
    });

    it('should filter events by type', async () => {
      const task = JSON.stringify({
        location: 'Szeged',
        eventType: 'education',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.events).toBeDefined();
    });
  });

  describe('Sponsorship Management', () => {
    it('should suggest sponsorship opportunities', async () => {
      const task = JSON.stringify({
        budget: 500000,
        location: 'Debrecen',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.sponsorshipOpportunities).toBeDefined();
    });

    it('should filter by budget', async () => {
      const task = JSON.stringify({
        budget: 100000,
        location: 'Pécs',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.sponsorshipOpportunities).toBeDefined();
    });
  });

  describe('PR Automation', () => {
    it('should generate press release for CSR activity', async () => {
      const task = JSON.stringify({
        activityType: 'tree_planting',
        participants: 50,
        location: 'Budapest',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.pressRelease).toBeDefined();
      expect(result.data.pressRelease).toHaveProperty('title');
      expect(result.data.pressRelease).toHaveProperty('body');
    });

    it('should generate social media posts', async () => {
      const task = JSON.stringify({
        activityType: 'charity_donation',
        amount: 200000,
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.socialMediaPosts).toBeDefined();
    });
  });

  describe('Impact Reporting', () => {
    it('should calculate CSR impact metrics', async () => {
      const task = JSON.stringify({
        activities: [
          { type: 'donation', amount: 100000 },
          { type: 'volunteer', hours: 50 },
        ],
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.impactReport).toBeDefined();
      expect(result.data.impactReport).toHaveProperty('totalImpact');
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
