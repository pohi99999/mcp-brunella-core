import { access, mkdir, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

import { MediaAssetSchema, type MediaAsset, type MediaAssetType } from '@packages/types/studioSchemas.js';
import { choosePrimaryBin } from './clipScoring.js';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mxf', '.mkv', '.avi', '.webm']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aif', '.aiff', '.m4a']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.webp']);

function inferType(filePath: string): MediaAssetType {
  const extension = path.extname(filePath).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  return 'other';
}

export async function ensurePathExists(filePath: string): Promise<void> {
  await access(filePath, constants.F_OK);
}

export async function scanMediaDirectory(inputDir: string): Promise<Array<{ path: string; fileName: string; sizeBytes: number; type: MediaAssetType }>> {
  await ensurePathExists(inputDir);
  const entries = await readdir(inputDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(inputDir, entry.name);
        const fileStat = await stat(fullPath);
        return {
          path: fullPath,
          fileName: entry.name,
          sizeBytes: fileStat.size,
          type: inferType(fullPath),
        };
      }),
  );

  return files.filter((file) => file.type !== 'other');
}

export async function ensureStudioDirectories(paths: string[]): Promise<void> {
  await Promise.all(paths.map((target) => mkdir(target, { recursive: true })));
}

export async function writeJsonManifest(targetPath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
}

export function finalizeAsset(asset: MediaAsset): MediaAsset {
  return MediaAssetSchema.parse({
    ...asset,
    bin: asset.bin || choosePrimaryBin(asset.tags),
  });
}
