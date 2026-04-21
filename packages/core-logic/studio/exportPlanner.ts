import path from 'path';
import { randomUUID } from 'crypto';

import { getStudioConfig, parseStudioResolution } from '@packages/utils/studioConfig.js';
import type { RenderJob, RenderPreset, RenderPresetName, ResolveOperation, TimelinePlan } from '@packages/types/studioSchemas.js';

const DEFAULT_PRESETS: Record<RenderPresetName, RenderPreset> = {
  'master-16x9': {
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
    description: 'Primary horizontal delivery for web and presentations.',
  },
  'reel-9x16': {
    name: 'reel-9x16',
    label: '9:16 Reels',
    width: 1080,
    height: 1920,
    fps: 25,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '12M',
    audioBitrate: '256k',
    container: 'mp4',
    description: 'Vertical social version.',
    targetDurationCapSec: 75,
  },
  'social-1x1': {
    name: 'social-1x1',
    label: '1:1 Social Cut',
    width: 1080,
    height: 1080,
    fps: 25,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '10M',
    audioBitrate: '256k',
    container: 'mp4',
    description: 'Square social asset.',
    targetDurationCapSec: 60,
  },
  'teaser-short': {
    name: 'teaser-short',
    label: 'Short Teaser',
    width: 1920,
    height: 1080,
    fps: 25,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '12M',
    audioBitrate: '256k',
    container: 'mp4',
    description: 'Fast teaser cut for previews and ads.',
    targetDurationCapSec: 30,
  },
};

export function getRenderPreset(name: RenderPresetName): RenderPreset {
  if (name === 'master-16x9') {
    const config = getStudioConfig();
    const resolution = parseStudioResolution(config.defaultResolution);
    return {
      ...DEFAULT_PRESETS[name],
      width: resolution.width,
      height: resolution.height,
      fps: config.defaultFps,
    };
  }

  return DEFAULT_PRESETS[name];
}

export function listRenderPresets(): RenderPreset[] {
  return (Object.keys(DEFAULT_PRESETS) as RenderPresetName[]).map((name) => getRenderPreset(name));
}

export function buildResolveRenderOperations(job: RenderJob): ResolveOperation[] {
  return [
    {
      command: 'queue_render',
      payload: {
        timelineName: job.timelineName,
        outputPath: job.outputPath,
        presetName: job.preset.name,
        preset: job.preset,
      },
    },
  ];
}

export function planRenderJobs(options: {
  projectName: string;
  timelinePlan: TimelinePlan;
  presets: RenderPresetName[];
  outputDir?: string;
}): RenderJob[] {
  const config = getStudioConfig();
  const outputDir = options.outputDir || path.join(config.exportDir, options.projectName);
  return options.presets.map((presetName) => {
    const preset = getRenderPreset(presetName);
    const job: RenderJob = {
      id: randomUUID(),
      preset,
      timelineName: `${options.projectName}-${preset.name}`,
      outputPath: path.join(outputDir, `${options.projectName}-${preset.name}.${preset.container}`),
      expectedDurationSec: preset.targetDurationCapSec
        ? Math.min(options.timelinePlan.targetDurationSec, preset.targetDurationCapSec)
        : options.timelinePlan.targetDurationSec,
      status: 'planned',
      resolveOperations: [],
      notes: [preset.description],
    };
    job.resolveOperations = buildResolveRenderOperations(job);
    return job;
  });
}
