import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyPlannerAgent } from '@packages/agents/StrategyPlannerAgent.js';

describe('StrategyPlannerAgent', () => {
  let agent: StrategyPlannerAgent;

  beforeEach(() => { agent = new StrategyPlannerAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('StrategyPlanner');
    expect(agent.capabilities).toContain('channel_recommendation');
    expect(agent.capabilities).toContain('approval_gate');
  });

  describe('plan — stratégiai terv generálása', () => {
    it('terv generálva pending approval state-tel', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'apartment',
        location: 'Budapest',
        estimatedValue: 100000
      });

      expect(result.status).toBe('success');
      expect(result.data.planId).toBeDefined();
      expect(result.data.approvalState).toBe('pending');
      expect(result.data.channels).toBeInstanceOf(Array);
      expect(result.data.channels.length).toBeGreaterThan(0);
      expect(result.data.targetSegments).toBeInstanceOf(Array);
    });

    it('terv tartalmaz csatornákat prioritással', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'industrial',
        location: 'Győr',
        estimatedValue: 500000
      });

      expect(result.status).toBe('success');
      for (const ch of result.data.channels) {
        expect(ch).toHaveProperty('name');
        expect(ch).toHaveProperty('priority');
        expect(ch).toHaveProperty('description');
      }
    });

    it('riport tartalmazza az összes kötelező szekciót', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'house',
        location: 'Debrecen',
        estimatedValue: 200000
      });

      const data = result.data;
      expect(data).toHaveProperty('planId');
      expect(data).toHaveProperty('approvalState');
      expect(data).toHaveProperty('channels');
      expect(data).toHaveProperty('targetSegments');
      expect(data).toHaveProperty('approvalSteps');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('generatedAt');
    });
  });

  describe('approve — jóváhagyási kapu', () => {
    it('approve döntés approved state-et ad', async () => {
      const planResult = await agent.execute('plan', {
        propertyType: 'apartment',
        location: 'Budapest',
        estimatedValue: 100000
      });
      const planId = planResult.data.planId as string;

      const approveResult = await agent.execute('approve', {
        planId,
        decision: 'approved'
      });

      expect(approveResult.status).toBe('success');
      expect(approveResult.data.approvalState).toBe('approved');
    });

    it('reject döntés rejected state-et ad', async () => {
      const planResult = await agent.execute('plan', {
        propertyType: 'house',
        location: 'Pécs',
        estimatedValue: 150000
      });
      const planId = planResult.data.planId as string;

      const rejectResult = await agent.execute('approve', {
        planId,
        decision: 'rejected'
      });

      expect(rejectResult.status).toBe('success');
      expect(rejectResult.data.approvalState).toBe('rejected');
    });

    it('ismeretlen planId hibát ad', async () => {
      const result = await agent.execute('approve', {
        planId: 'nonexistent-plan-id',
        decision: 'approved'
      });
      expect(result.status).toBe('error');
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen_feladat');
      expect(result.status).toBe('error');
    });
  });
});
