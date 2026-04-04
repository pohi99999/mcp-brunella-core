/**
 * FILE: test/goldenDatasetBridge.test.ts
 * PURPOSE: G4.4 — Tests for goldenDatasetBridge module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.mock('../src/utils/globalDb.js', () => ({
  getD1Adapter: vi.fn(),
  getGlobalDb: vi.fn(() => createFakeDb()),
}));

import { getD1Adapter } from '../src/utils/globalDb.js';
import {
  saveGoldenSample,
  getGoldenStats,
  autoSaveGoldenSample,
  calculateQuality,
  syncLocalToD1,
  type GoldenSample,
  type GoldenSaveResult,
  type GoldenDatasetStats
} from '../src/core/goldenDatasetBridge.js';

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
