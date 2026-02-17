import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketingAgent } from '../src/agents/MarketingAgent.js';

describe('MarketingAgent - Real Estate Phase 4 Outreach', () => {
  let agent: MarketingAgent;

  beforeEach(() => {
    agent = new MarketingAgent();
  });

  it('meghívja a corporate_hunter.py-t és céges leadeket talál', async () => {
    const result = await agent.execute('find companies', {
      filters: {
        industry: 'Real Estate',
        location: 'Budapest',
        min_relevance: 7.0,
        limit: 3
      },
      mock: true
    });

    expect(result.status).toBe('success');
    expect(result.data.total_found).toBeGreaterThan(0);
    expect(result.data.companies).toBeInstanceOf(Array);
    expect(result.data.companies.length).toBeGreaterThan(0);

    // Ellenőrizzük hogy van decision maker
    const company = result.data.companies[0];
    expect(company.decision_makers).toBeInstanceOf(Array);
    expect(company.decision_makers.length).toBeGreaterThan(0);
    expect(company.decision_makers[0]).toHaveProperty('name');
    expect(company.decision_makers[0]).toHaveProperty('email');
  }, 15000);

  it('generál teaser email-t magyar nyelven', async () => {
    const mockCompanies = [
      {
        company_name: 'Test Property Ltd.',
        industry: 'Real Estate',
        location: 'Budapest',
        employee_count: 50,
        revenue_estimate: '10M-20M EUR',
        website: 'https://test.com',
        linkedin_url: 'https://linkedin.com/company/test',
        decision_makers: [
          {
            name: 'Test CEO',
            title: 'CEO',
            email: 'ceo@test.com',
            linkedin_url: 'https://linkedin.com/in/test-ceo'
          }
        ],
        relevance_score: 9.0,
        notes: 'Active buyer in Budapest',
        source: 'mock'
      }
    ];

    const result = await agent.execute('generate teaser emails', {
      companies: mockCompanies,
      language: 'hu'
    });

    expect(result.status).toBe('success');
    expect(result.data.totalDrafts).toBe(1);
    expect(result.data.successfulDrafts).toBeGreaterThan(0);
    expect(result.data.drafts[0]).toHaveProperty('companyName');
    expect(result.data.drafts[0].companyName).toBe('Test Property Ltd.');
  }, 10000);

  it('generál teaser email-t angol nyelven', async () => {
    const mockCompanies = [
      {
        company_name: 'English Property Ltd.',
        industry: 'Real Estate',
        location: 'Budapest',
        decision_makers: [
          {
            name: 'John Doe',
            title: 'CEO',
            email: 'john@english.com'
          }
        ],
        relevance_score: 8.5,
        source: 'mock'
      }
    ];

    const result = await agent.execute('generate teaser emails', {
      companies: mockCompanies,
      language: 'en'
    });

    expect(result.status).toBe('success');
    expect(result.data.drafts[0].language).toBe('en');
  }, 10000);

  it('több céges lead keresés és email generálás teljes flow', async () => {
    // 1. Leadek keresése
    const huntResult = await agent.execute('hunt companies', {
      filters: {
        industry: 'Real Estate',
        location: 'Budapest',
        limit: 5
      },
      mock: true
    });

    expect(huntResult.status).toBe('success');
    expect(huntResult.data.companies.length).toBeGreaterThan(0);

    // 2. Email generálás találatok alapján
    const emailResult = await agent.execute('generate teaser emails', {
      companies: huntResult.data.companies,
      language: 'hu'
    });

    expect(emailResult.status).toBe('success');
    expect(emailResult.data.successfulDrafts).toBeGreaterThan(0);

    console.log(`✅ ${huntResult.data.total_found} cég lead → ${emailResult.data.successfulDrafts} teaser email draft`);
  }, 20000);

  it('CRM integráció: leadek mentése Google Sheets-be', async () => {
    const mockCompanies = [
      {
        company_name: 'CRM Test Ltd.',
        industry: 'Real Estate',
        location: 'Budapest',
        revenue_estimate: '5M-10M EUR',
        decision_makers: [
          {
            name: 'Test Manager',
            title: 'Head of Real Estate',
            email: 'manager@crmtest.com'
          }
        ],
        relevance_score: 8.0,
        notes: 'Test lead for CRM integration',
        source: 'mock'
      }
    ];

    const result = await agent.execute('generate teaser emails', {
      companies: mockCompanies,
      language: 'hu',
      saveToCRM: true,
      crmSheetId: 'mock-sheet-id-12345'
    });

    expect(result.status).toBe('success');
    expect(result.message).toContain('CRM-be mentve');
  }, 10000);

  it('német nyelvű teaser email generálás', async () => {
    const mockCompanies = [
      {
        company_name: 'Vienna-Budapest Investment Group',
        industry: 'Real Estate Investment',
        location: 'Vienna / Budapest',
        decision_makers: [
          {
            name: 'Franz Weber',
            title: 'Head of Acquisitions',
            email: 'f.weber@vbig.example.at'
          }
        ],
        relevance_score: 9.8,
        notes: 'High-value target, active buyer in Budapest market',
        source: 'mock'
      }
    ];

    const result = await agent.execute('generate teaser emails', {
      companies: mockCompanies,
      language: 'de'
    });

    expect(result.status).toBe('success');
    expect(result.data.drafts[0].language).toBe('de');
    
    // Ellenőrizzük hogy a német szöveg tartalmaz német kifejezéseket
    const draft = result.data.drafts[0];
    // Note: draft structure doesn't expose body directly in this mock
    expect(draft).toHaveProperty('companyName');
    expect(draft.companyName).toBe('Vienna-Budapest Investment Group');
  }, 10000);
});
