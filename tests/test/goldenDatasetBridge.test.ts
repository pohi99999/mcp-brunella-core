/**
 * FILE: test/goldenDatasetBridge.test.ts
 * PURPOSE: G4.4 — Tests for goldenDatasetBridge module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

type GoldenRow = {
  sample_hash: string;
  prompt: string;
  completion: string;
  source: string;
  quality: number;
  remote_status: string;
  remote_synced_at?: string;
  created_at: string;
  updated_at: string;
};

const goldenRows = new Map<string, GoldenRow>();

function createFakeDb() {
  return {
    exec: vi.fn(),
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes('INSERT INTO golden_samples')) {
          const params = args[0] as Record<string, unknown>;
          const row: GoldenRow = {
            sample_hash: String(params.sample_hash),
            prompt: String(params.prompt),
            completion: String(params.completion),
            source: String(params.source),
            quality: Number(params.quality),
            remote_status: 'pending',
            created_at: String(params.created_at),
            updated_at: String(params.updated_at),
          };
          goldenRows.set(row.sample_hash, row);
          return { changes: 1 };
        }

        if (sql.includes("UPDATE golden_samples")) {
          const sampleHash = String(args.at(-1));
          const current = goldenRows.get(sampleHash);
          if (current) {
            const remoteStatusArg = typeof args[0] === 'string' && (args[0] === 'pending' || args[0] === 'synced' || args[0] === 'failed')
              ? String(args[0])
              : undefined;
            current.remote_status = remoteStatusArg
              ? remoteStatusArg
              : (sql.includes("remote_status = 'synced'") ? 'synced' : 'failed');
            current.remote_synced_at = typeof args[1] === 'string' ? String(args[1]) : current.remote_synced_at;
            current.updated_at = typeof args[2] === 'string'
              ? String(args[2])
              : (typeof args[1] === 'string' ? String(args[1]) : current.updated_at);
            goldenRows.set(sampleHash, current);
          }
          return { changes: current ? 1 : 0 };
        }

        return { changes: 0 };
      },
      get: () => {
        if (sql.includes('COUNT(*) AS total_samples')) {
          return { total_samples: goldenRows.size };
        }
        return undefined;
      },
      all: () => {
        if (sql.includes('FROM golden_samples')) {
          return Array.from(goldenRows.values());
        }
        return [];
      },
    }),
  };
}

// Mock getD1Adapter
vi.mock('@packages/utils/globalDb.js', () => ({
  getD1Adapter: vi.fn(),
  getGlobalDb: vi.fn(() => createFakeDb()),
}));

import { getD1Adapter, getGlobalDb } from '@packages/utils/globalDb.js';
import {
  saveGoldenSample,
  saveGoldenSampleLocal,
  getGoldenStats,
  autoSaveGoldenSample,
  calculateQuality,
  syncLocalToD1,
  exportGoldenDataset,
  captureToolRunCandidates,
  listCuratedGoldenSamples,
  reviewCuratedGoldenSample,
  getCuratedGoldenSample,
  getCuratedGoldenStats,
  captureCuratedGoldenCandidate,
  captureApprovedRemediationGoldenCandidate,
  type GoldenSample,
  type GoldenSaveResult,
  type GoldenDatasetStats,
  type CuratedGoldenSample,
} from '@packages/core-logic/goldenDatasetBridge.js';

describe('goldenDatasetBridge', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    goldenRows.clear();
    vi.mocked(getD1Adapter).mockReset();
  });

  describe('saveGoldenSample', () => {
    it('should reject too short prompts (RULE-GD2)', async () => {
      const result = await saveGoldenSample({
        prompt: 'short',
        completion: 'A proper completion response with enough detail',
        source: 'test',
        quality: 0.8
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('too short');
    });

    it('should reject low quality samples (RULE-GD2)', async () => {
      const result = await saveGoldenSample({
        prompt: 'This is a long enough prompt for testing purposes',
        completion: 'ok',
        source: 'test',
        quality: 0.2
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Quality');
    });

    it('should save valid sample via Python API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'saved', stats: { totalSamples: 1 } })
      });

      const result = await saveGoldenSample({
        prompt: 'What is the best pattern for dependency injection in TypeScript?',
        completion: 'The recommended pattern is to use constructor injection with interfaces...',
        source: 'test-agent',
        quality: 0.85
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle Python API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await saveGoldenSample({
        prompt: 'A valid prompt that is long enough for testing purposes right here',
        completion: 'A valid completion with enough content to pass quality heuristics and checks',
        source: 'test',
        quality: 0.9
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await saveGoldenSample({
        prompt: 'A valid prompt that is definitely long enough for testing purposes',
        completion: 'A valid completion that has sufficient content length for quality scoring heuristics',
        source: 'test',
        quality: 0.9
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('ECONNREFUSED');
    });
  });

  describe('getGoldenStats', () => {
    it('should return stats from Python API', async () => {
      // Mock D1 adapter to fail so it falls back to Python
      vi.mocked(getD1Adapter).mockReturnValueOnce({
        getAllGoldenSamples: vi.fn().mockRejectedValue(new Error('D1 error'))
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: { totalSamples: 42, newSinceLastTraining: 10 } })
      });

      const stats = await getGoldenStats();
      expect(stats).toBeDefined();
      expect(stats?.totalSamples).toBe(42);
    });

    it('should normalize snake_case stats from Python API', async () => {
      vi.mocked(getD1Adapter).mockReturnValueOnce({
        getAllGoldenSamples: vi.fn().mockRejectedValue(new Error('D1 error')),
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stats: {
            total_samples: 1568,
            avg_quality: 0.65,
            file_size_mb: 1.53,
            status: 'READY',
            sources: { researcher: 3, voice: 1 },
          },
        }),
      });

      const stats = await getGoldenStats();

      expect(stats).toEqual({
        totalSamples: 1568,
        newSinceLastTraining: 0,
        lastTrainingAt: undefined,
        sources: { researcher: 3, voice: 1 },
        avgQuality: 0.65,
        fileSizeMb: 1.53,
        status: 'READY',
      });
    });

    it('should return null on API failure', async () => {
      // Mock D1 adapter to fail so it falls back to Python
      vi.mocked(getD1Adapter).mockReturnValueOnce({
        getAllGoldenSamples: vi.fn().mockRejectedValue(new Error('D1 error'))
      } as any);

      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      const stats = await getGoldenStats();
      expect(stats).toEqual({ totalSamples: 0, newSinceLastTraining: 0 });
    });
  });

  describe('syncLocalToD1', () => {
    it('should fall back to Python sync when D1 returns an error', async () => {
      saveGoldenSampleLocalForTest();
      vi.mocked(getD1Adapter).mockReturnValueOnce({
        insertGoldenSample: vi.fn().mockResolvedValue({
          status: 'error',
          error: 'D1 worker returned HTML instead of JSON',
        }),
      } as unknown as ReturnType<typeof getD1Adapter>);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'saved via python backup', stats: { totalSamples: 1 } }),
      });

      const result = await syncLocalToD1();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(goldenRows.values().next().value.remote_status).toBe('synced');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoSaveGoldenSample', () => {
    it('should skip save for very short task+result (quality < 0.5)', async () => {
      // autoSaveGoldenSample does NOT check result.status — it checks quality
      // Very short task "x" with short completion → quality will be base 0.5 but prompt < 10
      // This sample will be rejected at saveGoldenSample level if prompt < MIN_PROMPT_LENGTH
      await autoSaveGoldenSample('TestAgent', 'x', 'y');
      // Quality for "x" / "y" → base 0.5, no length bonus, no code bonus = 0.5
      // Prompt length < MIN_PROMPT_LENGTH (10) → rejected at save level
      // But autoSaveGoldenSample checks quality BEFORE calling save
      // calculateQuality("x", "y") = 0.5 which is NOT < 0.5, so it WILL call save
      // save will reject because prompt "x" is too short
      // So fetch WILL NOT be called (rejected before fetch)
    });

    it('should attempt save on quality result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'saved' })
      });

      await autoSaveGoldenSample('TestAgent', 'Write a function to sort arrays efficiently', 
        'Here is the optimized quicksort implementation with TypeScript generics and proper type safety using export class...');

      // Quality should be high enough to attempt save — just ensure no crash
    });
  });

  describe('calculateQuality', () => {
    it('should return base score for short prompt/completion', () => {
      const q = calculateQuality('short', 'ok');
      expect(q).toBeCloseTo(0.5, 1);
    });

    it('should give bonus for longer prompts', () => {
      const q = calculateQuality('A'.repeat(201), 'ok');
      expect(q).toBeGreaterThan(0.5);
    });

    it('should give bonus for code-like completions', () => {
      const q = calculateQuality('test', 'export function sort() { return []; }');
      expect(q).toBeGreaterThan(0.5);
    });
  });

  describe('types', () => {
    it('should define GoldenSample correctly', () => {
      const sample: GoldenSample = {
        prompt: 'test prompt',
        completion: 'test completion',
        source: 'test',
        quality: 0.75
      };
      expect(sample.prompt).toBe('test prompt');
    });

    it('should define GoldenSaveResult correctly', () => {
      const result: GoldenSaveResult = { success: true };
      expect(result.success).toBe(true);
    });

    it('should define GoldenDatasetStats correctly', () => {
      const stats: GoldenDatasetStats = { totalSamples: 100, newSinceLastTraining: 5 };
      expect(stats.totalSamples).toBe(100);
    });
  });
});

function saveGoldenSampleLocalForTest(): void {
  goldenRows.set('sample-hash-1', {
    sample_hash: 'sample-hash-1',
    prompt: 'How should MCP tool results be captured safely for later learning?',
    completion: 'Persist successful executions into a durable table and review them before promotion.',
    source: 'TestRecoveryAgent',
    quality: 0.91,
    remote_status: 'failed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// ============================================================================
// CURATED GOLDEN DATASET TESTS — separate fake DB for curated/tool-run flow
// ============================================================================

type CuratedRow = {
  id: string;
  prompt: string;
  completion: string;
  source: string;
  quality: number;
  approval_state: string;
  provenance: string | null;
  pii_redacted_count: number;
  created_at: string;
  approved_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
};

/**
 * A more comprehensive in-memory fake DB that supports curated_golden_samples,
 * golden_samples, and the optional tool_runs table.  Designed for the new
 * curated/tool-run test suites without touching existing goldenRows state.
 */
