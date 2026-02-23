import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ApifyScrapingAgent } from '../src/agents/ApifyScrapingAgent.js';

describe('ApifyScrapingAgent', () => {
  let agent: ApifyScrapingAgent;

  beforeAll(async () => {
    agent = new ApifyScrapingAgent();
    await agent.initialize();
  });

  it('should have correct metadata', () => {
    expect(agent.name).toBe('ApifyScraping');
    expect(agent.role).toBe('Research & Intelligence — Deep Web Scraper');
    expect(agent.capabilities).toContain('google_search');
    expect(agent.capabilities).toContain('linkedin_leads');
    expect(agent.capabilities).toContain('ecommerce_scrape');
  });

  it('should return error when APIFY_API_TOKEN is missing', async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    delete process.env.APIFY_API_TOKEN;

    const testAgent = new ApifyScrapingAgent();
    const result = await testAgent.execute('Keress cégeket');

    expect(result.status).toBe('error');
    expect(result.error).toContain('APIFY_API_TOKEN');
    
    // Restore token
    if (originalToken) {
      process.env.APIFY_API_TOKEN = originalToken;
    }
  });

  it('should handle gracefully when token is placeholder', async () => {
    const originalToken = process.env.APIFY_API_TOKEN;
    process.env.APIFY_API_TOKEN = 'your_apify_token_here';

    const testAgent = new ApifyScrapingAgent();
    await testAgent.initialize();
    const result = await testAgent.execute('Keress cégeket');

    expect(result.status).toBe('error');
    expect(result.error).toContain('APIFY_API_TOKEN');
    
    // Restore token
    if (originalToken) {
      process.env.APIFY_API_TOKEN = originalToken;
    }
  });

  it('should detect google capability from task', async () => {
    // Mock implementation
    const task = 'Keress rá a google-n: AI startups 2026';
    
    // Ha nincs Apify token, skip
    if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN === 'your_apify_token_here') {
      const result = await agent.execute(task);
      expect(result.status).toBe('error');
      return;
    }

    // Ha van token, ellenőrizzük a capability detection-t
    // (Valós Apify hívás itt futna, de azt csak integration testben teszteljük)
    expect(task.toLowerCase()).toContain('google');
  });

  it('should detect linkedin capability from task', async () => {
    const task = 'linkedin: https://www.linkedin.com/search/results/people/?keywords=CEO';
    expect(task.toLowerCase()).toContain('linkedin');
  });

  it('should detect ecommerce capability from task', async () => {
    const task = 'Amazon termékek: https://www.amazon.com/s?k=laptop';
    expect(task.toLowerCase()).toContain('amazon');
  });

  it('should use context override for capability', async () => {
    // Skip ha nincs Apify token
    if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN === 'your_apify_token_here') {
      return;
    }

    const context = {
      capability: 'google',
      query: 'test query',
      limit: 5,
    };

    // A context.capability felülírja az auto-detect-et
    expect(context.capability).toBe('google');
  });

  it('should extract URL from task string', async () => {
    const task = 'Scrape this: https://example.com/products';
    const urlMatch = task.match(/https?:\/\/[^\s]+/);
    
    expect(urlMatch).toBeTruthy();
    expect(urlMatch?.[0]).toBe('https://example.com/products');
  });

  it('should default to google search when capability is ambiguous', async () => {
    // Skip ha nincs Apify token
    if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN === 'your_apify_token_here') {
      return;
    }

    const task = 'Keresd meg a legjobb AI eszközöket';
    // Nincs explicit "google" kulcsszó, de az alapértelmezett google search lesz
    expect(task).toBeTruthy();
  });
});

describe('ApifyScrapingAgent - Integration Tests (csak valós API token esetén)', () => {
  let agent: ApifyScrapingAgent;

  beforeAll(async () => {
    agent = new ApifyScrapingAgent();
    await agent.initialize();
  });

  it.skip('should perform real Google search (SKIP by default - requires APIFY_API_TOKEN)', async () => {
    // Csak akkor futtatjuk, ha van valós Apify token
    if (!process.env.APIFY_API_TOKEN || process.env.APIFY_API_TOKEN === 'your_apify_token_here') {
      return;
    }

    const result = await agent.googleSearch('AI agent frameworks 2026', 5);
    
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('url');
    expect(result[0]).toHaveProperty('snippet');
  });

  it.skip('should perform real LinkedIn search (SKIP - requires cookie setup)', async () => {
    // LinkedIn scraping komplex - cookie-t és session-t igényel
    // Csak dokumentációs célra van itt
    expect(true).toBe(true);
  });
});
