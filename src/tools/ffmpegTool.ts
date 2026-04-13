import { execFile } from 'child_process';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioConfig } from '../config/studioConfig.js';
import { type MediaAsset, type RenderPreset } from '../schemas/studioSchemas.js';
import { buildMediaFingerprint, choosePrimaryBin, classifyClipTags, scoreClipQuality } from '../services/studio/clipScoring.js';
import { logInfo } from '../utils/logger.js';

interface ProcessResult {
  stdout: string;
  stderr: string;
}

function execFileAsync(command: string, args: string[], options?: { cwd?: string; input?: string }): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd: options?.cwd, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || error.message}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    if (options?.input) {
      child.stdin?.write(options.input);
      child.stdin?.end();
    }
  });
}

async function ensureReadableFile(filePath: string): Promise<void> {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`Nem fajl: ${filePath}`);
  }
}

async function ensureWritableParent(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function parseFraction(raw?: string): number | undefined {
  if (!raw) return undefined;
  const [numerator, denominator] = raw.split('/').map(Number);
  if (!Number.isFinite(numerator)) return undefined;
  if (!Number.isFinite(denominator) || denominator === 0) return numerator;
  return numerator / denominator;
}

function parseVolumeMetric(stderr: string, label: string): number | undefined {
  const match = stderr.match(new RegExp(`${label}:\\s*(-?[\\d.]+)\\s*dB`, 'i'));
  return match ? Number(match[1]) : undefined;
}

export async function probeFfmpegRuntime(): Promise<{ ffmpegAvailable: boolean; ffprobeAvailable: boolean; ffmpegVersion?: string; ffprobeVersion?: string; }> {
  const config = getStudioConfig();
  let ffmpegVersion: string | undefined;
  let ffprobeVersion: string | undefined;
  let ffmpegAvailable = false;
  let ffprobeAvailable = false;

  try {
    const result = await execFileAsync(config.ffmpegPath, ['-version']);
    ffmpegVersion = result.stdout.split(/\r?\n/)[0]?.trim();
    ffmpegAvailable = true;
  } catch {
    // Availability stays false when the binary is missing or not runnable.
  }

  try {
    const result = await execFileAsync(config.ffprobePath, ['-version']);
    ffprobeVersion = result.stdout.split(/\r?\n/)[0]?.trim();
    ffprobeAvailable = true;
  } catch {
    // Availability stays false when the binary is missing or not runnable.
  }

  return { ffmpegAvailable, ffprobeAvailable, ffmpegVersion, ffprobeVersion };
}

export async function ffmpegProbeMedia(filePath: string): Promise<Record<string, unknown>> {
  await ensureReadableFile(filePath);
  const config = getStudioConfig();
  const result = await execFileAsync(config.ffprobePath, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function pickStream(probe: Record<string, unknown>, codecType: 'video' | 'audio'): Record<string, unknown> | undefined {
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  return streams.find((stream) => typeof stream === 'object' && stream !== null && (stream as { codec_type?: unknown }).codec_type === codecType) as Record<string, unknown> | undefined;
}

export async function createMediaAssetFromProbe(filePath: string): Promise<MediaAsset> {
  const fileInfo = await stat(filePath);
  const probe = await ffmpegProbeMedia(filePath);
  const video = pickStream(probe, 'video');
  const audio = pickStream(probe, 'audio');
  const format = (typeof probe.format === 'object' && probe.format !== null ? probe.format : {}) as Record<string, unknown>;
  const fileName = path.basename(filePath);
  const durationSec = Number(typeof format.duration === 'string' ? format.duration : 0) || 0;
  const width = typeof video?.width === 'number' ? video.width : undefined;
  const height = typeof video?.height === 'number' ? video.height : undefined;
  const fps = parseFraction(typeof video?.avg_frame_rate === 'string' ? video.avg_frame_rate : undefined);
  const tags = classifyClipTags({ fileName, durationSec, hasAudio: Boolean(audio), hasVideo: Boolean(video) });
  const assetType: MediaAsset['type'] = audio && !video ? 'audio' : video ? 'video' : 'other';
  const draft = {
    id: path.parse(fileName).name,
    path: filePath,
    fileName,
    type: assetType,
    sizeBytes: fileInfo.size,
    durationSec,
    width,
    height,
    fps,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    audioChannels: typeof audio?.channels === 'number' ? audio.channels : undefined,
    sampleRate: typeof audio?.sample_rate === 'string' ? Number(audio.sample_rate) : undefined,
    videoCodec: typeof video?.codec_name === 'string' ? video.codec_name : undefined,
    audioCodec: typeof audio?.codec_name === 'string' ? audio.codec_name : undefined,
    bitrate: typeof format.bit_rate === 'string' ? Number(format.bit_rate) : undefined,
    tags,
    warnings: [],
  };
  const fingerprint = buildMediaFingerprint({
    fileName,
    sizeBytes: fileInfo.size,
    durationSec,
    width,
    height,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
  });
  return {
    ...draft,
    fingerprint,
    qualityScore: scoreClipQuality({ ...draft, fileName, sizeBytes: fileInfo.size }),
    bin: choosePrimaryBin(tags),
  };
}

export async function ffmpegGenerateProxy(inputPath: string, outputPath: string, options?: { height?: number; }): Promise<{ outputPath: string }> {
  await ensureReadableFile(inputPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  const height = options?.height ?? 720;
  await execFileAsync(config.ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-vf', `scale=-2:${height}`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '27',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputPath,
  ]);
  return { outputPath };
}

export async function ffmpegNormalizeAudio(inputPath: string, outputPath: string, targetLufs = -14): Promise<{ outputPath: string; targetLufs: number }> {
  await ensureReadableFile(inputPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  await execFileAsync(config.ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
    '-c:a', 'aac',
    '-b:a', '256k',
    outputPath,
  ]);
  return { outputPath, targetLufs };
}

export async function ffmpegExtractAudioSummary(inputPath: string): Promise<{ durationSec: number; meanVolumeDb?: number; maxVolumeDb?: number; }> {
  await ensureReadableFile(inputPath);
  const config = getStudioConfig();
  const probe = await ffmpegProbeMedia(inputPath);
  const format = (typeof probe.format === 'object' && probe.format !== null ? probe.format : {}) as Record<string, unknown>;
  const result = await execFileAsync(config.ffmpegPath, ['-i', inputPath, '-af', 'volumedetect', '-f', 'null', '-']);
  return {
    durationSec: Number(typeof format.duration === 'string' ? format.duration : 0) || 0,
    meanVolumeDb: parseVolumeMetric(result.stderr, 'mean_volume'),
    maxVolumeDb: parseVolumeMetric(result.stderr, 'max_volume'),
  };
}

export async function ffmpegTrimClip(inputPath: string, outputPath: string, options: { startSec: number; durationSec: number; width?: number; height?: number; fps?: number; includeAudio?: boolean; }): Promise<{ outputPath: string }> {
  await ensureReadableFile(inputPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  const filters: string[] = [];
  if (options.width && options.height) {
    filters.push(`scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black`);
  }
  const args = [
    '-y',
    '-ss', String(options.startSec),
    '-t', String(options.durationSec),
    '-i', inputPath,
    ...(filters.length > 0 ? ['-vf', filters.join(',')] : []),
    ...(options.fps ? ['-r', String(options.fps)] : []),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
  ];
  if (options.includeAudio === false) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', '192k');
  }
  args.push(outputPath);
  await execFileAsync(config.ffmpegPath, args);
  return { outputPath };
}

export async function ffmpegConcatClips(inputPaths: string[], outputPath: string): Promise<{ outputPath: string }> {
  if (inputPaths.length === 0) {
    throw new Error('Legalabb egy input clip szukseges az osszefuzeshez.');
  }
  await Promise.all(inputPaths.map((filePath) => ensureReadableFile(filePath)));
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  const concatFile = path.join(os.tmpdir(), `brunella-studio-concat-${Date.now()}.txt`);
  await writeFile(concatFile, inputPaths.map((item) => `file '${item.replace(/'/g, "'\\''")}'`).join('\n'), 'utf-8');
  await execFileAsync(config.ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', outputPath]);
  return { outputPath };
}

export async function ffmpegGenerateThumbnail(inputPath: string, outputPath: string, atSec = 0.5): Promise<{ outputPath: string }> {
  await ensureReadableFile(inputPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  await execFileAsync(config.ffmpegPath, ['-y', '-ss', String(atSec), '-i', inputPath, '-frames:v', '1', outputPath]);
  return { outputPath };
}

export async function ffmpegTranscodeDeliverable(inputPath: string, outputPath: string, preset: RenderPreset): Promise<{ outputPath: string }> {
  await ensureReadableFile(inputPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  await execFileAsync(config.ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-vf', `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`,
    '-r', String(preset.fps),
    '-c:v', preset.videoCodec,
    '-b:v', preset.videoBitrate,
    '-c:a', preset.audioCodec,
    '-b:a', preset.audioBitrate,
    outputPath,
  ]);
  return { outputPath };
}

export async function ffmpegMixMusicBed(videoPath: string, musicPath: string, outputPath: string): Promise<{ outputPath: string }> {
  await ensureReadableFile(videoPath);
  await ensureReadableFile(musicPath);
  await ensureWritableParent(outputPath);
  const config = getStudioConfig();
  await execFileAsync(config.ffmpegPath, [
    '-y',
    '-i', videoPath,
    '-stream_loop', '-1',
    '-i', musicPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '256k',
    outputPath,
  ]);
  return { outputPath };
}

export async function ffmpegVerifyOutput(filePath: string, expectedDurationSec?: number): Promise<{ filePath: string; durationSec: number; hasAudio: boolean; hasVideo: boolean; width?: number; height?: number; durationDeltaSec?: number; }> {
  const probe = await ffmpegProbeMedia(filePath);
  const video = pickStream(probe, 'video');
  const audio = pickStream(probe, 'audio');
  const format = (typeof probe.format === 'object' && probe.format !== null ? probe.format : {}) as Record<string, unknown>;
  const durationSec = Number(typeof format.duration === 'string' ? format.duration : 0) || 0;
  return {
    filePath,
    durationSec,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    width: typeof video?.width === 'number' ? video.width : undefined,
    height: typeof video?.height === 'number' ? video.height : undefined,
    durationDeltaSec: typeof expectedDurationSec === 'number' ? Number(Math.abs(durationSec - expectedDurationSec).toFixed(2)) : undefined,
  };
}

export async function ffmpegBlackFrameSummary(filePath: string): Promise<{ blackSegments: number; raw: string }> {
  const config = getStudioConfig();
  const result = await execFileAsync(config.ffmpegPath, ['-i', filePath, '-vf', 'blackdetect=d=0.2:pic_th=0.98', '-an', '-f', 'null', '-']);
  const matches = result.stderr.match(/black_start/g);
  return { blackSegments: matches ? matches.length : 0, raw: result.stderr };
}

export function registerStudioFfmpegTools(server: McpServer): void {
  logInfo('Registering Brunella Studio FFmpeg tools.');

  server.tool('studio_ffmpeg_probe', 'Detects FFmpeg and FFprobe availability for Brunella Studio.', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(await probeFfmpegRuntime(), null, 2) }] }));
  server.tool('studio_ffmpeg_media_probe', 'Probes media metadata with ffprobe.', { file_path: z.string().min(1) }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegProbeMedia(args.file_path), null, 2) }] }));
  server.tool('studio_ffmpeg_generate_proxy', 'Creates a lightweight proxy clip for editing.', { input_path: z.string().min(1), output_path: z.string().min(1), height: z.number().int().positive().optional() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegGenerateProxy(args.input_path, args.output_path, { height: args.height }), null, 2) }] }));
  server.tool('studio_ffmpeg_normalize_audio', 'Normalizes an audio asset to the target loudness baseline.', { input_path: z.string().min(1), output_path: z.string().min(1), target_lufs: z.number().optional() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegNormalizeAudio(args.input_path, args.output_path, args.target_lufs), null, 2) }] }));
  server.tool('studio_ffmpeg_trim_clip', 'Trims and standardizes a clip segment for rough-cut assembly.', { input_path: z.string().min(1), output_path: z.string().min(1), start_sec: z.number().nonnegative(), duration_sec: z.number().positive() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegTrimClip(args.input_path, args.output_path, { startSec: args.start_sec, durationSec: args.duration_sec }), null, 2) }] }));
  server.tool('studio_ffmpeg_concat_clips', 'Concatenates already standardized clip files.', { input_paths: z.array(z.string().min(1)).min(1), output_path: z.string().min(1) }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegConcatClips(args.input_paths, args.output_path), null, 2) }] }));
  server.tool('studio_ffmpeg_generate_thumbnail', 'Captures a representative thumbnail from a clip.', { input_path: z.string().min(1), output_path: z.string().min(1), at_sec: z.number().nonnegative().optional() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegGenerateThumbnail(args.input_path, args.output_path, args.at_sec), null, 2) }] }));
  server.tool('studio_ffmpeg_verify_output', 'Verifies render duration and stream presence.', { file_path: z.string().min(1), expected_duration_sec: z.number().optional() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ffmpegVerifyOutput(args.file_path, args.expected_duration_sec), null, 2) }] }));
}
