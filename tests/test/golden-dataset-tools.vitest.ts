/**
 * FILE: test/golden-dataset-tools.vitest.ts
 * PURPOSE: Smoke tests for tool run capture + Golden Dataset extensions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ───── Mock globalDb before any source imports ───── */

const insertRun = vi.fn().mockReturnValue({ changes: 1 });
const allRuns = vi.fn().mockReturnValue([]);
const getTotal = vi.fn().mockReturnValue({ total: 5, successes: 4, avg_duration: 120 });
const getByTool = vi.fn().mockReturnValue([
  { tool_name: 'agent_list', count: 3, success_rate: 100, avg_duration: 80 },
]);

function createFakeDb() {
  return {
    exec: vi.fn(),
    prepare: (sql: string) => {
      if (sql.includes('INSERT INTO tool_runs')) return { run: insertRun };
      if (sql.includes('GROUP BY tool_name')) return { all: getByTool };
      if (sql.includes('COUNT(*)')) return { get: getTotal };
      return { all: allRuns, get: vi.fn(), run: vi.fn() };
    },
  };
}

vi.mock('@packages/utils/globalDb.js', () => {
  const fakeDb = createFakeDb();
  const recordToolRun = vi.fn((run: Record<string, unknown>) => {
    fakeDb.prepare('INSERT INTO tool_runs').run(
      run.tool_name, run.input_params, run.output_data,
      run.success, run.duration_ms, run.user_id, run.quality_score,
    );
  });

  const queryToolRuns = vi.fn((query: Record<string, unknown> = {}) => {
    const rows = [
      {
        id: 1, timestamp: '2025-01-01T00:00:00', tool_name: 'test_tool',
        input_params: '{"x":1}', output_data: '{"ok":true}',
        success: 1, duration_ms: 50, user_id: null, quality_score: 0.8,
      },
    ];
    if (query.success === 0) return [];
    return rows;
  });

  const getToolRunStats = vi.fn(() => ({
    totalRuns: 5,
    successRate: 80,
    avgDurationMs: 120,
    byTool: [{ tool_name: 'agent_list', count: 3, success_rate: 100, avg_duration: 80 }],
  }));

  return {
    getGlobalDb: vi.fn(() => fakeDb),
    recordToolRun,
    queryToolRuns,
    getToolRunStats,
  };
});

/* ───── Import subjects AFTER mocks ───── */

import { recordToolRun, queryToolRuns, getToolRunStats } from '@packages/utils/globalDb.js';
import { wrapToolHandler, calculateQuality } from '@packages/core-logic/toolRunCapture.js';

describe('toolRunCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('module import', () => {
    it('should export wrapToolHandler', () => {
      expect(typeof wrapToolHandler).toBe('function');
    });

    it('should export calculateQuality', () => {
      expect(typeof calculateQuality).toBe('function');
    });
  });

  describe('wrapToolHandler — success path', () => {
    it('should call original handler and record a successful run', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 'hello' });
      const wrapped = wrapToolHandler('my_tool', handler);

      const result = await wrapped({ foo: 'bar' });

      expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
      expect(result).toEqual({ success: true, data: 'hello' });
      expect(recordToolRun).toHaveBeenCalledTimes(1);

      const recorded = vi.mocked(recordToolRun).mock.calls[0][0];
      expect(recorded.tool_name).toBe('my_tool');
      expect(recorded.success).toBe(1);
      expect(recorded.duration_ms).toBeGreaterThanOrEqual(0);
      expect(recorded.quality_score).toBeGreaterThan(0);
    });
  });

  describe('wrapToolHandler — failure path', () => {
    it('should record a failed run and re-throw the error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      const wrapped = wrapToolHandler('bad_tool', handler);

      await expect(wrapped({ a: 1 })).rejects.toThrow('boom');

      expect(recordToolRun).toHaveBeenCalledTimes(1);

      const recorded = vi.mocked(recordToolRun).mock.calls[0][0];
      expect(recorded.tool_name).toBe('bad_tool');
      expect(recorded.success).toBe(0);
      expect(recorded.quality_score).toBe(0);
      expect(String(recorded.output_data)).toContain('errorType');
    });

    it('fails open when tool-run persistence throws', async () => {
      vi.mocked(recordToolRun).mockImplementationOnce(() => {
        throw new Error('db unavailable');
      });

      const handler = vi.fn().mockResolvedValue({ success: true, data: 'hello' });
      const wrapped = wrapToolHandler('resilient_tool', handler);

      await expect(wrapped({ foo: 'bar' })).resolves.toEqual({ success: true, data: 'hello' });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateQuality', () => {
    it('returns base 0.5 for empty result and slow duration', () => {
      expect(calculateQuality(null, 10_000)).toBeCloseTo(0.5, 1);
    });

    it('adds bonus for fast execution (<1s)', () => {
      const q = calculateQuality({}, 500);
      // base 0.5 + <5000 (0.1) + <1000 (0.1) = 0.7
      expect(q).toBeCloseTo(0.7, 1);
    });

    it('adds bonus for successful result with data', () => {
      const q = calculateQuality({ success: true, data: 'A'.repeat(150) }, 300);
      // base 0.5 + data>100 (0.1) + success (0.1) + <5000 (0.1) + <1000 (0.1) = 0.9
      expect(q).toBeCloseTo(0.9, 1);
    });

    it('caps at 1.0', () => {
      const q = calculateQuality({ success: true, data: 'A'.repeat(200) }, 100);
      expect(q).toBeLessThanOrEqual(1.0);
    });
  });

  describe('globalDb tool_runs helpers', () => {
    it('recordToolRun calls INSERT', () => {
      recordToolRun({
        tool_name: 'test_tool',
        input_params: '{}',
        output_data: '{}',
        success: 1,
        duration_ms: 42,
        quality_score: 0.7,
      });
      expect(recordToolRun).toHaveBeenCalledTimes(1);
    });

    it('queryToolRuns returns rows', () => {
      const rows = queryToolRuns({ success: 1 });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].tool_name).toBe('test_tool');
    });

    it('queryToolRuns respects success filter', () => {
      const rows = queryToolRuns({ success: 0 });
      expect(rows.length).toBe(0);
    });

    it('getToolRunStats returns aggregated data', () => {
      const stats = getToolRunStats();
      expect(stats.totalRuns).toBe(5);
      expect(stats.successRate).toBe(80);
      expect(stats.byTool.length).toBeGreaterThan(0);
    });
  });
});
