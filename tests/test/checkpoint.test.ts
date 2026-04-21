import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before any imports that use it
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn()
}));

// Hoisted mocks for better-sqlite3 (vi.mock is hoisted above const declarations)
const { mockRun, mockGet, mockAll, mockPrepare, mockExec, mockPragma, mockClose } = vi.hoisted(() => {
  const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 });
  const mockGet = vi.fn();
  const mockAll = vi.fn().mockReturnValue([]);
  const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  const mockExec = vi.fn();
  const mockPragma = vi.fn();
  const mockClose = vi.fn();
  return { mockRun, mockGet, mockAll, mockPrepare, mockExec, mockPragma, mockClose };
});

vi.mock('better-sqlite3', () => {
  return {
    default: class MockDatabase {
      prepare = mockPrepare;
      exec = mockExec;
      pragma = mockPragma;
      close = mockClose;
    }
  };
});

import {
  saveCheckpoint,
  loadCheckpoint,
  loadAllCheckpoints,
  clearCheckpoints,
  listActiveCheckpoints,
  getCheckpointStats
} from '../src/core/checkpoint.js';

describe('Checkpoint System (G2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ lastInsertRowid: 42, changes: 1 });
    // Re-set prepare to return statement mocks (clearAllMocks clears call history only)
    mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  });

  describe('saveCheckpoint', () => {
    it('should save a checkpoint and return row id', async () => {
      const id = await saveCheckpoint('task-1', 2, 'step-parse', { parsed: true });
      expect(id).toBe(42);
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO checkpoints')
      );
    });

    it('should serialize state to JSON', async () => {
      await saveCheckpoint('task-2', 0, 'init', { config: { retries: 3 } });
      expect(mockRun).toHaveBeenCalledWith(
        'task-2',
        0,
        'init',
        JSON.stringify({ config: { retries: 3 } })
      );
    });
  });

  describe('loadCheckpoint', () => {
    it('should return latest checkpoint for task', async () => {
      mockGet.mockReturnValue({
        id: 10,
        task_id: 'task-1',
        step_index: 3,
        step_name: 'compile',
        state_json: '{"compiled":true}',
        created_at: '2026-01-01T00:00:00Z'
      });

      const cp = await loadCheckpoint('task-1');
      expect(cp).not.toBeNull();
      expect(cp!.taskId).toBe('task-1');
      expect(cp!.stepIndex).toBe(3);
      expect(cp!.stepName).toBe('compile');
    });

    it('should return null for nonexistent task', async () => {
      mockGet.mockReturnValue(undefined);

      const cp = await loadCheckpoint('nonexistent');
      expect(cp).toBeNull();
    });
  });

  describe('clearCheckpoints', () => {
    it('should delete all checkpoints for a task', async () => {
      const result = await clearCheckpoints('task-1');
      expect(result).toBe(true);
      expect(mockRun).toHaveBeenCalledWith('task-1');
    });
  });

  describe('loadAllCheckpoints', () => {
    it('should return all checkpoints ordered by step', async () => {
      mockAll.mockReturnValue([
        { id: 1, task_id: 'task-1', step_index: 0, step_name: 'init', state_json: '{}', created_at: '' },
        { id: 2, task_id: 'task-1', step_index: 1, step_name: 'parse', state_json: '{}', created_at: '' }
      ]);

      const cps = await loadAllCheckpoints('task-1');
      expect(cps).toHaveLength(2);
      expect(cps[0].stepIndex).toBe(0);
      expect(cps[1].stepIndex).toBe(1);
    });
  });

  describe('getCheckpointStats', () => {
    it('should return stats', async () => {
      mockGet
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 2 });

      const stats = await getCheckpointStats();
      expect(stats.totalCheckpoints).toBe(5);
      expect(stats.activeTasks).toBe(2);
    });
  });
});
