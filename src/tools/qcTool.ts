import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { type QcIssue, type QcReport } from '../schemas/studioSchemas.js';
import { writeJsonManifest } from '../services/studio/mediaBinOrganizer.js';
import { ffmpegBlackFrameSummary, ffmpegExtractAudioSummary, ffmpegVerifyOutput } from './ffmpegTool.js';

function ratioString(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  return `${width}:${height}`;
}

export async function runQcChecks(options: {
  filePath: string;
  expectedDurationSec?: number;
  expectedWidth?: number;
  expectedHeight?: number;
  outputPath?: string;
}): Promise<{ report: QcReport; outputPath: string }> {
  const verify = await ffmpegVerifyOutput(options.filePath, options.expectedDurationSec);
  const issues: QcIssue[] = [];

  if (!verify.hasVideo) {
    issues.push({ severity: 'error', code: 'missing-video', message: 'A render kimenet nem tartalmaz video streamet.' });
  }
  if (!verify.hasAudio) {
    issues.push({ severity: 'warning', code: 'missing-audio', message: 'A render kimenet nem tartalmaz audio streamet.' });
  }
  if (verify.durationSec <= 0.2) {
    issues.push({ severity: 'error', code: 'empty-timeline', message: 'A render idotartama gyakorlatilag nulla.' });
  }
  if ((verify.durationDeltaSec ?? 0) > 2) {
    issues.push({ severity: 'warning', code: 'unexpected-duration', message: 'A render hossza jelentosen elter a vart hossztol.', details: { durationDeltaSec: verify.durationDeltaSec } });
  }
  if (options.expectedWidth && options.expectedHeight && (verify.width !== options.expectedWidth || verify.height !== options.expectedHeight)) {
    issues.push({ severity: 'warning', code: 'aspect-ratio-mismatch', message: 'A kimeneti felbontas nem egyezik a preset elvarassal.', details: { actualWidth: verify.width, actualHeight: verify.height } });
  }

  const blackSummary = verify.hasVideo ? await ffmpegBlackFrameSummary(options.filePath) : { blackSegments: 0, raw: '' };
  if (blackSummary.blackSegments > 3) {
    issues.push({ severity: 'warning', code: 'black-frames', message: 'Tobb blackdetect szegmens jelent meg a renderben.', details: { blackSegments: blackSummary.blackSegments } });
  }

  const audioSummary = verify.hasAudio ? await ffmpegExtractAudioSummary(options.filePath) : { durationSec: verify.durationSec };
  if (typeof audioSummary.maxVolumeDb === 'number' && audioSummary.maxVolumeDb > -0.3) {
    issues.push({ severity: 'warning', code: 'audio-peak-risk', message: 'A max audio peak clipping kozeleben van.', details: { maxVolumeDb: audioSummary.maxVolumeDb } });
  }

  const report: QcReport = {
    filePath: options.filePath,
    checkedAt: new Date().toISOString(),
    passed: !issues.some((issue) => issue.severity === 'error'),
    durationSec: verify.durationSec,
    aspectRatio: ratioString(verify.width, verify.height),
    hasAudio: verify.hasAudio,
    hasVideo: verify.hasVideo,
    issues,
    stats: {
      width: verify.width,
      height: verify.height,
      blackSegments: blackSummary.blackSegments,
      maxVolumeDb: audioSummary.maxVolumeDb,
      meanVolumeDb: audioSummary.meanVolumeDb,
    },
  };

  const outputPath = options.outputPath || `${options.filePath}.qc.json`;
  await writeJsonManifest(outputPath, report);
  return { report, outputPath };
}

export function registerQcTools(server: McpServer): void {
  server.tool('studio_qc_run', 'Runs Brunella Studio QC heuristics on a rendered output file.', {
    file_path: z.string().min(1),
    expected_duration_sec: z.number().optional(),
    expected_width: z.number().int().positive().optional(),
    expected_height: z.number().int().positive().optional(),
    output_path: z.string().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await runQcChecks({ filePath: args.file_path, expectedDurationSec: args.expected_duration_sec, expectedWidth: args.expected_width, expectedHeight: args.expected_height, outputPath: args.output_path }), null, 2) }] }));
}
