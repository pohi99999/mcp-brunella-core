import { describe, it, expect, beforeAll, vi } from 'vitest';
import { LawDetectiveAgent } from '@packages/agents/LawDetectiveAgent.js';

// Mock LLM client
vi.mock('@packages/core-logic/llm_client.js', () => ({
  generateResponse: vi.fn(),
}));

import { generateResponse } from '@packages/core-logic/llm_client.js';

describe('LawDetectiveAgent', () => {
  let agent: LawDetectiveAgent;

  beforeAll(() => {
    agent = new LawDetectiveAgent();
  });

  it('should have correct metadata', () => {
    expect(agent.name).toBe('LawDetective');
    expect(agent.role).toBe('Legal Intelligence & Compliance Monitor');
    expect(agent.capabilities).toContain('law_monitoring');
    expect(agent.capabilities).toContain('legal_intelligence');
    expect(agent.capabilities).toContain('compliance_analysis');
    expect(agent.capabilities).toContain('business_impact_assessment');
    expect(agent.capabilities).toContain('magyar_kozlony_tracking');
  });

  it('should have common legal keywords', () => {
    const keywords = (agent as any).commonKeywords;
    expect(keywords).toBeInstanceOf(Array);
    expect(keywords).toContain('minimálbér');
    expect(keywords).toContain('kata');
    expect(keywords).toContain('szja');
    expect(keywords).toContain('áfa');
  });

  it('should have legal categories', () => {
    const categories = (agent as any).categories;
    expect(categories).toBeInstanceOf(Array);
    expect(categories).toContain('Munkaügy');
    expect(categories).toContain('Adózás');
    expect(categories).toContain('Társadalombiztosítás');
  });

  it('should extract keywords from task', async () => {
    const task = 'Figyeld a minimálbér és KATA változásokat';
    const taskLower = task.toLowerCase();
    const keywords = (agent as any).commonKeywords.filter((kw: string) => taskLower.includes(kw));
    
    expect(keywords).toContain('minimálbér');
    expect(keywords).toContain('kata');
  });

  it('should fetchMagyarKozlony (mocked)', async () => {
    const result = await agent.fetchMagyarKozlony();

    expect(result).toHaveProperty('number');
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('text');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should analyzeLegalText with AI (mocked)', async () => {
    const mockResponse = `[
      {
        "title": "Minimálbér emelés 2026",
        "publication": "Magyar Közlöny 2026/15",
        "date": "2026-02-15",
        "category": "Munkaügy",
        "keywords": ["minimálbér"],
        "relevanceScore": 95,
        "summary": "A minimálbér 2026. július 1-től 300,000 Ft-ra emelkedik.",
        "businessImpact": "Minden munkáltatónak át kell számolnia a bérköltségvetést."
      }
    ]`;

    (generateResponse as any).mockResolvedValueOnce(mockResponse);

    const changes = await agent.analyzeLegalText(
      'Minimálbér törvény...',
      ['minimálbér']
    );

    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].title).toContain('Minimálbér');
    expect(changes[0].category).toBe('Munkaügy');
    expect(changes[0].relevanceScore).toBeGreaterThan(0);
  });

  it('should handle LLM failure gracefully', async () => {
    (generateResponse as any).mockRejectedValueOnce(new Error('LLM timeout'));

    const changes = await agent.analyzeLegalText('Test text', ['kata']);

    expect(changes).toEqual([]);
  });

  it('should filterRelevantChanges by threshold', () => {
    const mockChanges = [
      {
        title: 'High priority',
        publication: 'MK 2026/15',
        date: '2026-02-15',
        category: 'Munkaügy',
        keywords: ['minimálbér'],
        relevanceScore: 90,
        summary: 'Test',
        businessImpact: 'High impact',
      },
      {
        title: 'Low priority',
        publication: 'MK 2026/15',
        date: '2026-02-15',
        category: 'Adózás',
        keywords: ['kata'],
        relevanceScore: 30,
        summary: 'Test',
        businessImpact: 'Low impact',
      },
    ];

    const config = {
      keywords: ['minimálbér', 'kata'],
      threshold: 50,
    };

    const filtered = agent.filterRelevantChanges(mockChanges, config);

    expect(filtered.length).toBe(1);
    expect(filtered[0].relevanceScore).toBeGreaterThanOrEqual(50);
  });

  it('should filterRelevantChanges by keywords', () => {
    const mockChanges = [
      {
        title: 'Matching change',
        publication: 'MK 2026/15',
        date: '2026-02-15',
        category: 'Munkaügy',
        keywords: ['minimálbér'],
        relevanceScore: 80,
        summary: 'Test',
        businessImpact: 'Impact',
      },
      {
        title: 'Non-matching change',
        publication: 'MK 2026/15',
        date: '2026-02-15',
        category: 'Oktatás',
        keywords: ['iskola'],
        relevanceScore: 80,
        summary: 'Test',
        businessImpact: 'Impact',
      },
    ];

    const config = {
      keywords: ['minimálbér', 'kata'],
    };

    const filtered = agent.filterRelevantChanges(mockChanges, config);

    expect(filtered.length).toBe(1);
    expect(filtered[0].keywords).toContain('minimálbér');
  });

  it('should generateReport with markdown', () => {
    const mockChanges = [
      {
        title: 'Minimálbér emelés',
        publication: 'Magyar Közlöny 2026/15',
        date: '2026-02-15',
        category: 'Munkaügy',
        keywords: ['minimálbér'],
        relevanceScore: 95,
        summary: 'Test summary',
        businessImpact: 'Test impact',
      },
    ];

    const config = {
      keywords: ['minimálbér'],
      threshold: 50,
    };

    const report = agent.generateReport(mockChanges, config);

    expect(report).toContain('Law Detective Report');
    expect(report).toContain('Magyar Közlöny');
    expect(report).toContain('Minimálbér');
    expect(report).toContain('Munkaügy');
    expect(report).toContain('95%');
  });

  it('should execute full workflow (mocked)', async () => {
    const mockLegalAnalysis = `[
      {
        "title": "KATA változás 2026",
        "publication": "Magyar Közlöny 2026/15",
        "date": "2026-02-15",
        "category": "Adózás",
        "keywords": ["kata"],
        "relevanceScore": 85,
        "summary": "KATA díj emelés.",
        "businessImpact": "Megváltozott költségek."
      }
    ]`;

    (generateResponse as any).mockResolvedValueOnce(mockLegalAnalysis);

    const result = await agent.execute('Figyeld a KATA változásokat', {
      keywords: ['kata'],
      threshold: 50,
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('monitoredKeywords');
    expect(result.data).toHaveProperty('relevantChanges');
    expect(result.data).toHaveProperty('markdown');
    expect(result.metadata?.totalChanges).toBeGreaterThanOrEqual(0);
  });

  it('should use default keywords if none provided', async () => {
    const mockAnalysis = `[]`;
    (generateResponse as any).mockResolvedValueOnce(mockAnalysis);

    const result = await agent.execute('Mi van a minimálbérrel?');

    expect(result.status).toBe('success');
    expect(result.data.monitoredKeywords).toContain('minimálbér');
  });
});
