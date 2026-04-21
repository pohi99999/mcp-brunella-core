import { execFile } from 'child_process';
import { mkdir, mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { getStudioConfig } from '../../src/config/studioConfig.js';
import { studioFullPipeline } from '../../src/cli/studioRuntime.js';
import { probeFfmpegRuntime } from '../../src/tools/ffmpegTool.js';

function execFileAsync(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createFixtureMedia(inputDir: string, ffmpeg: string): Promise<{ musicTrackPath: string }> {
  const clips = [
    { color: 'red', name: 'opening-look.mp4' },
    { color: 'blue', name: 'detail-texture.mp4' },
    { color: 'green', name: 'utolso-end.mp4' },
  ];

  for (const clip of clips) {
    await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', `color=c=${clip.color}:s=1280x720:d=2`, '-vf', 'format=yuv420p', '-c:v', 'libx264', path.join(inputDir, clip.name)]);
  }

  const musicTrackPath = path.join(inputDir, 'music.mp3');
  await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-c:a', 'libmp3lame', musicTrackPath]);
  return { musicTrackPath };
}

describe('Brunella Studio e2e', () => {
  it('runs the full baseline pipeline on synthetic media', { timeout: 120000 }, async () => {
    const runtime = await probeFfmpegRuntime();
    if (!runtime.ffmpegAvailable || !runtime.ffprobeAvailable) {
      return;
    }

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-e2e-'));
    const inputDir = path.join(tempRoot, 'input');
    const ffmpeg = getStudioConfig().ffmpegPath;

    try {
      await mkdir(inputDir, { recursive: true });
      const { musicTrackPath } = await createFixtureMedia(inputDir, ffmpeg);
      const result = await studioFullPipeline({
        inputDir,
        projectName: 'studio-e2e',
        style: 'elegant',
        musicTrackPath,
        presets: ['master-16x9'],
      });

      expect(result.report.assets.length).toBeGreaterThanOrEqual(3);
      expect(result.report.timelinePlan?.timeline.length).toBeGreaterThan(0);
      expect(result.report.audioPlan?.ducking.length).toBeGreaterThanOrEqual(0);
      expect(result.report.renderJobs.length).toBe(1);
      expect(result.report.qcReports[0]?.passed).toBe(true);
      await stat(result.report.renderJobs[0].outputPath);
      await stat(result.reportPath);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
