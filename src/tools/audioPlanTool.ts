import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioProjectPaths } from '../config/studioConfig.js';
import { AudioPlanSchema, type AudioPlan, type StudioEditStyle } from '../schemas/studioSchemas.js';
import { buildBeatMarkers, estimateBpm } from '../services/studio/beatMapping.js';
import { buildAudioCues, buildAudioPlanNotes, buildDuckingPlan } from '../services/studio/audioDuckingPlanner.js';
import { writeJsonManifest } from '../services/studio/mediaBinOrganizer.js';
import { ffmpegExtractAudioSummary } from './ffmpegTool.js';
import { loadTimelinePlan } from './timelinePlanTool.js';

export async function generateAudioPlan(options: {
  timelinePlanPath?: string;
  timelinePlan?: unknown;
  projectName?: string;
  musicTrackPath: string;
  style?: StudioEditStyle;
  targetLufs?: number;
  outputPath?: string;
  voiceoverWindows?: Array<{ startSec: number; endSec: number; label?: string }>;
}): Promise<{ projectName: string; audioPlan: AudioPlan; outputPath: string }> {
  const timelinePlan = await loadTimelinePlan(options.timelinePlanPath || (options.timelinePlan as never));
  const projectName = options.projectName || path.basename(options.timelinePlanPath || 'studio-project', path.extname(options.timelinePlanPath || ''));
  const audioSummary = await ffmpegExtractAudioSummary(options.musicTrackPath);
  const style = options.style ?? timelinePlan.style;
  const estimatedBpm = estimateBpm(style);
  const beatMarkers = buildBeatMarkers({ durationSec: audioSummary.durationSec || timelinePlan.targetDurationSec, style, hintedBpm: estimatedBpm });
  const ducking = buildDuckingPlan({ timelinePlan, voiceoverWindows: options.voiceoverWindows });
  const cues = buildAudioCues(timelinePlan);
  const audioPlan = AudioPlanSchema.parse({
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    style,
    musicTrackPath: options.musicTrackPath,
    trackDurationSec: audioSummary.durationSec,
    estimatedBpm,
    targetLufs: options.targetLufs ?? -14,
    beatMarkers,
    cues,
    ducking,
    fadeInSec: 0.8,
    fadeOutSec: 1.2,
    notes: buildAudioPlanNotes({ ducking, cues }),
    warnings: audioSummary.maxVolumeDb !== undefined && audioSummary.maxVolumeDb > -0.5 ? ['A zenei track kozel clipping szinthez er.'] : [],
  });
  const paths = getStudioProjectPaths(projectName);
  const outputPath = options.outputPath || path.join(paths.manifestDir, 'audio-plan.json');
  await writeJsonManifest(outputPath, audioPlan);
  return { projectName, audioPlan, outputPath };
}

export function registerAudioPlanTools(server: McpServer): void {
  server.tool('studio_audio_plan', 'Generates a music-guided audio post plan with beat markers, ducking windows, and cue notes.', {
    timeline_plan_path: z.string().optional(),
    project_name: z.string().optional(),
    music_track_path: z.string().min(1),
    style: z.enum(['elegant', 'energetic', 'cinematic', 'luxury-minimal']).optional(),
    target_lufs: z.number().optional(),
    output_path: z.string().optional(),
  }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await generateAudioPlan({ timelinePlanPath: args.timeline_plan_path, projectName: args.project_name, musicTrackPath: args.music_track_path, style: args.style, targetLufs: args.target_lufs, outputPath: args.output_path }), null, 2) }] }));
}
