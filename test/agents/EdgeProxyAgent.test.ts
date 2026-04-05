import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EdgeProxyAgent } from '../../src/agents/EdgeProxyAgent.js';

// Mock DB instance structure using vi.hoisted to ensure availability in vi.mock
const { mockDb, mockExec, mockTransaction, mockAll, mockRun, mockPrepare } = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  const mockPrepare = vi.fn(() => ({
    run: mockRun,
    get: mockGet,
    all: mockAll,
  }));
  const mockExec = vi.fn();
  // Transaction mock: returns a function that executes the callback immediately
  const mockTransaction = vi.fn((fn) => (...args: any[]) => fn(...args));

  const mockDb = {
    prepare: mockPrepare,
    exec: mockExec,
    transaction: mockTransaction,
    pragma: vi.fn(),
    close: vi.fn(),
  };
  return { mockDb, mockExec, mockTransaction, mockAll, mockRun, mockPrepare };
});

// Mock globalDb to return our mockDb
vi.mock('../../src/utils/globalDb.js', () => ({
  getGlobalDb: () => mockDb,
  closeGlobalDb: vi.fn(),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

// Mock better-sqlite3 constructor
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockReturnValue(mockDb),
  };
});

describe('EdgeProxyAgent', () => {
  let agent: EdgeProxyAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset transaction implementation
    mockTransaction.mockImplementation((fn) => (...args: any[]) => fn(...args));

    // Mock fetch
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    agent = new EdgeProxyAgent({
      workerUrl: 'https://test-worker.dev',
      healthCheckInterval: 0
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize and create edge_tasks table', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tunnel: 'connected' })
    } as Response);

    await agent.initialize();

    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS edge_tasks'));
  });

  it('should sync with edge and update local db', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tunnel: 'connected' })
    } as Response);

    await agent.initialize();

    const mockHistory = [
      {
        taskId: 'task-1',
        type: 'test',
        status: 'completed',
        payload: { instruction: 'test1' },
        result: { output: 'ok' },
        createdAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z'
      },
      {
        taskId: 'task-2',
        type: 'test',
        status: 'pending',
        payload: { instruction: 'test2' },
        createdAt: '2023-01-01T00:02:00Z'
      }
    ];

    // Mocks for fetch sequence
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tunnel: 'connected' }) } as Response) // Health check inside sync
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: mockHistory }) } as Response) // /history
      .mockResolvedValueOnce({ // Status check for task-2
        ok: true,
        json: async () => ({
           ...mockHistory[1],
           status: 'completed',
           result: { output: 'done' },
           completedAt: '2023-01-01T00:03:00Z'
        })
      } as Response);

    // Mock DB behavior for pending check
    // We expect a SELECT for pending tasks.
    // We can filter calls based on SQL or just return mocked data for the sequence of calls.
    // Sequence:
    // 1. exec(create table) - from initialize
    // 2. prepare(INSERT) - inside syncWithEdge
    // 3. transaction execution - inside syncWithEdge
    // 4. prepare(SELECT pending) - inside syncWithEdge
    // 5. run(INSERT/UPDATE) - for task-2 update

    // We need mockAll to return [{taskId: 'task-2'}] when called for pending tasks.
    // And empty or whatever for other calls (though explicitly only used for pending check in code).

    mockAll.mockReturnValueOnce([{ task_id: 'task-2' }]);

    // Call sync
    const result = await agent.executeTask({ task: 'sync', context: {} });

    expect(result.success).toBe(true);

    // Verify inserts/updates
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO edge_tasks'));

    // run should be called:
    // 2 times inside transaction (initial history)
    // 1 time for pending update
    expect(mockRun).toHaveBeenCalledTimes(3);

    // Verify the update for task-2 (positional args: status, result, completedAt, task_id)
    expect(mockRun).toHaveBeenCalledWith(
      'completed',
      expect.any(String), // JSON.stringify(result)
      expect.any(String), // completedAt
      'task-2'
    );
  });
});
