// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Setup test DB
const testDb = new Database(':memory:');
// @ts-ignore
globalThis.testDb = testDb;

// Mock globalDb
vi.mock('../src/utils/globalDb.js', () => ({
  // @ts-ignore
  getGlobalDb: () => globalThis.testDb
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn()
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

import { EdgeProxyAgent } from '../src/agents/EdgeProxyAgent.js';

describe('EdgeProxyAgent Sync', () => {
  let agent: EdgeProxyAgent;

  beforeEach(() => {
    // Setup DB schema
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS edge_tasks (
        task_id TEXT PRIMARY KEY,
        type TEXT,
        status TEXT,
        payload TEXT,
        result TEXT,
        created_at TEXT,
        completed_at TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
      );
    `);

    agent = new EdgeProxyAgent({
      workerUrl: 'https://test-worker.dev',
      healthCheckInterval: 0
    });

    fetchMock.mockReset();
  });

  afterEach(() => {
    testDb.exec('DROP TABLE IF EXISTS edge_tasks');
  });

  it('should sync history and update DB', async () => {
    // Mock health check response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tunnel: 'connected' })
    });

    // Mock history response
    const mockTasks = [
      { taskId: 'task-1', status: 'completed', result: { foo: 'bar' } },
      { taskId: 'task-2', status: 'pending' }
    ];

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: mockTasks })
    });

    // Call sync indirectly via executeTask
    const result = await agent.executeTask({ task: 'sync' });

    expect(result.success).toBe(true);
    // history fetch returns 2 items
    expect(result.data.stats.syncedCount).toBe(2);

    const row = testDb.prepare('SELECT * FROM edge_tasks WHERE task_id = ?').get('task-1') as any;
    expect(row).toBeDefined();
    expect(row.status).toBe('completed');
    expect(JSON.parse(row.result)).toEqual({ foo: 'bar' });
  });

  it('should update pending tasks', async () => {
    // Insert a pending task
    testDb.prepare(`
      INSERT INTO edge_tasks (task_id, status) VALUES ('task-pending', 'pending')
    `).run();

    // Mock health check
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tunnel: 'connected' })
    });

    // Mock history response (empty)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [] })
    });

    // Mock status check for 'task-pending'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: 'task-pending', status: 'completed', result: { done: true } })
    });

    const result = await agent.executeTask({ task: 'sync' });

    expect(result.success).toBe(true);
    expect(result.data.stats.updatedCount).toBe(1);

    const row = testDb.prepare('SELECT * FROM edge_tasks WHERE task_id = ?').get('task-pending') as any;
    expect(row.status).toBe('completed');
    expect(JSON.parse(row.result)).toEqual({ done: true });
  });
});
