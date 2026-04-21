import { readFile } from 'fs/promises';
import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioProjectPaths } from '@packages/utils/studioConfig.js';
import type { MediaAsset } from '@packages/types/studioSchemas.js';
import { detectNearDuplicates } from '@packages/core-logic/studio/clipScoring.js';
import { ensureStudioDirectories, scanMediaDirectory, writeJsonManifest } from '@packages/core-logic/studio/mediaBinOrganizer.js';
import { createMediaAssetFromProbe, ffmpegGenerateProxy, probeFfmpegRuntime } from './ffmpegTool.js';

function deriveProjectName(inputDir: string, requested?: string): string {
  return (requested || path.basename(inputDir)).replace(/[^a-zA-Z0-9._-]+/g, '-');
}

export async function analyzeMediaFile(filePath: string): Promise<MediaAsset> {
  return createMediaAssetFromProbe(filePath);
}

export async function ingestMediaDirectory(options: {
  inputDir: string;
  projectName?: string;
  generateProxies?: boolean;
}): Promise<{ projectName: string; inputDir: string; manifestPath: string; assets: MediaAsset[]; duplicates: ReturnType<typeof detectNearDuplicates>; proxyPaths: string[]; runtime: Awaited<ReturnType<typeof probeFfmpegRuntime>>; }> {
  const projectName = deriveProjectName(options.inputDir, options.projectName);
  const paths = getStudioProjectPaths(projectName);
  await ensureStudioDirectories([paths.projectRoot, paths.manifestDir, paths.exportDir, paths.proxyDir, paths.qcDir]);

  const entries = await scanMediaDirectory(options.inputDir);
  const assets = await Promise.all(entries.map((entry) => analyzeMediaFile(entry.path)));
  const duplicates = detectNearDuplicates(assets);
  const proxyPaths: string[] = [];

  if (options.generateProxies) {
    for (const asset of assets.filter((item) => item.type === 'video')) {
      const proxyPath = path.join(paths.proxyDir, `${asset.id}-proxy.mp4`);
      await ffmpegGenerateProxy(asset.path, proxyPath);
      proxyPaths.push(proxyPath);
    }
  }

  const manifestPath = path.join(paths.manifestDir, 'ingest-manifest.json');
  const runtime = await probeFfmpegRuntime();
  await writeJsonManifest(manifestPath, {
    projectName,
    inputDir: options.inputDir,
    createdAt: new Date().toISOString(),
    runtime,
    assets,
    duplicates,
    proxyPaths,
  });

  return { projectName, inputDir: options.inputDir, manifestPath, assets, duplicates, proxyPaths, runtime };
}

export async function loadIngestManifest(manifestPath: string): Promise<{ projectName: string; inputDir: string; assets: MediaAsset[] }> {
  const raw = JSON.parse(await readFile(manifestPath, 'utf-8')) as { projectName: string; inputDir: string; assets: MediaAsset[] };
  return raw;
}

export function registerMediaAnalysisTools(server: McpServer): void {
  server.tool('studio_media_analyze_file', 'Analyzes a single media file and returns normalized metadata plus a quality score.', { file_path: z.string().min(1) }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeMediaFile(args.file_path), null, 2) }] }));
  server.tool('studio_media_ingest_directory', 'Ingests a media directory into a Brunella Studio project manifest without modifying source assets.', { input_dir: z.string().min(1), project_name: z.string().optional(), generate_proxies: z.boolean().optional() }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await ingestMediaDirectory({ inputDir: args.input_dir, projectName: args.project_name, generateProxies: args.generate_proxies }), null, 2) }] }));
}

