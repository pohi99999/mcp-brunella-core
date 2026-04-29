import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { writeMarkdownReport } from '@packages/utils/reportWriter.js';

describe('writeMarkdownReport', () => {
  it('writes front matter and uses the date as filename', async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brunella-report-'));

    try {
      const reportPath = await writeMarkdownReport(
        {
          title: 'Heti AI Ökoszisztéma Figyelő',
          date: '2026-03-27',
          generatedAt: '2026-03-27T05:00:00.000Z',
          generatedBy: 'AIResearchWeekly',
          reportType: 'weekly_ai_ecosystem_watch',
          periodStart: '2026-03-20',
          periodEnd: '2026-03-27',
          sources: ['https://example.com'],
          tags: ['weekly', 'ai'],
        },
        '# Report body',
        tmpDir,
      );

      expect(path.basename(reportPath)).toBe('2026-03-27.md');
      const content = readFileSync(reportPath, 'utf-8');
      expect(content).toContain('title: "Heti AI Ökoszisztéma Figyelő"');
      expect(content).toContain('reportType: "weekly_ai_ecosystem_watch"');
      expect(content).toContain('# Report body');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
