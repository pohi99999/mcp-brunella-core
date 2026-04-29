import { describe, it, expect, beforeEach } from 'vitest';
import { IntakeSurveyAgent } from '@packages/agents/IntakeSurveyAgent.js';

describe('IntakeSurveyAgent', () => {
  let agent: IntakeSurveyAgent;

  beforeEach(() => { agent = new IntakeSurveyAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('IntakeSurvey');
    expect(agent.capabilities).toContain('intake_checklist');
    expect(agent.capabilities).toContain('document_survey');
  });

  describe('checklist — kötelező iratok típusonként', () => {
    it('apartment kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'apartment' });
      expect(result.status).toBe('success');
      expect(result.data.required).toBeInstanceOf(Array);
      expect(result.data.required.length).toBeGreaterThan(0);
      expect(result.data.propertyType).toBe('apartment');
    });

    it('house kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'house' });
      expect(result.status).toBe('success');
      expect(result.data.required.length).toBeGreaterThan(0);
    });

    it('industrial kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'industrial' });
      expect(result.status).toBe('success');
      expect(result.data.required.length).toBeGreaterThan(0);
    });

    it('ismeretlen típus hibát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'spaceship' });
      expect(result.status).toBe('error');
    });
  });

  describe('survey — hiánylista és teljességjelző', () => {
    it('0% teljességet mutat ha nincs feltöltött dokumentum', async () => {
      const result = await agent.execute('survey', {
        propertyType: 'apartment',
        uploadedDocs: []
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBe(0);
      expect(result.data.missing.length).toBeGreaterThan(0);
    });

    it('100% teljességet mutat ha minden dokumentum feltöltve', async () => {
      const checklistResult = await agent.execute('checklist', { propertyType: 'house' });
      const allDocs = checklistResult.data.required as string[];

      const result = await agent.execute('survey', {
        propertyType: 'house',
        uploadedDocs: allDocs
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBe(100);
      expect(result.data.missing.length).toBe(0);
    });

    it('részleges feltöltés korrekt százalékot számol', async () => {
      const result = await agent.execute('survey', {
        propertyType: 'apartment',
        uploadedDocs: ['tulajdoni lap']
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBeGreaterThan(0);
      expect(result.data.completeness).toBeLessThan(100);
      expect(result.data.missing).toBeInstanceOf(Array);
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen_feladat');
      expect(result.status).toBe('error');
    });
  });
});
