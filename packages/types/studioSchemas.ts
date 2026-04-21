import { z } from 'zod';

export const MediaAssetTypeSchema = z.enum(['video', 'audio', 'image', 'other']);
export type MediaAssetType = z.infer<typeof MediaAssetTypeSchema>;

export const StudioEditStyleSchema = z.enum(['elegant', 'energetic', 'cinematic', 'luxury-minimal']);
export type StudioEditStyle = z.infer<typeof StudioEditStyleSchema>;

export const StorySegmentTypeSchema = z.enum([
  'hero-opening',
  'detail-montage',
  'silhouette-motion',
  'emotional-close',
  'cta-ending',
]);
export type StorySegmentType = z.infer<typeof StorySegmentTypeSchema>;

export const TransitionTypeSchema = z.enum(['cut', 'fade', 'cross-dissolve', 'dip-to-color', 'whip-pan']);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const RenderPresetNameSchema = z.enum(['master-16x9', 'reel-9x16', 'social-1x1', 'teaser-short']);
export type RenderPresetName = z.infer<typeof RenderPresetNameSchema>;

export const MediaAssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  fileName: z.string(),
  type: MediaAssetTypeSchema,
  sizeBytes: z.number().nonnegative(),
  durationSec: z.number().nonnegative().default(0),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  fps: z.number().positive().optional(),
  hasVideo: z.boolean().default(false),
  hasAudio: z.boolean().default(false),
  audioChannels: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  bitrate: z.number().int().positive().optional(),
  qualityScore: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]),
  fingerprint: z.string(),
  bin: z.string().default('misc'),
  warnings: z.array(z.string()).default([]),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const TimelineClipSchema = z.object({
  assetId: z.string(),
  assetPath: z.string(),
  segmentId: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  placementSec: z.number().nonnegative(),
  score: z.number().min(0).max(100),
  rationale: z.string(),
  transitionAfter: TransitionTypeSchema.default('cut'),
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const StorySegmentSchema = z.object({
  id: z.string(),
  type: StorySegmentTypeSchema,
  title: z.string(),
  targetDurationSec: z.number().positive(),
  intensity: z.number().min(0).max(1),
  notes: z.array(z.string()).default([]),
  clipIds: z.array(z.string()).default([]),
});
export type StorySegment = z.infer<typeof StorySegmentSchema>;

export const TimelineMarkerSchema = z.object({
  timeSec: z.number().nonnegative(),
  label: z.string(),
  color: z.string().default('Blue'),
  note: z.string().optional(),
});
export type TimelineMarker = z.infer<typeof TimelineMarkerSchema>;

export const TimelinePlanSchema = z.object({
  version: z.string().default('1.0.0'),
  createdAt: z.string(),
  style: StudioEditStyleSchema,
  targetDurationSec: z.number().positive(),
  musicTrackPath: z.string().optional(),
  inputSummary: z.object({
    clipCount: z.number().int().nonnegative(),
    totalDurationSec: z.number().nonnegative(),
  }),
  segments: z.array(StorySegmentSchema),
  timeline: z.array(TimelineClipSchema),
  markers: z.array(TimelineMarkerSchema).default([]),
  warnings: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});
export type TimelinePlan = z.infer<typeof TimelinePlanSchema>;

export const AudioBeatMarkerSchema = z.object({
  timeSec: z.number().nonnegative(),
  strength: z.number().min(0).max(1),
  label: z.string().default('beat'),
});
export type AudioBeatMarker = z.infer<typeof AudioBeatMarkerSchema>;

export const DuckingPointSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  gainDb: z.number(),
  reason: z.string(),
});
export type DuckingPoint = z.infer<typeof DuckingPointSchema>;

export const AudioCueSchema = z.object({
  timeSec: z.number().nonnegative(),
  type: z.enum(['music-hit', 'transition-sfx', 'voiceover-window', 'fade-in', 'fade-out']),
  note: z.string(),
});
export type AudioCue = z.infer<typeof AudioCueSchema>;

