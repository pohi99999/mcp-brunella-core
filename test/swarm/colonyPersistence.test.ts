/**
 * Colony Persistence Tests — Track #5 Phase 1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock globalDb before imports
const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 1, changes: 0 });
const mockGet = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
const mockExec = vi.fn();
const mockPragma = vi.fn();

vi.mock('../../src/utils/globalDb.js', () => ({
  getGlobalDb: () => ({
    exec: mockExec,
    prepare: mockPrepare,
    pragma: mockPragma,
  }),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import {
  saveCheckpoint,
  restoreCheckpoint,
  listCheckpoints,
  pruneCheckpoints,
  parseSnapshot,
  getCheckpointStats,
  type ColonyCheckpoint,
  type ColonySnapshotData,
} from '../../src/core/swarm/colonyPersistence.js';

// Helper: create a mock colony
function createMockColony() {
  const agentMap = new Map();
  agentMap.set('agent-1', {
    agentId: 'agent-1',
    role: 'leader',
    capabilities: ['code', 'review'],
    getStats: () => ({ completed: 5, failed: 1, active: 0, successRate: 0.83 }),
  });
  agentMap.set('agent-2', {
    agentId: 'agent-2',
    role: 'worker',
    capabilities: ['test'],
    getStats: () => ({ completed: 3, failed: 0, active: 1, successRate: 1.0 }),
  });

  return {
    swarmId: 'colony-test-1',
    name: 'Test Colony',
    objective: 'Unit test tasks',
    agents: agentMap,
    leaderId: 'agent-1',
    status: 'active' as const,
    createdAt: Date.now(),
    metrics: {
      tasksCompleted: 8,
      tasksFailed: 1,
      avgDurationMs: 1500,
      throughput: 2.5,
      lastActivity: Date.now(),
    },
  };
}

describe('Colony Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveCheckpoint', () => {
    it('saves colony state to SQLite', () => {
      const colony = createMockColony();
      const id = saveCheckpoint(colony);

      expect(id).toBe(1);
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(
        'colony-test-1',
        'Test Colony',
        'active',
        expect.stringContaining('agent-1'),
        null,
        null,
        8,
      );
    });

    it('includes shared knowledge and task queue when provided', () => {
      const colony = createMockColony();
      saveCheckpoint(colony, { key: 'value' }, ['task1', 'task2']);

      expect(mockRun).toHaveBeenCalledWith(
        'colony-test-1',
        'Test Colony',
        'active',
        expect.any(String),
        '{"key":"value"}',
        '["task1","task2"]',
        8,
      );
    });

    it('maps "forming" status to "active"', () => {
      const colony = createMockColony();
      (colony as Record<string, unknown>).status = 'forming';
      saveCheckpoint(colony);

      expect(mockRun).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'active',
        expect.any(String),
        null,
        null,
        expect.any(Number),
      );
    });
  });

  describe('restoreCheckpoint', () => {
    it('returns latest checkpoint', () => {
      const checkpoint: ColonyCheckpoint = {
        id: 42,
        colonyId: 'colony-test-1',
        colonyName: 'Test Colony',
        state: 'active',
        agentsJson: '{"agents":[],"leaderId":null,"metrics":{},"objective":"test"}',
        sharedKnowledgeJson: null,
        taskQueueJson: null,
        completedTasks: 10,
        createdAt: '2026-03-23T00:00:00',
      };
      mockGet.mockReturnValueOnce(checkpoint);

      const result = restoreCheckpoint('colony-test-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(42);
      expect(result!.completedTasks).toBe(10);
    });

    it('returns null when no checkpoint exists', () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(restoreCheckpoint('nonexistent')).toBeNull();
    });
  });

  describe('listCheckpoints', () => {
    it('returns checkpoints ordered by date', () => {
      mockAll.mockReturnValueOnce([
        { id: 3, colonyId: 'c1', completedTasks: 15 },
        { id: 2, colonyId: 'c1', completedTasks: 10 },
      ]);

      const list = listCheckpoints('c1', 5);
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(3);
    });
  });

  describe('pruneCheckpoints', () => {
    it('calls DELETE with correct parameters', () => {
      mockRun.mockReturnValueOnce({ changes: 3 });
      const deleted = pruneCheckpoints('colony-1', 5);
      expect(deleted).toBe(3);
    });
  });

  describe('parseSnapshot', () => {
    it('parses valid JSON snapshot', () => {
      const data: ColonySnapshotData = {
        agents: [{ agentId: 'a1', role: 'leader', capabilities: ['code'], stats: { completed: 1, failed: 0, active: 0, successRate: 1 } }],
        leaderId: 'a1',
        metrics: { tasksCompleted: 1, tasksFailed: 0, avgDurationMs: 100, throughput: 1, lastActivity: 0 },
        objective: 'test',
      };

      const checkpoint: ColonyCheckpoint = {
        id: 1,
        colonyId: 'c1',
        colonyName: 'Test',
        state: 'active',
        agentsJson: JSON.stringify(data),
        sharedKnowledgeJson: null,
        taskQueueJson: null,
        completedTasks: 1,
        createdAt: '2026-01-01',
      };

      const result = parseSnapshot(checkpoint);
      expect(result).not.toBeNull();
      expect(result!.agents).toHaveLength(1);
      expect(result!.leaderId).toBe('a1');
    });

    it('returns null for invalid JSON', () => {
      const checkpoint: ColonyCheckpoint = {
        id: 1, colonyId: 'c1', colonyName: 'X', state: 'active',
        agentsJson: '{INVALID', sharedKnowledgeJson: null, taskQueueJson: null,
        completedTasks: 0, createdAt: '',
      };
      expect(parseSnapshot(checkpoint)).toBeNull();
    });
  });

  describe('getCheckpointStats', () => {
    it('returns aggregated stats', () => {
      mockGet.mockReturnValueOnce({ total: 15, colonies: 3, latest: '2026-03-23T01:00:00' });

      const stats = getCheckpointStats();
      expect(stats.totalCheckpoints).toBe(15);
      expect(stats.colonies).toBe(3);
      expect(stats.latestAt).toBe('2026-03-23T01:00:00');
    });
  });
});