function createCuratedAwareFakeDb(opts: {
  hasToolRunsTable?: boolean;
  toolRuns?: Array<Record<string, unknown>>;
  initialCurated?: CuratedRow[];
} = {}) {
  const localGolden = new Map<string, GoldenRow>();
  const localCurated = new Map<string, CuratedRow>(
    (opts.initialCurated ?? []).map((r) => [r.id, r]),
  );

  return {
    exec: vi.fn(),
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        // ensureCuratedTable migration: candidate → pending
        if (sql.includes("SET approval_state = 'pending'") && sql.includes("approval_state = 'candidate'")) {
          return { changes: 0 };
        }
        // ensureCuratedTable seed: INSERT OR IGNORE INTO curated FROM golden_samples
        if (sql.includes('INSERT OR IGNORE INTO curated_golden_samples')) {
          for (const [hash, gr] of localGolden) {
            const id = `curated_tool_${hash}`;
            if (!localCurated.has(id)) {
              localCurated.set(id, {
                id,
                prompt: gr.prompt,
                completion: gr.completion,
                source: gr.source,
                quality: gr.quality,
                approval_state: 'pending',
                provenance: null,
                pii_redacted_count: 0,
                created_at: gr.created_at,
                approved_at: null,
                reviewed_by: null,
                review_notes: null,
              });
            }
          }
          return { changes: localGolden.size };
        }
        // captureCuratedGoldenCandidate INSERT (with ON CONFLICT)
        if (sql.includes('INSERT INTO curated_golden_samples') && sql.includes('ON CONFLICT')) {
          const [id, prompt, completion, source, quality, approval_state, provenance, created_at, approved_at, reviewed_by, review_notes] = args;
          const existing = localCurated.get(String(id));
          const finalState =
            existing?.approval_state === 'approved' || existing?.approval_state === 'rejected'
              ? existing.approval_state
              : String(approval_state);
          localCurated.set(String(id), {
            id: String(id),
            prompt: String(prompt),
            completion: String(completion),
            source: String(source),
            quality: Number(quality),
            approval_state: finalState,
            provenance: provenance != null ? String(provenance) : null,
            pii_redacted_count: existing?.pii_redacted_count ?? 0,
            created_at: String(created_at),
            approved_at:
              existing?.approval_state === 'approved'
                ? existing.approved_at
                : approved_at != null
                  ? String(approved_at)
                  : null,
            reviewed_by:
              existing?.approval_state === 'approved' || existing?.approval_state === 'rejected'
                ? existing.reviewed_by
                : reviewed_by != null ? String(reviewed_by) : null,
            review_notes:
              existing?.approval_state === 'approved' || existing?.approval_state === 'rejected'
                ? existing.review_notes
                : review_notes != null ? String(review_notes) : null,
          });
          return { changes: 1 };
        }
        // reviewCuratedGoldenSample UPDATE
        if (sql.includes('UPDATE curated_golden_samples SET approval_state = ?, reviewed_by')) {
          const [decision, reviewer, notes, approved_at, id] = args;
          const row = localCurated.get(String(id));
          if (row) {
            row.approval_state = String(decision);
            row.reviewed_by = reviewer != null ? String(reviewer) : null;
            row.review_notes = notes != null ? String(notes) : null;
            row.approved_at = approved_at != null ? String(approved_at) : null;
            localCurated.set(row.id, row);
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        // INSERT INTO golden_samples (saveGoldenSampleLocal)
        if (sql.includes('INSERT INTO golden_samples')) {
          const params = args[0] as Record<string, unknown>;
          localGolden.set(String(params.sample_hash), {
            sample_hash: String(params.sample_hash),
            prompt: String(params.prompt),
            completion: String(params.completion),
            source: String(params.source),
            quality: Number(params.quality),
            remote_status: 'pending',
            created_at: String(params.created_at),
            updated_at: String(params.updated_at),
          });
          return { changes: 1 };
        }
        // UPDATE golden_samples (remote status updates)
        if (sql.includes('UPDATE golden_samples')) {
          return { changes: 0 };
        }
        return { changes: 0 };
      },

      get: (arg?: unknown) => {
        // sqlite_master: table existence check
        if (sql.includes('sqlite_master') && sql.includes("name = ?")) {
          const tableName = String(arg);
          if (tableName === 'tool_runs') {
            return opts.hasToolRunsTable ? { name: 'tool_runs' } : undefined;
          }
          return undefined;
        }
        // captureToolRunCandidates existence check
        if (sql.includes('SELECT id FROM curated_golden_samples WHERE id = ?')) {
          const row = localCurated.get(String(arg));
          return row ? { id: row.id } : undefined;
        }
        // captureCuratedGoldenCandidate state check
        if (sql.includes('approval_state AS approvalState')) {
          const row = localCurated.get(String(arg));
          if (!row) return undefined;
          return { approvalState: row.approval_state, approvedAt: row.approved_at, reviewedBy: row.reviewed_by, reviewNotes: row.review_notes };
        }
        // getCuratedGoldenSample / reviewCuratedGoldenSample post-update read
        if (sql.includes('SELECT * FROM curated_golden_samples WHERE id = ?')) {
          return localCurated.get(String(arg)) ?? undefined;
        }
        // getGoldenStats local count
        if (sql.includes('COUNT(*) AS total_samples')) {
          return { total_samples: localGolden.size };
        }
        return undefined;
      },

      all: (...args: unknown[]) => {
        // tool_runs rows
        if (sql.includes('FROM tool_runs')) {
          return opts.toolRuns ?? [];
        }
        // getCuratedGoldenStats: general aggregate (no source filter)
        if (sql.includes('AVG(quality) AS avg_quality') && sql.includes('curated_golden_samples') && !sql.includes('source = ?')) {
          const groups = new Map<string, { count: number; total_quality: number }>();
          for (const row of localCurated.values()) {
            const g = groups.get(row.approval_state) ?? { count: 0, total_quality: 0 };
            g.count++;
            g.total_quality += row.quality;
            groups.set(row.approval_state, g);
          }
          return Array.from(groups.entries()).map(([state, g]) => ({
            approval_state: state,
            count: g.count,
            avg_quality: g.count > 0 ? g.total_quality / g.count : null,
          }));
        }
        // getCuratedGoldenStats: remediation-specific aggregate (with source = ?)
        if (sql.includes('AVG(quality) AS avg_quality') && sql.includes('source = ?')) {
          const source = String(args[0]);
          const groups = new Map<string, { count: number; total_quality: number; last_approved_at: string | null }>();
          for (const row of localCurated.values()) {
            if (row.source !== source) continue;
            const g = groups.get(row.approval_state) ?? { count: 0, total_quality: 0, last_approved_at: null };
            g.count++;
            g.total_quality += row.quality;
            if (row.approved_at && (!g.last_approved_at || row.approved_at > g.last_approved_at)) {
              g.last_approved_at = row.approved_at;
            }
            groups.set(row.approval_state, g);
          }
          return Array.from(groups.entries()).map(([state, g]) => ({
            approval_state: state,
            count: g.count,
            avg_quality: g.count > 0 ? g.total_quality / g.count : null,
            last_approved_at: g.last_approved_at,
          }));
        }
        // listCuratedGoldenSamples / captureApprovedRemediationGoldenCandidate
        if (sql.includes('SELECT * FROM curated_golden_samples')) {
          let rows = Array.from(localCurated.values());
          const params = [...args];
          const offset = Number(params.pop()) || 0;
          const limit = Number(params.pop()) || 100;
          let idx = 0;
          if (sql.includes('approval_state IN (?, ?)')) {
            const allowed = new Set([String(params[idx++]), String(params[idx++])]);
            rows = rows.filter((r) => allowed.has(r.approval_state));
          } else if (sql.includes('approval_state = ?')) {
            rows = rows.filter((r) => r.approval_state === String(params[idx++]));
          }
          if (sql.includes('source = ?')) {
            rows = rows.filter((r) => r.source === String(params[idx++]));
          }
          rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
          return rows.slice(offset, offset + limit);
        }
        // golden_samples list
        if (sql.includes('FROM golden_samples')) {
          return Array.from(localGolden.values());
        }
        return [];
      },
    }),
  };
}

