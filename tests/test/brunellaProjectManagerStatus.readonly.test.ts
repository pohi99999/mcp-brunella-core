import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => {
      throw new Error('missing FOSZAL');
    }),
  },
}));

vi.mock('@packages/utils/rag.js', () => ({
  searchRAG: vi.fn(async () => []),
}));

import { trackStateManager } from '@packages/core-logic/trackStateManager.js';
import { buildBrunellaProjectManagerSnapshot } from '@packages/core-logic/brunellaProjectManagerStatus.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('brunellaProjectManagerStatus read-only snapshot', () => {
  it('reads track state without triggering a sync', async () => {
    vi.spyOn(trackStateManager, 'fullSync');
    vi.spyOn(trackStateManager, 'getState').mockReturnValue({
      lastUpdated: '2026-04-08T22:00:00.000Z',
      tracks: [],
      stats: { total: 0, active: 0, completed: 0, archived: 0, proposed: 0 },
    });

    const snapshot = await buildBrunellaProjectManagerSnapshot({ limit: 1, ragLimit: 1 });

    expect(trackStateManager.fullSync).not.toHaveBeenCalled();
    expect(trackStateManager.getState).toHaveBeenCalledTimes(1);
    expect(snapshot.trackSnapshot.success).toBe(true);
  });
});
