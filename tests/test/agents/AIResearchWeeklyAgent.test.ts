import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIResearchWeeklyAgent } from '@packages/agents/AIResearchWeeklyAgent.js';
import { crawl4aiCrawlHandler } from '@packages/utils/crawl4aiTool.js';
import { generateRouted } from '@packages/core-logic/llm_client.js';
import { writeMarkdownReport } from '@packages/utils/reportWriter.js';

vi.mock('@packages/utils/crawl4aiTool.js', () => ({
  crawl4aiCrawlHandler: vi.fn(),
}));

vi.mock('@packages/core-logic/llm_client.js', () => ({
  generateRouted: vi.fn(),
}));

vi.mock('@packages/utils/reportWriter.js', () => ({
  writeMarkdownReport: vi.fn(),
}));

describe('AIResearchWeeklyAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
      const url = String(input);

      if (url.includes('api.github.com/search/repositories')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            items: [
              {
                full_name: 'acme/agent-lab',
                description: 'AI agent experimentation toolkit',
                html_url: 'https://github.com/acme/agent-lab',
                stargazers_count: 1234,
                language: 'TypeScript',
                updated_at: '2026-03-27T04:00:00Z',
              },
            ],
          }),
        } as never;
      }

      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      } as never;
    }) as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('collects signals and writes a dated markdown report', async () => {
    vi.mocked(crawl4aiCrawlHandler).mockResolvedValue({
      success: true,
      data: {
        url: 'https://developer.chrome.com/docs/devtools/whatsnew/',
        markdown: 'Chrome DevTools has a new update.',
        title: "What's new in DevTools",
        description: 'A fresh DevTools update',
        language: 'en',
        extracted_data: null,
        links: [],
        status: 'success',
      },
    } as never);

    vi.mocked(generateRouted).mockResolvedValue({
      response: '# Heti AI Ökoszisztéma Figyelő\n\n## Vezető összefoglaló\n- Friss update érkezett.\n\n## Talált újdonságok\n### GitHub / open source\n- **acme/agent-lab**\n  - Miért fontos a Brunella számára: jó referencia.\n\n## Brunella-hasznosítási javaslatok\n- Frissítsük a monitoring listát.\n\n## Következő heti figyelőlista\n- Figyeljük tovább.',
      decision: {
        model: { provider: 'gemini', name: 'gemini-2.0-flash' },
        reason: 'test',
      },
    } as never);

    vi.mocked(writeMarkdownReport).mockResolvedValue('C:/tmp/2026-03-27.md');

    const agent = new AIResearchWeeklyAgent();
    const result = await agent.executeTask({
      task: 'Heti AI kutatás',
      reportDate: '2026-03-27',
      reportOutputDir: 'docs/001_Jelentés',
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(writeMarkdownReport)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Heti AI Ökoszisztéma Figyelő',
        date: '2026-03-27',
        reportType: 'weekly_ai_ecosystem_watch',
      }),
      expect.stringContaining('Heti AI Ökoszisztéma Figyelő'),
      'docs/001_Jelentés',
      '2026-03-27.md',
    );
    expect(result.data).toEqual(expect.objectContaining({
      reportPath: 'C:/tmp/2026-03-27.md',
      reportDate: '2026-03-27',
    }));
  });
});