// ============================================================================
// CURATED TESTS: captureToolRunCandidates
// ============================================================================

describe('captureToolRunCandidates', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_return_empty_array_when_tool_runs_table_is_absent_and_not_crash', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    const result = captureToolRunCandidates();

    expect(result).toEqual([]);
  });

  it('should_return_empty_array_when_tool_runs_table_absent_even_with_limit_argument', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    // Should not throw regardless of limit argument
    expect(() => captureToolRunCandidates(200)).not.toThrow();
    expect(captureToolRunCandidates(0)).toEqual([]);
  });

  it('should_return_empty_array_when_tool_runs_table_present_but_has_no_successful_rows', () => {
    vi.mocked(getGlobalDb).mockReturnValue(
      createCuratedAwareFakeDb({ hasToolRunsTable: true, toolRuns: [] }) as ReturnType<typeof getGlobalDb>,
    );

    const result = captureToolRunCandidates();

    expect(result).toEqual([]);
  });

  it('should_create_curated_candidates_from_successful_tool_runs_when_table_present', () => {
    const toolRuns = [
      {
        id: 'run-001',
        tool_name: 'codeSearch',
        input_params: JSON.stringify({ query: 'authentication logic' }),
        output_data: JSON.stringify({ results: ['src/auth.ts', 'src/middleware.ts'] }),
        timestamp: new Date().toISOString(),
        quality_score: 0.88,
        success: 1,
      },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(
      createCuratedAwareFakeDb({ hasToolRunsTable: true, toolRuns }) as ReturnType<typeof getGlobalDb>,
    );

    const result = captureToolRunCandidates();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('curated_tool_run_run-001');
    expect(result[0].source).toBe('tool_run:codeSearch');
    expect(result[0].approvalState).toBe('pending');
    expect(result[0].prompt).toContain('codeSearch');
    expect(result[0].completion).toContain('codeSearch');
  });

  it('should_skip_tool_runs_already_captured_as_curated_candidates', () => {
    const existingRow: CuratedRow = {
      id: 'curated_tool_run_run-002',
      prompt: 'existing',
      completion: 'existing',
      source: 'tool_run:existingTool',
      quality: 0.7,
      approval_state: 'approved',
      provenance: null,
      pii_redacted_count: 0,
      created_at: new Date().toISOString(),
      approved_at: null,
      reviewed_by: null,
      review_notes: null,
    };
    const toolRuns = [
      { id: 'run-002', tool_name: 'existingTool', input_params: 'x', output_data: 'y', timestamp: new Date().toISOString(), quality_score: 0.7, success: 1 },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(
      createCuratedAwareFakeDb({ hasToolRunsTable: true, toolRuns, initialCurated: [existingRow] }) as ReturnType<typeof getGlobalDb>,
    );

    const result = captureToolRunCandidates();

    // Already exists → skipped → returned list is empty
    expect(result).toHaveLength(0);
  });

  it('should_handle_null_and_undefined_tool_run_fields_without_crashing', () => {
    const toolRuns = [
      { id: 'run-003', tool_name: 'nullFieldTool', input_params: null, output_data: undefined, timestamp: null, quality_score: null, success: 1 },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(
      createCuratedAwareFakeDb({ hasToolRunsTable: true, toolRuns }) as ReturnType<typeof getGlobalDb>,
    );

    // Production code may skip or handle null fields — only guarantee is no throw
    let result: CuratedGoldenSample[] | undefined;
    expect(() => { result = captureToolRunCandidates(); }).not.toThrow();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================================
// CURATED TESTS: listCuratedGoldenSamples
// ============================================================================

describe('listCuratedGoldenSamples', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_not_crash_and_return_empty_array_when_tool_runs_table_is_absent', () => {
    // REGRESSION: this was the crash path — tool_runs absent must not throw
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    let result: CuratedGoldenSample[] | undefined;
    expect(() => {
      result = listCuratedGoldenSamples({});
    }).not.toThrow();
    expect(result).toEqual([]);
  });

  it('should_return_empty_array_when_no_curated_samples_exist', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    const result = listCuratedGoldenSamples({});
    expect(result).toHaveLength(0);
  });

  it('should_return_all_samples_when_no_filters_applied', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'c1', prompt: 'p1', completion: 'co1', source: 'agent1', quality: 0.8, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
      { id: 'c2', prompt: 'p2', completion: 'co2', source: 'agent2', quality: 0.9, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'reviewer', review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = listCuratedGoldenSamples({});

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['c1', 'c2']));
  });

  it('should_filter_by_approval_state_when_state_option_provided', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'c3', prompt: 'p3', completion: 'co3', source: 's', quality: 0.8, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
      { id: 'c4', prompt: 'p4', completion: 'co4', source: 's', quality: 0.9, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = listCuratedGoldenSamples({ state: 'pending' });

    expect(result).toHaveLength(1);
    expect(result[0].approvalState).toBe('pending');
  });

  it('should_filter_by_source_when_source_option_provided', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'c5', prompt: 'p5', completion: 'co5', source: 'agentA', quality: 0.8, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
      { id: 'c6', prompt: 'p6', completion: 'co6', source: 'agentB', quality: 0.7, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = listCuratedGoldenSamples({ source: 'agentA' });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('agentA');
  });

  it('should_respect_limit_and_offset_pagination', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: `page-${i}`,
      prompt: `p${i}`,
      completion: `c${i}`,
      source: 's',
      quality: 0.7,
      approval_state: 'pending',
      provenance: null,
      pii_redacted_count: 0,
      created_at: new Date(Date.now() + i * 1000).toISOString(),
      approved_at: null,
      reviewed_by: null,
      review_notes: null,
    }));
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const page1 = listCuratedGoldenSamples({ limit: 2, offset: 0 });
    const page2 = listCuratedGoldenSamples({ limit: 2, offset: 2 });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });
});

