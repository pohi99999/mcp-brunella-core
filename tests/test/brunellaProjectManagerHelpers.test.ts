import { describe, expect, it, vi } from 'vitest';
import { parseRecentFoszalEntries } from '@packages/core-logic/brunellaProjectManagerFoszal.js';
import {
  queryProjectSummary,
  summarizeRagHits,
} from '@packages/core-logic/brunellaProjectManagerRag.js';

vi.mock('@packages/utils/rag.js', () => ({
  searchRAG: vi.fn(async (query: string, limit: number) => [
    { text: `Result for ${query}`, path: 'docs/status.md', score: limit },
  ]),
}));

describe('brunellaProjectManager helpers', () => {
  it('parses FOSZAL entries', () => {
    const entries = parseRecentFoszalEntries(
      [
        '### 2026-04-08',
        '#### 20:24 - [Copilot] PM delivery',
        '- **Státusz:** ✅ Befejezve',
        '- **Érintett fájlok:** `a.ts`, `b.ts`',
      ].join('\n'),
      1,
    );

    expect(entries).toEqual([
      {
        date: '2026-04-08',
        time: '20:24',
        agent: 'Copilot',
        title: 'PM delivery',
        status: '✅ Befejezve',
        files: ['a.ts', 'b.ts'],
      },
    ]);
  });

  it('summarizes RAG hits and can query project summary results', async () => {
    expect(
      summarizeRagHits([{ text: 'A very useful summary', path: 'docs/status.md' }]),
    ).toEqual(['- A very useful summary [docs/status.md]']);

    const hits = await queryProjectSummary('project manager status', 2);
    expect(hits).toEqual([
      { text: 'Result for project manager status', path: 'docs/status.md', score: 2 },
    ]);
  });
});
