import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyResearchAgent } from '../src/agents/PropertyResearchAgent.js';

describe('PropertyResearchAgent', () => {
  let agent: PropertyResearchAgent;

  beforeEach(() => { agent = new PropertyResearchAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('PropertyResearch');
    expect(agent.capabilities).toContain('market_research');
    expect(agent.capabilities).toContain('valuation_range');
  });

  describe('analyze — piacelemzés és értéktartomány', () => {
    it('visszaad értéktartományt apartment típusnál', async () => {
      const result = await agent.execute('analyze', {
        location: 'Budapest',
        propertyType: 'apartment',
        areaSqm: 75,
        askingPrice: 80000
      });

      expect(result.status).toBe('success');
      expect(result.data.valuationRange).toBeDefined();
      expect(result.data.valuationRange.conservative).toBeGreaterThan(0);
      expect(result.data.valuationRange.target).toBeGreaterThanOrEqual(result.data.valuationRange.conservative);
      expect(result.data.valuationRange.quick).toBeLessThan(result.data.valuationRange.conservative);
    });

    it('comparables minimum 3 ingatlant tartalmaz', async () => {
      const result = await agent.execute('analyze', {
        location: 'Debrecen',
        propertyType: 'house',
        areaSqm: 120,
        askingPrice: 150000
      });

      expect(result.status).toBe('success');
      expect(result.data.comparables).toBeInstanceOf(Array);
      expect(result.data.comparables.length).toBeGreaterThanOrEqual(3);
      for (const comp of result.data.comparables) {
        expect(comp).toHaveProperty('address');
        expect(comp).toHaveProperty('priceEur');
        expect(comp).toHaveProperty('areaSqm');
      }
    });

    it('kockázati jelzések nem üres tömb', async () => {
      const result = await agent.execute('analyze', {
        location: 'Pécs',
        propertyType: 'industrial',
        areaSqm: 500,
        askingPrice: 300000
      });

      expect(result.status).toBe('success');
      expect(result.data.riskFlags).toBeInstanceOf(Array);
      expect(result.data.riskFlags.length).toBeGreaterThan(0);
    });

    it('riport tartalmazza az összes kötelező szekciót', async () => {
      const result = await agent.execute('analyze', {
        location: 'Budapest',
        propertyType: 'apartment',
        areaSqm: 60,
        askingPrice: 70000
      });

      expect(result.status).toBe('success');
      const data = result.data;
      expect(data).toHaveProperty('location');
      expect(data).toHaveProperty('propertyType');
      expect(data).toHaveProperty('valuationRange');
      expect(data).toHaveProperty('comparables');
      expect(data).toHaveProperty('riskFlags');
      expect(data).toHaveProperty('recommendation');
      expect(data).toHaveProperty('generatedAt');
    });

    it('ismeretlen lokáció Budapest fallback-et használ', async () => {
      const result = await agent.execute('analyze', {
        location: '',
        propertyType: 'apartment',
        areaSqm: 50,
        askingPrice: 50000
      });

      expect(result.status).toBe('success');
      expect(result.data.location).toBe('Budapest');
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen');
      expect(result.status).toBe('error');
    });
  });
});