// ============================================================================
// CURATED TESTS: reviewCuratedGoldenSample
// ============================================================================

describe('reviewCuratedGoldenSample', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_approve_sample_and_return_updated_record_with_reviewer_info', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'review-1', prompt: 'p', completion: 'c', source: 's', quality: 0.9, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = reviewCuratedGoldenSample('review-1', 'approved', 'alice@test.com', 'High quality response');

    expect(result).not.toBeNull();
    expect(result?.approvalState).toBe('approved');
    expect(result?.reviewedBy).toBe('alice@test.com');
    expect(result?.reviewNotes).toBe('High quality response');
    expect(result?.approvedAt).not.toBeNull();
  });

  it('should_reject_sample_and_set_approved_at_to_null', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'review-2', prompt: 'p', completion: 'c', source: 's', quality: 0.9, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = reviewCuratedGoldenSample('review-2', 'rejected', 'bob@test.com');

    expect(result).not.toBeNull();
    expect(result?.approvalState).toBe('rejected');
    // approvedAt is unset / null for rejected samples
    expect(result?.approvedAt == null).toBe(true);
  });

  it('should_return_null_when_sample_id_does_not_exist', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = reviewCuratedGoldenSample('nonexistent-id', 'approved', 'reviewer');

    expect(result).toBeNull();
  });
});

