import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export interface BookkeepingStatusSnapshot {
  summary: Record<string, any>;
  exceptions: any[];
  timestamp: string;
  updatedAt: string;
  source: 'dashboard' | 'api' | 'n8n';
}

const DEFAULT_SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'bookkeeping_status.json');

function getSnapshotPath(): string {
  return process.env.BOOKKEEPING_STATUS_PATH ?? DEFAULT_SNAPSHOT_FILE;
}

export async function readBookkeepingStatusSnapshot(): Promise<BookkeepingStatusSnapshot | null> {
  const file = getSnapshotPath();
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export async function writeBookkeepingStatusSnapshot(snapshot: BookkeepingStatusSnapshot): Promise<void> {
  const file = getSnapshotPath();
  try {
    writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write bookkeeping snapshot:', e);
  }
}

export function createBookkeepingStatusSnapshotRoutes(): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    const snapshot = await readBookkeepingStatusSnapshot();
    res.json({ success: true, snapshot });
  });
  return router;
}

export default createBookkeepingStatusSnapshotRoutes;
