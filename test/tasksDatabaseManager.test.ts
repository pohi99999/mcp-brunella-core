import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TasksDatabaseManager } from '../src/utils/tasksDb.js';

describe('TasksDatabaseManager', () => {
  it('opens once, initializes schema, and reopens after close', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tasks-database-manager-'));
    const manager = new TasksDatabaseManager(path.join(tempDir, 'tasks.db'));

    try {
      const firstDb = await manager.getDb();
      expect(firstDb).not.toBeNull();

      const secondDb = await manager.getDb();
      expect(secondDb).toBe(firstDb);

      await manager.saveTask({ agent: 'agent-1', task: 'do something', context: 'ctx' });
      const rows = await manager.loadQueuedTasksForHydration();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({ agent: 'agent-1', task: 'do something', status: 'pending' }));

      manager.close();

      const reopenedDb = await manager.getDb();
      expect(reopenedDb).not.toBeNull();
      expect(reopenedDb).not.toBe(firstDb);

      const count = await manager.getTaskCount();
      expect(count).toBe(1);
    } finally {
      manager.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
