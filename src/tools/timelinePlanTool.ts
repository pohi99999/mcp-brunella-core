import { readFile } from 'fs/promises';
import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioProjectPaths } from '../config/studioConfig.js';
import { TimelinePlanSchema, type MediaAsset, type StudioEditStyle, type TimelinePlan } from '../schemas/studioSchemas.js';
import { assembleTimelinePlan } from '../services/studio/timelineAssembler.js';
import { writeJsonManifest } from '../services/studio/mediaBinOrganizer.js';
import { ingestMediaDirectory, loadIngestManifest } from './mediaAnalysisTool.js';

async function loadAssets(options: { inputDir?: string; manifestPath?: string; projectName?: string }): Promise<{ projectName: string; assets: MediaAsset[]; manifestPath?: string }> {
  if (options.manifestPath) {
    const manifest = await loadIngestManifest(options.manifestPath);
    return { projectName: manifest.projectName, assets: manifest.assets, manifestPath: options.manifestPath };
  }
  if (!options.inputDir) {
    throw new Error('inputDir vagy manifestPath szukseges a rough-cut tervhez.');
  }
  const ingest = await ingestMediaDirectory({ inputDir: options.inputDir, projectName: options.projectName });
  return { projectName: ingest.projectName, assets: ingest.assets, manifestPath: ingest.manifestPath };
}

export async function generateTimelinePlan(options: {
  inputDir?: string;
  manifestPath?: string;
  projectName?: string;
  style?: StudioEditStyle;
  targetDurationSec?: number;
  musicTrackPath?: string;
  outputPath?: string;
}): Promise<{ projectName: string; timelinePlan: TimelinePlan; outputPath: string; manifestPath?: string }> {
  const loaded = await loadAssets(options);
  const style = options.style ?? 'elegant';
  const targetDurationSec = options.targetDurationSec ?? 72;
  const timelinePlan = TimelinePlanSchema.parse(
    assembleTimelinePlan({
      assets: loaded.assets,
      style,
      targetDurationSec,
      musicTrackPath: options.musicTrackPath,
    }),
  );

  const paths = getStudioProjectPaths(loaded.projectName);
  const outputPath = options.outputPath || path.join(paths.manifestDir, 'timeline-plan.json');
  await writeJsonManifest(outputPath, timelinePlan);
  return { projectName: loaded.projectName, timelinePlan, outputPath, manifestPath: loaded.manifestPath };
}

export async function loadTimelinePlan(input: string | TimelinePlan): Promise<TimelinePlan> {
  if (typeof input !== 'string') {
    return TimelinePlanSchema.parse(input);
  }
  return TimelinePlanSchema.parse(JSON.parse(await readFile(input, 'utf-8')));
}

export function registerTimelinePlanTools(server: McpServer): void {
  server.tool('studio_timeline_plan', 'Builds a deterministic fashion promo rough-cut timeline plan from ingested clips.', {
    input_dir: z.string().optional(),
    manifest_path: z.string().optional(),
    project_name: z.string().optional(),
    style: z.enum(['elegant', 'energetic', 'cinematic', 'luxury-minimal']).optional(),
    target_duration_sec: z.number().positive().optional(),
    music_track_path: z.string().optional(),
    output_path: z.string().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await generateTimelinePlan({ inputDir: args.input_dir, manifestPath: args.manifest_path, projectName: args.project_name, style: args.style, targetDurationSec: args.target_duration_sec, musicTrackPath: args.music_track_path, outputPath: args.output_path }), null, 2) }] }));
}
