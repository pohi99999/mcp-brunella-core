import path from 'path';
import { createHash } from 'crypto';

import type { MediaAsset } from '../../schemas/studioSchemas.js';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function basenameTokens(fileName: string): string[] {
  return fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function buildMediaFingerprint(asset: Pick<MediaAsset, 'fileName' | 'sizeBytes' | 'durationSec' | 'width' | 'height' | 'hasAudio' | 'hasVideo'>): string {
  return createHash('sha1')
    .update([
      asset.fileName.toLowerCase(),
      asset.sizeBytes,
      asset.durationSec.toFixed(3),
      asset.width ?? 0,
      asset.height ?? 0,
      asset.hasAudio ? 1 : 0,
      asset.hasVideo ? 1 : 0,
    ].join('|'))
    .digest('hex');
}

export function classifyClipTags(asset: Pick<MediaAsset, 'fileName' | 'durationSec' | 'hasAudio' | 'hasVideo'>): string[] {
  const tokens = basenameTokens(asset.fileName);
  const tags = new Set<string>();

  if (asset.hasVideo) tags.add('video');
  if (asset.hasAudio) tags.add('audio');
  if (asset.durationSec <= 3) tags.add('micro-shot');
  if (asset.durationSec > 3 && asset.durationSec <= 8) tags.add('montage');
  if (asset.durationSec > 8) tags.add('hero');

  if (tokens.some((token) => ['close', 'detail', 'macro', 'texture'].includes(token))) {
    tags.add('detail');
  }
  if (tokens.some((token) => ['walk', 'motion', 'move', 'spin', 'silhouette'].includes(token))) {
    tags.add('motion');
  }
  if (tokens.some((token) => ['end', 'outro', 'final', 'utolso', 'last'].includes(token))) {
    tags.add('ending');
  }
  if (tokens.some((token) => ['hero', 'opening', 'intro', 'look'].includes(token))) {
    tags.add('opening');
  }

  if (tags.size === 0) {
    tags.add('misc');
  }

  return [...tags];
}

export function scoreClipQuality(asset: Pick<MediaAsset, 'width' | 'height' | 'fps' | 'durationSec' | 'hasAudio' | 'hasVideo' | 'fileName' | 'sizeBytes'>): number {
  let score = 35;
  const pixels = (asset.width ?? 0) * (asset.height ?? 0);
  const fileName = asset.fileName.toLowerCase();

  if (pixels >= 1920 * 1080) score += 20;
  else if (pixels >= 1280 * 720) score += 12;
  else if (pixels > 0) score += 6;

  if ((asset.fps ?? 0) >= 50) score += 10;
  else if ((asset.fps ?? 0) >= 24) score += 7;

  if (asset.durationSec >= 1.5 && asset.durationSec <= 8) score += 12;
  else if (asset.durationSec > 8 && asset.durationSec <= 18) score += 8;
  else if (asset.durationSec > 18) score += 4;

  if (asset.hasAudio) score += 5;
  if (asset.hasVideo) score += 5;

  if (/hero|intro|opening|look/.test(fileName)) score += 8;
  if (/detail|macro|texture/.test(fileName)) score += 6;
  if (/end|outro|utolso|final/.test(fileName)) score += 6;
  if (asset.sizeBytes > 50 * 1024 * 1024) score += 4;

  return clamp(Math.round(score), 0, 100);
}

export function choosePrimaryBin(tags: string[]): string {
  if (tags.includes('opening') || tags.includes('hero')) return 'hero';
  if (tags.includes('detail')) return 'details';
  if (tags.includes('motion')) return 'motion';
  if (tags.includes('ending')) return 'ending';
  if (tags.includes('audio')) return 'music';
  return 'misc';
}

export type DuplicateCandidate = {
  leftAssetId: string;
  rightAssetId: string;
  similarity: number;
  reason: string;
};

export function detectNearDuplicates(assets: MediaAsset[]): DuplicateCandidate[] {
  const duplicates: DuplicateCandidate[] = [];

  for (let index = 0; index < assets.length; index += 1) {
    for (let inner = index + 1; inner < assets.length; inner += 1) {
      const left = assets[index];
      const right = assets[inner];
      const sameFingerprint = left.fingerprint === right.fingerprint;
      const sameStem = path.parse(left.fileName).name.toLowerCase() === path.parse(right.fileName).name.toLowerCase();
      const durationDelta = Math.abs(left.durationSec - right.durationSec);
      const resolutionMatch = left.width === right.width && left.height === right.height;
      const similarity = sameFingerprint
        ? 1
        : clamp((sameStem ? 0.45 : 0) + (resolutionMatch ? 0.25 : 0) + Math.max(0, 0.3 - durationDelta / 10), 0, 0.98);

      if (sameFingerprint || similarity >= 0.72) {
        duplicates.push({
          leftAssetId: left.id,
          rightAssetId: right.id,
          similarity: Number(similarity.toFixed(2)),
          reason: sameFingerprint ? 'matching-fingerprint' : 'similar-duration-resolution-name',
        });
      }
    }
  }

  return duplicates.sort((left, right) => right.similarity - left.similarity);
}
