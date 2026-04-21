import { execFile } from 'child_process';
import { mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { getStudioConfig } from '../../src/config/studioConfig.js';
import { createMediaAssetFromProbe, ffmpegGenerateThumbnail, probeFfmpegRuntime } from '../../src/tools/ffmpegTool.js';

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

describe('ffmpegTool', () => {
  it('probes and analyzes a generated sample clip', async () => {
    const runtime = await probeFfmpegRuntime();
    if (!runtime.ffmpegAvailable || !runtime.ffprobeAvailable) {
      return;
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-ffmpeg-'));
    const clipPath = path.join(tempDir, 'sample.mp4');
    const thumbnailPath = path.join(tempDir, 'sample.jpg');
    const ffmpeg = getStudioConfig().ffmpegPath;

    try {
      await execFileAsync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1280x720:d=2', '-vf', 'format=yuv420p', '-c:v', 'libx264', clipPath]);
      const asset = await createMediaAssetFromProbe(clipPath);
      await ffmpegGenerateThumbnail(clipPath, thumbnailPath, 0.5);
      const thumbStat = await stat(thumbnailPath);

      expect(asset.type).toBe('video');
      expect(asset.width).toBe(1280);
      expect(asset.qualityScore).toBeGreaterThan(0);
      expect(thumbStat.size).toBeGreaterThan(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
