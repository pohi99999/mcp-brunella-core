import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackHookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/core/hookRegistry.js', () => ({
  fireHook: trackHookHarness.fireHook,
  fireHookSafely: trackHookHarness.fireHook,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: trackHookHarness.logInfo,
  logWarn: trackHookHarness.logWarn,
  logError: trackHookHarness.logError,
}));

describe('TrackStateManager hook integration', () => {
  let previousCwd: string;
  let tempDir: string;

  beforeEach(() => {
    previousCwd = process.cwd();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'track-hooks-'));
    process.chdir(tempDir);
    trackHookHarness.fireHook.mockClear();
    vi.resetModules();

    mkdirSync(path.join(tempDir, 'conductor', 'tracks', 'track-1'), { recursive: true });
    writeFileSync(path.join(tempDir, 'conductor', 'project_state.json'), JSON.stringify({
      lastUpdated: '2026-04-09T00:00:00.000Z',
      tracks: [
        {
          id: 'track-1',
          name: 'Track One',
          status: 'active',
          priority: 'high',
          progress: 80,
          group: 'brunella',
        },
      ],
      stats: { total: 1, active: 1, completed: 0, archived: 0, proposed: 0 },
    }, null, 2));
    writeFileSync(path.join(tempDir, 'conductor', 'tracks', 'track-1', 'meta.json'), JSON.stringify({
      id: 'track-1',
      name: 'Track One',
      status: 'completed',
      priority: 'high',
      progress: 100,
      completed: '2026-04-09T08:00:00.000Z',
      group: 'brunella',
    }, null, 2));
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('emits status change and completion hooks when a track completes', async () => {
    const { TrackStateManager } = await import('../src/services/trackStateManager.js');

    const manager = new TrackStateManager();
    await manager.fullSync();

    expect(trackHookHarness.fireHook).toHaveBeenCalledWith(
      'track:status:changed',
      expect.objectContaining({
        trackId: 'track-1',
        previousStatus: 'active',
        status: 'completed',
      }),
      expect.anything(),
    );
    expect(trackHookHarness.fireHook).toHaveBeenCalledWith(
      'track:completed',
      expect.objectContaining({
        trackId: 'track-1',
      }),
      expect.anything(),
    );
  });
});
