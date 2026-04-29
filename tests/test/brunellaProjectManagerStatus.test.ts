import { describe, expect, it } from 'vitest';
import {
  parseRecentFoszalEntries,
  renderBrunellaProjectManagerSnapshot,
} from '@packages/core-logic/brunellaProjectManagerStatus.js';

describe('brunellaProjectManagerStatus', () => {
  it('parses recent FOSZAL entries', () => {
    const content = [
      '# FŐSZÁL',
      '',
      '### 2026-04-08',
      '',
      '#### 20:24 - [Copilot] KKV CRM conductor completion',
      '- **Státusz:** ✅ Befejezve',
      '- **Érintett fájlok:** `foo.ts`, `bar.ts`',
      '',
      '#### 19:53 - [Copilot] HR timesheet status surface completion',
      '- **Státusz:** ✅ Befejezve',
      '- **Érintett fájlok:** `baz.ts`',
      '',
    ].join('\n');

    const entries = parseRecentFoszalEntries(content, 2);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      date: '2026-04-08',
      time: '20:24',
      agent: 'Copilot',
      title: 'KKV CRM conductor completion',
      status: '✅ Befejezve',
    });
    expect(entries[0].files).toEqual(['foo.ts', 'bar.ts']);
  });

  it('renders a readable status report', () => {
    const report = renderBrunellaProjectManagerSnapshot({
      checkedAt: '2026-04-08T22:00:00.000Z',
      trackSnapshot: {
        success: true,
        checkedAt: '2026-04-08T22:00:00.000Z',
        overallStats: { total: 1, active: 1, proposed: 0, completed: 0, archived: 0 },
        businessGroupStats: {
          total: 1,
          active: 1,
          proposed: 0,
          completed: 0,
          archived: 0,
          averageProgress: 42,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
        },
        activeBusinessTracks: [],
        proposedBusinessTracks: [],
        completedBusinessTracks: [],
        archivedBusinessTracks: [],
        recommendation: {
          headline: 'Fókusz: Track A',
          rationale: 'Aktív business track.',
          nextSteps: ['Step 1'],
        },
      },
      foszalEntries: [],
      ragHits: [{ text: 'Project summary text', path: 'docs/status.md' }],
      warnings: [],
    });

    expect(report).toContain('# Brunella Project Manager Status');
    expect(report).toContain('## Recommendation');
    expect(report).toContain('Fókusz: Track A');
  });
});
