import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

const apifyMocks = vi.hoisted(() => ({
  actorCall: vi.fn(),
  actor: vi.fn(),
  datasetListItems: vi.fn(),
  dataset: vi.fn(),
}));

vi.mock('apify-client', () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: apifyMocks.actor,
    dataset: apifyMocks.dataset,
  })),
}));

import { ApifyScrapingAgent } from '../src/agents/ApifyScrapingAgent.js';

function configureMockClient(items: unknown[]) {
  apifyMocks.actor.mockReturnValue({ call: apifyMocks.actorCall });
  apifyMocks.dataset.mockReturnValue({ listItems: apifyMocks.datasetListItems });
  apifyMocks.actorCall.mockResolvedValue({ defaultDatasetId: 'dataset-1' });
  apifyMocks.datasetListItems.mockResolvedValue({ items });
}

async function createAgent() {
  const agent = new ApifyScrapingAgent();
  await agent.initialize();
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APIFY_API_TOKEN', 'test-token');
  vi.stubEnv('APIFY_TOKEN', '');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('ApifyScrapingAgent', () => {
  it('should have correct metadata', () => {
    const agent = new ApifyScrapingAgent();

    expect(agent.name).toBe('ApifyScraping');
    expect(agent.role).toBe('Research & Intelligence — Deep Web Scraper');
    expect(agent.capabilities).toContain('google_search');
    expect(agent.capabilities).toContain('linkedin_leads');
    expect(agent.capabilities).toContain('ecommerce_scrape');
    expect(agent.capabilities).toContain('trend_analysis');
  });

  it('maps Google search results from Apify output', async () => {
    configureMockClient([
      {
        title: 'AI Startups 2026',
        url: 'https://example.com/startups',
        description: 'Coverage of AI startup activity',
      },
    ]);

    const agent = await createAgent();
    const result = await agent.googleSearch('AI startups 2026', 3);

    expect(apifyMocks.actor).toHaveBeenCalledWith('apify/google-search-scraper');
    expect(apifyMocks.actorCall).toHaveBeenCalledWith({
      queries: 'AI startups 2026',
      maxResultsPerPage: 3,
      languageCode: 'hu',
    });
    expect(result).toEqual([
      {
        title: 'AI Startups 2026',
        url: 'https://example.com/startups',
        snippet: 'Coverage of AI startup activity',
        position: 1,
      },
    ]);
  });

  it('ignores non-record Apify items during result normalization', async () => {
    configureMockClient([
      null,
      'skip-me',
      {
        title: 'AI Ops Guide',
        url: 'https://example.com/ai-ops',
        description: 'Operational AI coverage',
      },
    ]);

    const agent = await createAgent();
    const result = await agent.googleSearch('AI ops', 3);

    expect(result).toEqual([
      {
        title: 'AI Ops Guide',
        url: 'https://example.com/ai-ops',
        snippet: 'Operational AI coverage',
        position: 1,
      },
    ]);
  });

  it('maps LinkedIn lead results from Apify output', async () => {
    configureMockClient([
      {
        fullName: 'Jane Doe',
        headline: 'CEO',
        company: 'Acme',
        url: 'https://www.linkedin.com/in/janedoe',
        location: 'Budapest',
        email: 'jane@acme.test',
      },
    ]);

    const agent = await createAgent();
    const result = await agent.linkedinLeads('https://www.linkedin.com/search/results/people/?keywords=CEO', 2);

    expect(apifyMocks.actor).toHaveBeenCalledWith('apify/linkedin-profile-scraper');
    expect(apifyMocks.actorCall).toHaveBeenCalledWith({
      startUrls: [{ url: 'https://www.linkedin.com/search/results/people/?keywords=CEO' }],
      maxItems: 2,
    });
    expect(result).toEqual([
      {
        name: 'Jane Doe',
        title: 'CEO',
        company: 'Acme',
        url: 'https://www.linkedin.com/in/janedoe',
        location: 'Budapest',
        email: 'jane@acme.test',
      },
    ]);
  });

  it('maps ecommerce product results from Apify output', async () => {
    configureMockClient([
      {
        title: 'Laptop Pro',
        price: { value: 999, currency: 'USD' },
        url: 'https://shop.example/laptop',
        thumbnailImage: 'https://img.example/laptop.jpg',
        stars: 4.7,
        reviews: 123,
      },
    ]);

    const agent = await createAgent();
    const result = await agent.ecommerceProducts('https://shop.example/search?q=laptop', 4);

    expect(apifyMocks.actor).toHaveBeenCalledWith('apify/amazon-crawler');
    expect(apifyMocks.actorCall).toHaveBeenCalledWith({
      startUrls: [{ url: 'https://shop.example/search?q=laptop' }],
      maxItems: 4,
    });
    expect(result).toEqual([
      {
        name: 'Laptop Pro',
        price: '999',
        currency: 'USD',
        url: 'https://shop.example/laptop',
        imageUrl: 'https://img.example/laptop.jpg',
        rating: 4.7,
        reviews: 123,
      },
    ]);
  });

  it('maps trend results from Apify output', async () => {
    configureMockClient([
      {
        retweetCount: 42,
        likeCount: 100,
        sentiment: 'positive',
        url: 'https://twitter.com/example/status/1',
        createdAt: '2026-04-01T12:00:00Z',
      },
    ]);

    const agent = await createAgent();
    const result = await agent.trendData('agentic workflows', 'twitter', 6);

    expect(apifyMocks.actor).toHaveBeenCalledWith('apify/twitter-scraper');
    expect(apifyMocks.actorCall).toHaveBeenCalledWith({
      searchTerms: ['agentic workflows'],
      maxItems: 6,
    });
    expect(result).toEqual([
      {
        topic: 'agentic workflows',
        source: 'twitter',
        volume: 42,
        sentiment: 'positive',
        url: 'https://twitter.com/example/status/1',
        timestamp: '2026-04-01T12:00:00Z',
      },
    ]);
  });

  it('auto-detects google capability during execute', async () => {
    configureMockClient([
      {
        title: 'Logistics Startups',
        url: 'https://example.com/logistics',
        description: 'Logistics companies worth watching',
      },
    ]);

    const agent = await createAgent();
    const result = await agent.execute('Bármi', {
      capability: 'google',
      query: 'logistics startups 2026',
      limit: '5',
    });

    expect(result.status).toBe('success');
    expect(result.metadata).toEqual({
      type: 'google_search',
      count: 1,
    });
    expect(result.data).toEqual([
      {
        title: 'Logistics Startups',
        url: 'https://example.com/logistics',
        snippet: 'Logistics companies worth watching',
        position: 1,
      },
    ]);
  });

  it('returns a clear error when APIFY_API_TOKEN is missing', async () => {
    vi.stubEnv('APIFY_API_TOKEN', '');
    vi.stubEnv('APIFY_TOKEN', '');

    const agent = new ApifyScrapingAgent();
    const result = await agent.execute('Keress cégeket');

    expect(result.status).toBe('error');
    expect(result.error).toContain('APIFY_API_TOKEN');
  });
});