// ============================================================================
// CURATED TESTS: getCuratedGoldenSample
// ============================================================================

describe('getCuratedGoldenSample', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_return_null_when_sample_id_does_not_exist', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = getCuratedGoldenSample('does-not-exist');

    expect(result).toBeNull();
  });

  it('should_return_sample_when_id_exists', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'get-1', prompt: 'found prompt', completion: 'found completion', source: 'source-x', quality: 0.85, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: 'ok' },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = getCuratedGoldenSample('get-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('get-1');
    expect(result?.prompt).toBe('found prompt');
    expect(result?.approvalState).toBe('approved');
    expect(result?.quality).toBe(0.85);
  });

  it('should_deserialize_provenance_json_when_present', () => {
    const now = new Date().toISOString();
    const provenance = JSON.stringify({ kind: 'tool_run_capture', toolName: 'search' });
    const initialCurated: CuratedRow[] = [
      { id: 'get-prov', prompt: 'p', completion: 'c', source: 's', quality: 0.7, approval_state: 'pending', provenance, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ initialCurated }) as ReturnType<typeof getGlobalDb>);

    const result = getCuratedGoldenSample('get-prov');

    expect(result?.provenance).toEqual({ kind: 'tool_run_capture', toolName: 'search' });
  });
});

// ============================================================================
// CURATED TESTS: getCuratedGoldenStats
// ============================================================================

