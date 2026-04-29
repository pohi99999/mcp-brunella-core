import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const curatedHarness = vi.hoisted(() => ({
  db: null as Database.Database | null,
}));

vi.mock('@packages/utils/globalDb.js', () => ({
  getGlobalDb: () => {
    if (!curatedHarness.db) {
      throw new Error('Curated test database not initialized');
    }
    return curatedHarness.db;
  },
  getD1Adapter: vi.fn(() => null),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@packages/utils/vectorize.js', () => ({
  vectorizeClient: {
    getStatus: vi.fn(() => ({ enabled: false })),
    upsertText: vi.fn(),
  },
}));

describe('goldenDatasetBridge curated listing', () => {
  beforeEach(() => {
    curatedHarness.db?.close();
    curatedHarness.db = new Database(':memory:');
    vi.clearAllMocks();
  });

  it('should_list_curated_samples_when_tool_runs_table_is_absent_and_not_crash', async () => {
    const {
      captureCuratedGoldenCandidate,
      listCuratedGoldenSamples,
      getCuratedGoldenSample,
    } = await import('@packages/core-logic/goldenDatasetBridge.js');

    const saved = captureCuratedGoldenCandidate({
      id: 'curated-manual-1',
      prompt: 'Document the manual curated sample that should remain listable without tool run history.',
      completion: 'The curated entry is stored and should still be returned even if tool_runs does not exist.',
      source: 'manual-review',
      quality: 0.91,
      autoApprove: true,
      reviewedBy: 'qa-reviewer',
      reviewNotes: 'Seeded for regression coverage.',
      provenance: { kind: 'manual_regression' },
    });

    expect(saved.success).toBe(true);
    expect(() => listCuratedGoldenSamples({ limit: 10 })).not.toThrow();

    const samples = listCuratedGoldenSamples({ limit: 10 });
    expect(samples).toHaveLength(1);
    expect(samples[0]).toEqual(expect.objectContaining({
      id: 'curated-manual-1',
      source: 'manual-review',
      approvalState: 'approved',
      reviewedBy: 'qa-reviewer',
      reviewNotes: 'Seeded for regression coverage.',
      provenance: { kind: 'manual_regression' },
    }));
    expect(getCuratedGoldenSample('curated-manual-1')?.id).toBe('curated-manual-1');
  });

  it('should_capture_successful_tool_runs_once_when_curated_listing_refreshes_and_skip_existing_rows', async () => {
    const db = curatedHarness.db!;
    db.exec(`
      CREATE TABLE tool_runs (
        id INTEGER PRIMARY KEY,
        timestamp TEXT,
        tool_name TEXT NOT NULL,
        input_params TEXT,
        output_data TEXT,
        success INTEGER DEFAULT 1,
        quality_score REAL DEFAULT 0.5
      );
    `);
    db.prepare(`
      INSERT INTO tool_runs (id, timestamp, tool_name, input_params, output_data, success, quality_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      101,
      '2026-04-05T10:15:00.000Z',
      'formatter',
      '{"input":"sample"}',
      '{"output":"formatted"}',
      1,
      0.83,
    );
    db.prepare(`
      INSERT INTO tool_runs (id, timestamp, tool_name, input_params, output_data, success, quality_score)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      102,
      '2026-04-05T10:16:00.000Z',
      'formatter',
      '{"input":"broken"}',
      '{"output":"skipped"}',
      0,
      0.99,
    );

    const {
      captureCuratedGoldenCandidate,
      captureToolRunCandidates,
      listCuratedGoldenSamples,
    } = await import('@packages/core-logic/goldenDatasetBridge.js');

    captureCuratedGoldenCandidate({
      id: 'curated_tool_run_101',
      prompt: 'Existing curated prompt for the first tool run.',
      completion: 'This row already exists and should prevent duplicate capture.',
      source: 'tool_run:formatter',
      quality: 0.88,
      provenance: { kind: 'seeded_existing_tool_run' },
    });

    expect(captureToolRunCandidates(10)).toEqual([]);

    const samplesAfterFirstCapture = listCuratedGoldenSamples({ limit: 10 });
    expect(samplesAfterFirstCapture).toHaveLength(1);
    expect(samplesAfterFirstCapture[0]?.id).toBe('curated_tool_run_101');

    db.prepare('DELETE FROM curated_golden_samples WHERE id = ?').run('curated_tool_run_101');

    const firstRefresh = listCuratedGoldenSamples({ limit: 10 });
    expect(firstRefresh).toHaveLength(1);
    expect(firstRefresh[0]).toEqual(expect.objectContaining({
      id: 'curated_tool_run_101',
      source: 'tool_run:formatter',
      approvalState: 'pending',
    }));
    expect(firstRefresh[0]?.prompt).toContain('Tool execution request');
    expect(firstRefresh[0]?.completion).toContain('Tool execution response');

    const secondRefresh = listCuratedGoldenSamples({ limit: 10 });
    expect(secondRefresh).toHaveLength(1);
    expect(secondRefresh[0]?.id).toBe('curated_tool_run_101');

    const curatedCount = db.prepare('SELECT COUNT(*) AS count FROM curated_golden_samples').get() as { count: number };
    expect(curatedCount.count).toBe(1);
  });
});
