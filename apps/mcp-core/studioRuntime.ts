import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

import { getStudioProjectPaths } from '@packages/utils/studioConfig.js';
import { PipelineRunReportSchema, StudioReviewCallbackDeliverySchema, StudioReviewFindingSchema, StudioReviewResultSchema, type PipelineRunReport, type RenderPresetName, type StudioEditStyle, type StudioReviewCallbackDelivery, type StudioReviewFinding, type StudioReviewResult } from '@packages/types/studioSchemas.js';
import { writeJsonManifest } from '@packages/core-logic/studio/mediaBinOrganizer.js';
import { generateAudioPlan } from '@packages/utils/audioPlanTool.js';
import { probeFfmpegRuntime } from '@packages/utils/ffmpegTool.js';
import { ingestMediaDirectory } from '@packages/utils/mediaAnalysisTool.js';
import { runQcChecks } from '@packages/utils/qcTool.js';
import { planStudioRender, renderTimelinePlan } from '@packages/utils/renderPresetTool.js';
import { prepareResolveTimelineImportFlow, probeResolveBridge } from '@packages/utils/resolveBridgeTool.js';
import { generateTimelinePlan } from '@packages/utils/timelinePlanTool.js';

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

function quoteStudioArgument(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function studioPipelineReportPath(projectName: string): string {
  return path.join(getStudioProjectPaths(projectName).manifestDir, 'pipeline-report.json');
}

function addFinding(findings: StudioReviewFinding[], finding: StudioReviewFinding): void {
  findings.push(StudioReviewFindingSchema.parse(finding));
}

function collectStudioReviewFindings(report: PipelineRunReport): StudioReviewFinding[] {
  const findings: StudioReviewFinding[] = [];

  if (report.status === 'failed') {
    addFinding(findings, {
      source: 'pipeline',
      severity: 'error',
      code: 'pipeline-failed',
      message: 'A Studio pipeline report failed before delivery could be approved.',
      details: { status: report.status },
    });
  } else if (report.status === 'partial') {
    addFinding(findings, {
      source: 'pipeline',
      severity: 'warning',
      code: 'pipeline-partial',
      message: 'A Studio pipeline report completed only partially and should be reviewed before approval.',
      details: { status: report.status },
    });
  }

  for (const warning of report.warnings) {
    addFinding(findings, {
      source: 'pipeline',
      severity: 'warning',
      code: 'pipeline-warning',
      message: warning,
    });
  }

  if (report.timelinePlan) {
    for (const warning of report.timelinePlan.warnings) {
      addFinding(findings, {
        source: 'timeline',
        severity: 'warning',
        code: 'timeline-warning',
        message: warning,
      });
    }
  } else {
    addFinding(findings, {
      source: 'timeline',
      severity: 'warning',
      code: 'missing-timeline-plan',
      message: 'No timeline plan was generated for this Studio run.',
    });
  }

  if (report.audioPlan) {
    for (const warning of report.audioPlan.warnings) {
      addFinding(findings, {
        source: 'audio',
        severity: 'warning',
        code: 'audio-warning',
        message: warning,
      });
    }

    const timelineTargetDurationSec = report.timelinePlan?.targetDurationSec;
    if (typeof timelineTargetDurationSec === 'number' && Number.isFinite(timelineTargetDurationSec) && timelineTargetDurationSec > 0) {
      const durationGapSec = timelineTargetDurationSec - report.audioPlan.trackDurationSec;
      if (durationGapSec > Math.max(1, timelineTargetDurationSec * 0.1)) {
        addFinding(findings, {
          source: 'audio',
          severity: 'warning',
          code: 'audio-track-shorter-than-timeline',
          message: `A zenei track ${durationGapSec.toFixed(1)} mp-cel rovidebb a timeline celhosszanal.`,
          details: {
            trackDurationSec: report.audioPlan.trackDurationSec,
            targetDurationSec: timelineTargetDurationSec,
          },
        });
      }
    }

    const minimumBeatMarkers = Math.max(4, Math.ceil(report.audioPlan.trackDurationSec / 2));
    if (report.audioPlan.beatMarkers.length < minimumBeatMarkers) {
      addFinding(findings, {
        source: 'audio',
        severity: 'warning',
        code: 'audio-sparse-beat-map',
        message: `A beat mapa tul ritka (${report.audioPlan.beatMarkers.length} marker).`,
        details: {
          beatMarkerCount: report.audioPlan.beatMarkers.length,
          minimumBeatMarkers,
        },
      });
    }

    if (report.timelinePlan?.segments.length && report.audioPlan.ducking.length === 0) {
      addFinding(findings, {
        source: 'audio',
        severity: 'info',
        code: 'audio-missing-ducking-plan',
        message: 'A zenei tervhez nem keszult ducking terv, pedig a timeline tartalmaz segmenteket.',
        details: {
          segmentCount: report.timelinePlan.segments.length,
        },
      });
    }

    if (report.audioPlan.targetLufs < -18 || report.audioPlan.targetLufs > -10) {
      addFinding(findings, {
        source: 'audio',
        severity: 'warning',
        code: 'audio-target-lufs-outlier',
        message: `A cel LUFS (${report.audioPlan.targetLufs}) kivan a studio-ajanlott savbol.`,
        details: {
          targetLufs: report.audioPlan.targetLufs,
        },
      });
    }
  }

  if (report.renderJobs.length === 0) {
    addFinding(findings, {
      source: 'render',
      severity: 'warning',
      code: 'no-render-jobs',
      message: 'The pipeline did not queue any render jobs.',
    });
  }

  for (const job of report.renderJobs) {
    if (job.status === 'failed') {
      addFinding(findings, {
        source: 'render',
        severity: 'error',
        code: 'render-failed',
        message: `Render job ${job.preset.name} failed.`,
        details: { outputPath: job.outputPath, preset: job.preset.name },
      });
    }
    if (job.status === 'planned') {
      addFinding(findings, {
        source: 'render',
        severity: 'info',
        code: 'render-planned',
        message: `Render job ${job.preset.name} is still planned.`,
        details: { outputPath: job.outputPath, preset: job.preset.name },
      });
    }
  }

  if (report.qcReports.length === 0) {
    addFinding(findings, {
      source: 'qc',
      severity: 'warning',
      code: 'no-qc-reports',
      message: 'No QC reports were generated for this Studio run.',
    });
  }

  for (const qcReport of report.qcReports) {
    for (const issue of qcReport.issues) {
      addFinding(findings, {
        source: 'qc',
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        details: {
          filePath: qcReport.filePath,
          ...issue.details,
        },
      });
    }
  }

  return findings;
}

function calculateStudioReviewScore(report: PipelineRunReport, findings: StudioReviewFinding[]): number {
  let score = 100;
  const counts = findings.reduce((acc, finding) => {
    acc[finding.severity] += 1;
    return acc;
  }, { info: 0, warning: 0, error: 0 });

  if (report.status === 'failed') {
    score -= 35;
  } else if (report.status === 'partial') {
    score -= 15;
  }

  score -= counts.warning * 4;
  score -= counts.info;
  score -= counts.error * 15;

  if (report.renderJobs.some((job) => job.status === 'failed')) {
    score -= 20;
  }

  if (report.renderJobs.length === 0) {
    score -= 10;
  }

  if (!report.timelinePlan) {
    score -= 10;
  }

  if (!report.audioPlan && Boolean(report.timelinePlan?.musicTrackPath)) {
    score -= 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function determineStudioReviewStatus(report: PipelineRunReport, findings: StudioReviewFinding[], score: number): StudioReviewResult['status'] {
  const hasBlockingError = report.status === 'failed'
    || report.renderJobs.some((job) => job.status === 'failed')
    || findings.some((finding) => finding.severity === 'error');

  if (hasBlockingError || score < 50) {
    return 'blocked';
  }

  if (score >= 85 && findings.every((finding) => finding.severity !== 'error' && finding.severity !== 'warning')) {
    return 'approved';
  }

  return 'needs-rerun';
}

function buildStudioRerunCommand(report: PipelineRunReport): string {
  const parts = [
    'brunella studio full-pipeline',
    `--input-dir ${quoteStudioArgument(report.inputDir)}`,
    `--project-name ${quoteStudioArgument(report.projectName)}`,
  ];

  if (report.timelinePlan?.style) {
    parts.push(`--style ${report.timelinePlan.style}`);
  }
  if (typeof report.timelinePlan?.targetDurationSec === 'number') {
    parts.push(`--target-duration ${report.timelinePlan.targetDurationSec}`);
  }

  const musicTrackPath = report.audioPlan?.musicTrackPath ?? report.timelinePlan?.musicTrackPath;
  if (typeof musicTrackPath === 'string' && musicTrackPath.length > 0) {
    parts.push(`--music-track ${quoteStudioArgument(musicTrackPath)}`);
  }

  const presets = [...new Set(report.renderJobs.map((job) => job.preset.name))];
  if (presets.length > 0) {
    parts.push(`--presets ${presets.join(',')}`);
  }

  return parts.join(' ');
}

function buildStudioReviewCallbackPayload(review: StudioReviewResult, report: PipelineRunReport): Record<string, unknown> {
  return {
    eventType: 'studio.review.completed',
    reviewId: review.reviewId,
    projectName: review.projectName,
    status: review.status,
    score: review.score,
    summary: review.summary,
    pipelineReportPath: review.pipelineReportPath,
    report: {
      pipelineId: report.pipelineId,
      projectName: report.projectName,
      status: report.status,
      outputDir: report.outputDir,
      renderCount: report.renderJobs.length,
      qcCount: report.qcReports.length,
    },
    findings: review.findings,
    recommendations: review.recommendations,
    rerunCommand: review.rerunCommand,
  };
}

async function deliverStudioReviewCallback(options: {
  callbackUrl?: string;
  review: StudioReviewResult;
  report: PipelineRunReport;
}): Promise<StudioReviewCallbackDelivery | undefined> {
  if (!options.callbackUrl) {
    return undefined;
  }

  const response = await fetch(options.callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildStudioReviewCallbackPayload(options.review, options.report)),
  });

  if (!response.ok) {
    throw new Error(`Studio review callback HTTP ${response.status}`);
  }

  return StudioReviewCallbackDeliverySchema.parse({
    callbackUrl: options.callbackUrl,
    eventType: 'studio.review.completed',
    reviewId: options.review.reviewId,
    projectName: options.review.projectName,
    deliveredAt: new Date().toISOString(),
    statusCode: response.status,
  });
}

export function buildStudioReview(options: {
  report: PipelineRunReport;
  pipelineReportPath: string;
  rerunCommand?: string;
}): StudioReviewResult {
  const findings = collectStudioReviewFindings(options.report);
  const score = calculateStudioReviewScore(options.report, findings);
  const status = determineStudioReviewStatus(options.report, findings, score);
  const recommendations = [
    ...(status === 'blocked' ? ['Fix the blocking render or QC issues before rerunning the Studio pipeline.'] : []),
    ...(status === 'needs-rerun' ? ['Review the warnings and rerun the Studio pipeline before approval.'] : []),
    ...(findings.some((finding) => finding.source === 'qc' && finding.severity === 'error') ? ['Repair the QC errors on the affected renders.'] : []),
    ...(findings.some((finding) => finding.source === 'timeline' && finding.severity === 'warning') ? ['Recheck the rough-cut timeline before sign-off.'] : []),
    ...(findings.some((finding) => finding.source === 'audio' && finding.severity === 'warning') ? ['Validate the music track and audio plan alignment.'] : []),
    ...(status === 'approved' && findings.length === 0 ? ['Approve the delivery and archive the pipeline report.'] : []),
  ];
  const review = StudioReviewResultSchema.parse({
    reviewId: randomUUID(),
    projectName: options.report.projectName,
    pipelineReportPath: options.pipelineReportPath,
    reviewedAt: new Date().toISOString(),
    status,
    score,
    summary: status === 'approved'
      ? `Studio review approved ${options.report.projectName} with score ${score}.`
      : status === 'needs-rerun'
        ? `Studio review recommends rerun for ${options.report.projectName} with score ${score}.`
        : `Studio review blocked ${options.report.projectName} with score ${score}.`,
    findings,
    recommendations,
    rerunCommand: options.rerunCommand ?? buildStudioRerunCommand(options.report),
  });
  return review;
}

export async function reviewStudioRun(options: {
  pipelineReportPath?: string;
  projectName?: string;
  rerunCommand?: string;
  callbackUrl?: string;
}): Promise<{ review: StudioReviewResult; report: PipelineRunReport; pipelineReportPath: string; callbackDelivery?: StudioReviewCallbackDelivery }> {
  const pipelineReportPath = options.pipelineReportPath ?? (options.projectName ? studioPipelineReportPath(options.projectName) : undefined);
  if (!pipelineReportPath) {
    throw new Error('reviewStudioRun: pipelineReportPath vagy projectName kotelezo.');
  }

  const report = PipelineRunReportSchema.parse(JSON.parse(await readFile(pipelineReportPath, 'utf-8')));
  const review = buildStudioReview({
    report,
    pipelineReportPath,
    rerunCommand: options.rerunCommand,
  });
  const callbackDelivery = await deliverStudioReviewCallback({
    callbackUrl: options.callbackUrl,
    review,
    report,
  });
  return { review, report, pipelineReportPath, callbackDelivery };
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