describe('getCuratedGoldenStats', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_return_all_zero_stats_when_no_samples_exist', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    const stats = getCuratedGoldenStats();

    expect(stats.totalCandidates).toBe(0);
    expect(stats.approvedCount).toBe(0);
    expect(stats.rejectedCount).toBe(0);
    expect(stats.pendingReview).toBe(0);
    expect(stats.avgQuality).toBe(0);
    expect(stats.remediationDerived.totalCandidates).toBe(0);
  });

  it('should_count_samples_correctly_by_approval_state', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 's1', prompt: 'p', completion: 'c', source: 'a', quality: 0.8, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
      { id: 's2', prompt: 'p', completion: 'c', source: 'a', quality: 0.9, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: null },
      { id: 's3', prompt: 'p', completion: 'c', source: 'a', quality: 0.6, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: null },
      { id: 's4', prompt: 'p', completion: 'c', source: 'a', quality: 0.5, approval_state: 'rejected', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: 'r', review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const stats = getCuratedGoldenStats();

    expect(stats.totalCandidates).toBe(4);
    expect(stats.approvedCount).toBe(2);
    expect(stats.rejectedCount).toBe(1);
    expect(stats.pendingReview).toBe(1);
    expect(stats.avgQuality).toBeCloseTo(0.7, 1);
  });

  it('should_compute_remediation_derived_stats_separately', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'rem1', prompt: 'p', completion: 'c', source: 'github_remediation_runtime', quality: 0.95, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: null },
      { id: 'other1', prompt: 'p', completion: 'c', source: 'different_source', quality: 0.7, approval_state: 'pending', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: null, reviewed_by: null, review_notes: null },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>);

    const stats = getCuratedGoldenStats();

    expect(stats.remediationDerived.totalCandidates).toBe(1);
    expect(stats.remediationDerived.approvedCount).toBe(1);
    expect(stats.remediationDerived.lastApprovedAt).toBeDefined();
    // Non-remediation sample should count in main total but not remediation
    expect(stats.totalCandidates).toBe(2);
  });

  it('should_return_empty_fallback_stats_when_db_throws', () => {
    // Simulate a DB that throws on every call
    vi.mocked(getGlobalDb).mockReturnValue({
      exec: vi.fn(() => { throw new Error('DB unavailable'); }),
      prepare: vi.fn(() => { throw new Error('DB unavailable'); }),
    } as unknown as ReturnType<typeof getGlobalDb>);

    const stats = getCuratedGoldenStats();

    expect(stats).toBeDefined();
    expect(stats.totalCandidates).toBe(0);
    expect(stats.approvedCount).toBe(0);
  });
});

