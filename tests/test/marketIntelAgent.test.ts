/**
 * Unit tests for MarketIntelAgent
 * Tests competitor price tracking, trend analysis, and alerts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketIntelAgent } from '@packages/agents/MarketIntelAgent.js';

describe('MarketIntelAgent', () => {
  let agent: MarketIntelAgent;

  beforeEach(() => {
    agent = new MarketIntelAgent();
  });

  describe('Agent Metadata', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('MarketIntel');
    });

    it('should have correct capabilities', () => {
      expect(agent.capabilities).toContain('price_tracking');
      expect(agent.capabilities).toContain('trend_analysis');
      expect(agent.capabilities).toContain('alert_system');
    });
  });

  describe('Price Tracking', () => {
    it('should track competitor prices', async () => {
      const task = JSON.stringify({
        competitors: ['CompetitorA', 'CompetitorB'],
        productCategory: 'SaaS',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.priceSnapshots).toBeDefined();
      expect(Array.isArray(result.data.priceSnapshots)).toBe(true);
    }, 60000);

    it('should detect price changes', async () => {
      const task = JSON.stringify({
        competitors: ['CompetitorC'],
        productCategory: 'Cloud Hosting',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.priceChanges).toBeDefined();
    }, 60000);
  });

  describe('Trend Analysis', () => {
    it('should identify market trends', async () => {
      const task = JSON.stringify({
        competitors: ['CompetitorA', 'CompetitorB'],
        productCategory: 'SaaS',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.trends).toBeDefined();
      expect(Array.isArray(result.data.trends)).toBe(true);
    }, 60000);
  });

  describe('Alert System', () => {
    it('should generate alerts for significant changes', async () => {
      const task = JSON.stringify({
        competitors: ['CompetitorX'],
        productCategory: 'Enterprise Software',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.alerts).toBeDefined();
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle empty competitor list', async () => {
      const task = JSON.stringify({
        competitors: [],
        productCategory: 'software licenses',
      });

      const result = await agent.execute(task);

      expect(result.status).toBe('success');
      expect(result.data.summary.competitorsScraped).toBeGreaterThan(0);
    }, 90000);
  });
});
