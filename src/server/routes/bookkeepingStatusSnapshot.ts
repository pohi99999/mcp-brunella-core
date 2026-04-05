import path from 'path';
import { promises as fs } from 'fs';

export interface BookkeepingStatusSnapshot {
  summary: Record<string, unknown>;
  exceptions: Record<string, unknown>[];
  timestamp: string;
  updatedAt: string;
  source: 'api' | 'n8n' | 'dashboard';
}

function getSnapshotPath(): string {
  return process.env.BOOKKEEPING_STATUS_PATH || path.join(process.cwd(), 'data', 'bookkeeping', 'status.json');
}

export function getBookkeepingStatusSnapshotPath(): string {
  return getSnapshotPath();
}

export async function readBookkeepingStatusSnapshot(): Promise<BookkeepingStatusSnapshot | null> {
  try {
    const text = await fs.readFile(getSnapshotPath(), 'utf-8');
    return JSON.parse(text) as BookkeepingStatusSnapshot;
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && String((error as { code?: unknown }).code) === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeBookkeepingStatusSnapshot(snapshot: BookkeepingStatusSnapshot): Promise<void> {
  const snapshotPath = getSnapshotPath();
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
}