export const AudioPlanSchema = z.object({
  version: z.string().default('1.0.0'),
  createdAt: z.string(),
  style: StudioEditStyleSchema,
  musicTrackPath: z.string(),
  trackDurationSec: z.number().nonnegative(),
  estimatedBpm: z.number().positive(),
  targetLufs: z.number(),
  beatMarkers: z.array(AudioBeatMarkerSchema),
  cues: z.array(AudioCueSchema),
  ducking: z.array(DuckingPointSchema),
  fadeInSec: z.number().nonnegative(),
  fadeOutSec: z.number().nonnegative(),
  notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type AudioPlan = z.infer<typeof AudioPlanSchema>;

export const ResolveOperationSchema = z.object({
  command: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ResolveOperation = z.infer<typeof ResolveOperationSchema>;

export const RenderPresetSchema = z.object({
  name: RenderPresetNameSchema,
  label: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  videoCodec: z.string(),
  audioCodec: z.string(),
  videoBitrate: z.string(),
  audioBitrate: z.string(),
  container: z.string(),
  description: z.string(),
  targetDurationCapSec: z.number().positive().optional(),
});
export type RenderPreset = z.infer<typeof RenderPresetSchema>;

export const RenderJobSchema = z.object({
  id: z.string(),
  preset: RenderPresetSchema,
  timelineName: z.string(),
  outputPath: z.string(),
  expectedDurationSec: z.number().nonnegative().optional(),
  status: z.enum(['planned', 'queued', 'rendering', 'completed', 'failed']).default('planned'),
  resolveOperations: z.array(ResolveOperationSchema).default([]),
  notes: z.array(z.string()).default([]),
});
export type RenderJob = z.infer<typeof RenderJobSchema>;

export const QcIssueSchema = z.object({
  severity: z.enum(['info', 'warning', 'error']),
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type QcIssue = z.infer<typeof QcIssueSchema>;

export const QcReportSchema = z.object({
  filePath: z.string(),
  checkedAt: z.string(),
  passed: z.boolean(),
  durationSec: z.number().nonnegative().optional(),
  aspectRatio: z.string().optional(),
  hasAudio: z.boolean().optional(),
  hasVideo: z.boolean().optional(),
  issues: z.array(QcIssueSchema),
  stats: z.record(z.string(), z.unknown()).default({}),
});
export type QcReport = z.infer<typeof QcReportSchema>;

export const PipelineRunReportSchema = z.object({
  pipelineId: z.string(),
  projectName: z.string(),
  createdAt: z.string(),
  status: z.enum(['planned', 'completed', 'partial', 'failed']),
  inputDir: z.string(),
  outputDir: z.string(),
  assets: z.array(MediaAssetSchema),
  timelinePlan: TimelinePlanSchema.optional(),
  audioPlan: AudioPlanSchema.optional(),
  renderJobs: z.array(RenderJobSchema).default([]),
  qcReports: z.array(QcReportSchema).default([]),
  warnings: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});
export type PipelineRunReport = z.infer<typeof PipelineRunReportSchema>;

export const StudioProbeReportSchema = z.object({
  ffmpegAvailable: z.boolean(),
  ffprobeAvailable: z.boolean(),
  pythonAvailable: z.boolean(),
  resolveAvailable: z.boolean(),
  details: z.record(z.string(), z.unknown()).default({}),
  warnings: z.array(z.string()).default([]),
});
export type StudioProbeReport = z.infer<typeof StudioProbeReportSchema>;

export const StudioReviewFindingSchema = z.object({
  source: z.enum(['pipeline', 'timeline', 'audio', 'render', 'qc']),
  severity: z.enum(['info', 'warning', 'error']),
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type StudioReviewFinding = z.infer<typeof StudioReviewFindingSchema>;

export const StudioReviewResultSchema = z.object({
  reviewId: z.string(),
  projectName: z.string(),
  pipelineReportPath: z.string(),
  reviewedAt: z.string(),
  status: z.enum(['approved', 'needs-rerun', 'blocked']),
  score: z.number().min(0).max(100),
  summary: z.string(),
  findings: z.array(StudioReviewFindingSchema),
  recommendations: z.array(z.string()),
  rerunCommand: z.string().optional(),
});
export type StudioReviewResult = z.infer<typeof StudioReviewResultSchema>;

export const StudioReviewCallbackDeliverySchema = z.object({
  callbackUrl: z.string(),
  eventType: z.literal('studio.review.completed'),
  reviewId: z.string(),
  projectName: z.string(),
  deliveredAt: z.string(),
  statusCode: z.number().int().optional(),
});
export type StudioReviewCallbackDelivery = z.infer<typeof StudioReviewCallbackDeliverySchema>;
