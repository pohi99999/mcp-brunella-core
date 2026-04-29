import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import { registerStudioCommands } from '@apps/mcp-core/studioCommands.js';

function createReport() {
  return {
    pipelineId: 'pipeline-cli-1',
    projectName: 'vv-cli-review',
    createdAt: new Date().toISOString(),
    status: 'completed',
    inputDir: 'F:\\media\\vv-cli-review',
    outputDir: 'out/studio/vv-cli-review',
    assets: [],
    renderJobs: [
      {
        id: 'render-master',
        preset: {
          name: 'master-16x9',
          label: '16:9 Master Promo',
          width: 1920,
          height: 1080,
          fps: 25,
          videoCodec: 'libx264',
          audioCodec: 'aac',
          videoBitrate: '16M',
          audioBitrate: '320k',
          container: 'mp4',
          description: 'master',
        },
        timelineName: 'vv-cli-review-master',
        outputPath: 'out/studio/vv-cli-review/vv-cli-review-master.mp4',
        expectedDurationSec: 12,
        status: 'completed',
        resolveOperations: [],
        notes: [],
      },
    ],
    qcReports: [
      {
        filePath: 'out/studio/vv-cli-review/vv-cli-review-master.mp4',
        checkedAt: new Date().toISOString(),
        passed: true,
        issues: [],
        stats: {},
      },
    ],
    warnings: [],
    notes: [],
    timelinePlan: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      style: 'elegant',
      targetDurationSec: 12,
      inputSummary: { clipCount: 1, totalDurationSec: 12 },
      segments: [],
      timeline: [],
      markers: [],
      warnings: [],
      notes: [],
    },
  };
}

describe('studio review command', () => {
  it('prints a review result for the provided pipeline report path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-review-cli-'));
    const reportPath = path.join(tempRoot, 'pipeline-report.json');
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as never);

    try {
      await writeFile(reportPath, JSON.stringify(createReport(), null, 2), 'utf-8');

      const program = new Command();
      registerStudioCommands(program);
      await program.parseAsync(['studio', 'review', '--report-path', reportPath], { from: 'user' });

      const output = writes.join('');
      const normalizedOutput = output.replace(/\\\\/g, '\\');
      expect(normalizedOutput).toContain('Studio review');
      expect(normalizedOutput).toContain('approved');
      expect(normalizedOutput).toContain(reportPath);
    } finally {
      writeSpy.mockRestore();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('prints callback delivery details when a callback URL is provided', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-review-cli-callback-'));
    const reportPath = path.join(tempRoot, 'pipeline-report.json');
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(reportPath, JSON.stringify(createReport(), null, 2), 'utf-8');

      const program = new Command();
      registerStudioCommands(program);
      await program.parseAsync(['studio', 'review', '--report-path', reportPath, '--callback-url', 'https://example.com/webhooks/studio-review'], { from: 'user' });

      const output = writes.join('');
      const normalizedOutput = output.replace(/\\\\/g, '\\');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(normalizedOutput).toContain('callbackDelivery');
      expect(normalizedOutput).toContain('https://example.com/webhooks/studio-review');
      expect(normalizedOutput).toContain('202');
    } finally {
      vi.unstubAllGlobals();
      writeSpy.mockRestore();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
