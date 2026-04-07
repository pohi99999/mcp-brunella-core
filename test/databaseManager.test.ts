import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DatabaseManager } from '../src/utils/db.js';

describe('DatabaseManager', () => {
  it('opens once, initializes tables, and reopens after close', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'database-manager-'));
    const manager = new DatabaseManager(path.join(tempDir, 'brunella.db'));

    try {
      const firstDb = await manager.getDb();
      expect(firstDb).not.toBeNull();

      const secondDb = await manager.getDb();
      expect(secondDb).toBe(firstDb);

      const table = firstDb!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='business_leads'").get();
      expect(table).toEqual(expect.objectContaining({ name: 'business_leads' }));

      manager.close();

      const reopenedDb = await manager.getDb();
      expect(reopenedDb).not.toBeNull();
      expect(reopenedDb).not.toBe(firstDb);

      const reopenedTable = reopenedDb!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='business_jobs'").get();
      expect(reopenedTable).toEqual(expect.objectContaining({ name: 'business_jobs' }));
    } finally {
      manager.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
