import { mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { getStudioProjectPaths } from '../config/studioConfig.js';
import { PipelineRunReportSchema, type PipelineRunReport, type RenderPresetName, type StudioEditStyle } from '../schemas/studioSchemas.js';
import { writeJsonManifest } from '../services/studio/mediaBinOrganizer.js';
import { generateAudioPlan } from '../tools/audioPlanTool.js';
import { probeFfmpegRuntime } from '../tools/ffmpegTool.js';
import { ingestMediaDirectory } from '../tools/mediaAnalysisTool.js';
import { runQcChecks } from '../tools/qcTool.js';
import { planStudioRender, renderTimelinePlan } from '../tools/renderPresetTool.js';
import { prepareResolveTimelineImportFlow, probeResolveBridge } from '../tools/resolveBridgeTool.js';
import { generateTimelinePlan } from '../tools/timelinePlanTool.js';

export async function studioInit(projectName: string): Promise<{ projectName: string; paths: ReturnType<typeof getStudioProjectPaths> }> {
  const paths = getStudioProjectPaths(projectName);
  await Promise.all([
    mkdir(paths.projectRoot, { recursive: true }),
    mkdir(paths.manifestDir, { recursive: true }),
    mkdir(paths.exportDir, { recursive: true }),
    mkdir(paths.proxyDir, { recursive: true }),
    mkdir(paths.qcDir, { recursive: true }),
  ]);
  return { projectName, paths };
}

export async function studioProbe(): Promise<Record<string, unknown>> {
  const [ffmpeg, resolve] = await Promise.all([probeFfmpegRuntime(), probeResolveBridge()]);
  return {
    ffmpeg,
    resolve,
    readyForFfmpegPipeline: ffmpeg.ffmpegAvailable && ffmpeg.ffprobeAvailable,
    readyForResolvePipeline: Boolean((resolve.bridge as { data?: { resolveReachable?: boolean } })?.data?.resolveReachable),
  };
}

export async function studioFullPipeline(options: {
  inputDir: string;
  projectName?: string;
  style?: StudioEditStyle;
  targetDurationSec?: number;
  musicTrackPath?: string;
  presets?: RenderPresetName[];
  generateProxies?: boolean;
}): Promise<{ report: PipelineRunReport; reportPath: string; resolveFlow: ReturnType<typeof prepareResolveTimelineImportFlow> }> {
  const ingest = await ingestMediaDirectory({ inputDir: options.inputDir, projectName: options.projectName, generateProxies: options.generateProxies });
  const timeline = await generateTimelinePlan({ manifestPath: ingest.manifestPath, projectName: ingest.projectName, style: options.style, targetDurationSec: options.targetDurationSec, musicTrackPath: options.musicTrackPath });
  const audio = options.musicTrackPath
    ? await generateAudioPlan({ timelinePlanPath: timeline.outputPath, projectName: ingest.projectName, musicTrackPath: options.musicTrackPath, style: options.style })
    : undefined;
  const render = await renderTimelinePlan({ projectName: ingest.projectName, timelinePlan: timeline.timelinePlan, presets: options.presets, musicTrackPath: options.musicTrackPath });
  const qcReports = await Promise.all(render.renderJobs.map((job) => runQcChecks({ filePath: job.outputPath, expectedDurationSec: job.expectedDurationSec, expectedWidth: job.preset.width, expectedHeight: job.preset.height, outputPath: `${job.outputPath}.qc.json` }).then((item) => item.report)));
  const resolveFlow = prepareResolveTimelineImportFlow({ projectName: ingest.projectName, timelinePlan: timeline.timelinePlan, renderJobs: render.renderJobs });

  const report = PipelineRunReportSchema.parse({
    pipelineId: randomUUID(),
    projectName: ingest.projectName,
    createdAt: new Date().toISOString(),
    status: qcReports.every((item) => item.passed) ? 'completed' : 'partial',
    inputDir: options.inputDir,
    outputDir: getStudioProjectPaths(ingest.projectName).exportDir,
    assets: ingest.assets,
    timelinePlan: timeline.timelinePlan,
    audioPlan: audio?.audioPlan,
    renderJobs: render.renderJobs,
    qcReports,
    warnings: [...timeline.timelinePlan.warnings, ...(audio?.audioPlan.warnings ?? [])],
    notes: ['Resolve workflow kulon JSON handoffkent keszul a baseline FFmpeg render melle.'],
  });

  const reportPath = path.join(getStudioProjectPaths(ingest.projectName).manifestDir, 'pipeline-report.json');
  await writeJsonManifest(reportPath, report);
  return { report, reportPath, resolveFlow };
}
