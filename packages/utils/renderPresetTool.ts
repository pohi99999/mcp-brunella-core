import { mkdir } from 'fs/promises';
import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioProjectPaths } from '@packages/utils/studioConfig.js';
import { RenderPresetNameSchema, type AudioPlan, type RenderJob, type RenderPresetName, type TimelinePlan } from '@packages/types/studioSchemas.js';
import { planRenderJobs, listRenderPresets } from '@packages/core-logic/studio/exportPlanner.js';
import { writeJsonManifest } from '@packages/core-logic/studio/mediaBinOrganizer.js';
import { ffmpegConcatClips, ffmpegMixMusicBed, ffmpegTranscodeDeliverable, ffmpegTrimClip } from './ffmpegTool.js';
import { loadTimelinePlan } from './timelinePlanTool.js';

async function trimTimelineClips(timelinePlan: TimelinePlan, tempDir: string): Promise<string[]> {
  const masterPreset = listRenderPresets().find((preset) => preset.name === 'master-16x9');
  if (!masterPreset) {
    throw new Error('A master-16x9 preset nem elerheto.');
  }

  const ordered = [...timelinePlan.timeline].sort((left, right) => left.placementSec - right.placementSec);
  const outputs: string[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const clip = ordered[index];
    const outputPath = path.join(tempDir, `${String(index + 1).padStart(3, '0')}-${clip.assetId}.mp4`);
    await ffmpegTrimClip(clip.assetPath, outputPath, {
      startSec: clip.startSec,
      durationSec: Math.max(0.5, Number((clip.endSec - clip.startSec).toFixed(2))),
      width: masterPreset.width,
      height: masterPreset.height,
      fps: masterPreset.fps,
      includeAudio: false,
    });
    outputs.push(outputPath);
  }
  return outputs;
}

export async function planStudioRender(options: {
  projectName: string;
  timelinePlan: TimelinePlan;
  presets?: RenderPresetName[];
  outputDir?: string;
}): Promise<{ renderJobs: RenderJob[]; renderPlanPath: string }> {
  const paths = getStudioProjectPaths(options.projectName);
  const renderJobs = planRenderJobs({
    projectName: options.projectName,
    timelinePlan: options.timelinePlan,
    presets: options.presets ?? ['master-16x9'],
    outputDir: options.outputDir,
  });
  const renderPlanPath = path.join(paths.manifestDir, 'render-jobs.json');
  await writeJsonManifest(renderPlanPath, renderJobs);
  return { renderJobs, renderPlanPath };
}

export async function renderTimelinePlan(options: {
  projectName: string;
  timelinePlanPath?: string;
  timelinePlan?: TimelinePlan;
  presets?: RenderPresetName[];
  musicTrackPath?: string;
}): Promise<{ projectName: string; renderJobs: RenderJob[]; baseAssemblyPath: string; finalSourcePath: string; renderPlanPath: string }> {
  const timelinePlan = options.timelinePlan ?? await loadTimelinePlan(options.timelinePlanPath as string);
  const paths = getStudioProjectPaths(options.projectName);
  await mkdir(paths.exportDir, { recursive: true });
  const tempDir = path.join(paths.projectRoot, 'render-temp');
  await mkdir(tempDir, { recursive: true });

  const clipPaths = await trimTimelineClips(timelinePlan, tempDir);
  const baseAssemblyPath = path.join(tempDir, `${options.projectName}-assembly.mp4`);
  await ffmpegConcatClips(clipPaths, baseAssemblyPath);

  let finalSourcePath = baseAssemblyPath;
  const effectiveMusicTrack = options.musicTrackPath || timelinePlan.musicTrackPath;
  if (effectiveMusicTrack) {
    finalSourcePath = path.join(tempDir, `${options.projectName}-music-bed.mp4`);
    await ffmpegMixMusicBed(baseAssemblyPath, effectiveMusicTrack, finalSourcePath);
  }

  const { renderJobs, renderPlanPath } = await planStudioRender({
    projectName: options.projectName,
    timelinePlan,
    presets: options.presets,
  });

  for (const job of renderJobs) {
    await ffmpegTranscodeDeliverable(finalSourcePath, job.outputPath, job.preset);
    job.status = 'completed';
  }

  await writeJsonManifest(renderPlanPath, renderJobs);
  return { projectName: options.projectName, renderJobs, baseAssemblyPath, finalSourcePath, renderPlanPath };
}

export function registerRenderPresetTools(server: McpServer): void {
  server.tool('studio_render_presets', 'Lists built-in Brunella Studio delivery presets.', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(listRenderPresets(), null, 2) }] }));
  server.tool('studio_render_plan', 'Creates render jobs from a timeline plan and selected presets.', {
    project_name: z.string().min(1),
    timeline_plan_path: z.string().min(1),
    presets: z.array(RenderPresetNameSchema).optional(),
  }, async (args) => {
    const timelinePlan = await loadTimelinePlan(args.timeline_plan_path);
    return { content: [{ type: 'text', text: JSON.stringify(await planStudioRender({ projectName: args.project_name, timelinePlan, presets: args.presets }), null, 2) }] };
  });
  server.tool('studio_render_execute', 'Renders deliverables from a rough-cut timeline using FFmpeg baseline assembly.', {
    project_name: z.string().min(1),
    timeline_plan_path: z.string().min(1),
    presets: z.array(RenderPresetNameSchema).optional(),
    music_track_path: z.string().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await renderTimelinePlan({ projectName: args.project_name, timelinePlanPath: args.timeline_plan_path, presets: args.presets, musicTrackPath: args.music_track_path }), null, 2) }] }));
}