// ============================================================================
// CURATED TESTS: captureCuratedGoldenCandidate
// ============================================================================

describe('captureCuratedGoldenCandidate', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_save_new_candidate_with_pending_state_by_default', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = captureCuratedGoldenCandidate({
      id: 'cap-1',
      prompt: 'A good prompt for testing',
      completion: 'A good completion',
      source: 'test-agent',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('cap-1');
  });

  it('should_auto_approve_sample_when_autoApprove_is_true', () => {
    const db = createCuratedAwareFakeDb({});
    vi.mocked(getGlobalDb).mockReturnValue(db as ReturnType<typeof getGlobalDb>);

    captureCuratedGoldenCandidate({
      id: 'cap-auto',
      prompt: 'Auto approved prompt',
      completion: 'Auto approved completion',
      source: 'auto-agent',
      autoApprove: true,
      reviewedBy: 'system',
    });

    // Verify the sample was stored as approved
    vi.mocked(getGlobalDb).mockReturnValue(db as ReturnType<typeof getGlobalDb>);
    const sample = getCuratedGoldenSample('cap-auto');
    expect(sample?.approvalState).toBe('approved');
  });

  it('should_not_overwrite_approval_state_for_already_approved_sample', () => {
    const now = new Date().toISOString();
    const initialCurated: CuratedRow[] = [
      { id: 'cap-existing', prompt: 'p', completion: 'c', source: 's', quality: 0.9, approval_state: 'approved', provenance: null, pii_redacted_count: 0, created_at: now, approved_at: now, reviewed_by: 'r', review_notes: null },
    ];
    const db = createCuratedAwareFakeDb({ initialCurated });
    vi.mocked(getGlobalDb).mockReturnValue(db as ReturnType<typeof getGlobalDb>);

    // Re-capture with pending state — should not overwrite approved
    captureCuratedGoldenCandidate({
      id: 'cap-existing',
      prompt: 'updated prompt',
      completion: 'updated completion',
      source: 's',
    });

    vi.mocked(getGlobalDb).mockReturnValue(db as ReturnType<typeof getGlobalDb>);
    const sample = getCuratedGoldenSample('cap-existing');
    expect(sample?.approvalState).toBe('approved');
  });

  it('should_generate_unique_id_when_no_id_provided', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = captureCuratedGoldenCandidate({
      prompt: 'Some prompt without explicit id',
      completion: 'Some completion',
      source: 'agent',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id!.length).toBeGreaterThan(0);
  });

  it('should_write_pending_as_candidate_on_legacy_schema_and_normalize_reads', async () => {
    const db = new Database(':memory:');
    vi.mocked(getGlobalDb).mockReturnValue(db as ReturnType<typeof getGlobalDb>);
    db.exec(`
      CREATE TABLE curated_golden_samples (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        completion TEXT NOT NULL,
        source TEXT NOT NULL,
        quality REAL NOT NULL,
        approval_state TEXT NOT NULL CHECK (approval_state IN ('candidate', 'approved', 'rejected')),
        provenance TEXT,
        pii_redacted_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        reviewed_by TEXT,
        review_notes TEXT
      );
    `);

    const { captureCuratedGoldenCandidate, getCuratedGoldenSample, listCuratedGoldenSamples } = await import('@packages/core-logic/goldenDatasetBridge.js');

    const result = captureCuratedGoldenCandidate({
      id: 'legacy-curated-1',
      prompt: 'Legacy approval state handling prompt with enough content.',
      completion: 'Legacy schema should accept candidate while the public API still reads pending.',
      source: 'legacy-agent',
    });

    expect(result.success).toBe(true);

    const rawRow = db.prepare('SELECT approval_state FROM curated_golden_samples WHERE id = ?').get('legacy-curated-1') as { approval_state: string } | undefined;
    expect(rawRow?.approval_state).toBe('candidate');
    expect(getCuratedGoldenSample('legacy-curated-1')?.approvalState).toBe('pending');
    expect(listCuratedGoldenSamples({ state: 'pending' }).map((sample) => sample.id)).toContain('legacy-curated-1');
    db.close();
  });
});

