import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackHookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHook: trackHookHarness.fireHook,
  fireHookSafely: trackHookHarness.fireHook,
}));

vi.mock('@packages/utils/logger.js', () => ({
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
    const { TrackStateManager } = await import('@packages/core-logic/trackStateManager.js');

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

  it('normalizes missing dod checklist values when syncing meta.json', async () => {
    const { TrackStateManager } = await import('@packages/core-logic/trackStateManager.js');

    const manager = new TrackStateManager();
    await manager.fullSync();

    const state = JSON.parse(
      readFileSync(path.join(tempDir, 'conductor', 'project_state.json'), 'utf-8'),
    ) as { tracks: Array<{ id: string; dod: Record<string, boolean> }> };

    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0]).toMatchObject({
      id: 'track-1',
      dod: {
        tests_pass: false,
        build_clean: false,
        code_committed: false,
        no_verify_used: false,
      },
    });
  });

  it('counts paused tracks as open work and renders them in tracks.md', async () => {
    mkdirSync(path.join(tempDir, 'conductor', 'tracks', 'track-paused'), { recursive: true });
    writeFileSync(path.join(tempDir, 'conductor', 'tracks', 'track-paused', 'meta.json'), JSON.stringify({
      id: 'track-paused',
      name: 'Paused Track',
      status: 'paused',
      priority: 'medium',
      progress: 60,
      group: 'brunella',
      updated: '2026-04-09T12:00:00.000Z',
    }, null, 2));

    const { TrackStateManager } = await import('@packages/core-logic/trackStateManager.js');

    const manager = new TrackStateManager();
    await manager.fullSync();

    const state = JSON.parse(
      readFileSync(path.join(tempDir, 'conductor', 'project_state.json'), 'utf-8'),
    ) as {
      stats: { total: number; active: number; completed: number; archived: number; proposed: number };
      tracks: Array<{ id: string; status: string }>;
    };

    expect(state.stats.total).toBe(2);
    expect(state.stats.active).toBe(1);
    expect(state.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'track-paused', status: 'paused' }),
      ]),
    );

    const tracksMd = readFileSync(path.join(tempDir, 'conductor', 'tracks.md'), 'utf-8');
    expect(tracksMd).toContain('**Paused Track** (paused)');
    expect(tracksMd).toContain('**Stats:** 2 total | 1 active | 1 completed | 0 archived');
  });
});