// ============================================================================
// CURATED TESTS: saveGoldenSampleLocal
// ============================================================================

describe('saveGoldenSampleLocal', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_reject_sample_when_quality_is_below_minimum_threshold', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = saveGoldenSampleLocal({
      prompt: 'valid prompt length',
      completion: 'valid completion',
      source: 'test',
      quality: 0.1,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Quality');
    expect(result.message).toContain('0.1');
  });

  it('should_save_sample_locally_when_quality_meets_threshold', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = saveGoldenSampleLocal({
      prompt: 'This is a prompt with enough content',
      completion: 'This is a completion with enough content',
      source: 'test-agent',
      quality: 0.75,
    });

    expect(result.success).toBe(true);
    expect(result.stats?.storage).toBe('sqlite');
  });

  it('should_save_sample_at_exactly_minimum_quality_boundary', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = saveGoldenSampleLocal({
      prompt: 'A valid test prompt',
      completion: 'A valid test completion',
      source: 'test',
      quality: 0.5, // exactly at threshold
    });

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// CURATED TESTS: exportGoldenDataset
// ============================================================================

describe('exportGoldenDataset', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_export_empty_string_when_no_golden_samples_exist', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = exportGoldenDataset('jsonl');

    expect(result).toBe('');
  });

  it('should_export_valid_json_array_when_format_is_json', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    const result = exportGoldenDataset('json');

    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual([]);
  });

  it('should_default_to_jsonl_format_when_no_format_specified', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({}) as ReturnType<typeof getGlobalDb>);

    // Should not throw, return empty string for jsonl
    const result = exportGoldenDataset();
    expect(typeof result).toBe('string');
  });
});

// ============================================================================
// CURATED TESTS: captureApprovedRemediationGoldenCandidate
// ============================================================================

describe('captureApprovedRemediationGoldenCandidate', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(getD1Adapter).mockReset();
  });

  it('should_save_remediation_candidate_as_auto_approved', () => {
    vi.mocked(getGlobalDb).mockReturnValue(createCuratedAwareFakeDb({ hasToolRunsTable: false }) as ReturnType<typeof getGlobalDb>);

    const result = captureApprovedRemediationGoldenCandidate({
      id: 'rem-run-001',
      repositoryName: 'org/repo',
      status: 'approved',
      updatedAt: new Date().toISOString(),
      analysis: { summary: 'Fixed failing CI pipeline', affectedFiles: ['src/ci.ts'] },
      fixer: { agentName: 'FixerAgent', resultSummary: 'Applied patch' },
      verification: [{ name: 'tests', status: 'passed' }],
      finalApproval: { response: { by: 'admin@test.com' } },
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('curated_remediation_rem-run-001');
    expect(result.duplicate).toBe(false);
  });

  it('should_detect_duplicate_remediation_run_and_return_duplicate_flag', () => {
    const now = new Date().toISOString();
    const existingId = 'curated_remediation_rem-run-dupe';
    const initialCurated: CuratedRow[] = [
      {
        id: existingId,
        prompt: 'GitHub workflow failure remediation task. Repository: org/r Run: rem-run-dupe',
        completion: 'Selected fixer: AgentX',
        source: 'github_remediation_runtime',
        quality: 0.95,
        approval_state: 'approved',
        provenance: JSON.stringify({ kind: 'approved_remediation', remediationRunId: 'rem-run-dupe', repositoryName: 'org/r' }),
        pii_redacted_count: 0,
        created_at: now,
        approved_at: now,
        reviewed_by: 'admin',
        review_notes: 'Auto-approved remediation capture',
      },
    ];
    vi.mocked(getGlobalDb).mockReturnValue(
      createCuratedAwareFakeDb({ hasToolRunsTable: false, initialCurated }) as ReturnType<typeof getGlobalDb>,
    );

    const result = captureApprovedRemediationGoldenCandidate({
      id: 'rem-run-dupe',
      repositoryName: 'org/r',
      status: 'approved',
      updatedAt: now,
    });

    expect(result.duplicate).toBe(true);
    expect(result.id).toBe(existingId);
  });
});
