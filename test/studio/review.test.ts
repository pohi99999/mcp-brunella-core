import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { describe, expect, it, vi } from 'vitest';

import { StudioReviewerAgent } from '../../src/agents/StudioReviewerAgent.js';
import { buildStudioReview, reviewStudioRun, studioPipelineReportPath } from '../../src/cli/studioRuntime.js';
import type { PipelineRunReport } from '../../src/schemas/studioSchemas.js';

function createPipelineReport(overrides: Partial<PipelineRunReport> = {}): PipelineRunReport {
  return {
    pipelineId: 'pipeline-1',
    projectName: 'vv-fashion',
    createdAt: new Date().toISOString(),
    status: 'completed',
    inputDir: 'F:\\media\\vv-fashion',
    outputDir: 'out/studio/vv-fashion',
    assets: [],
    renderJobs: [
      {
        id: 'render-master',
        preset: {
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
          description: 'master',
        },
        timelineName: 'vv-fashion-master',
        outputPath: 'out/studio/vv-fashion/vv-fashion-master.mp4',
        expectedDurationSec: 12,
        status: 'completed',
        resolveOperations: [],
        notes: [],
      },
    ],
    qcReports: [
      {
        filePath: 'out/studio/vv-fashion/vv-fashion-master.mp4',
        checkedAt: new Date().toISOString(),
        passed: true,
        issues: [],
        stats: {},
      },
    ],
    warnings: [],
    notes: [],
    timelinePlan: {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      style: 'elegant',
      targetDurationSec: 12,
      inputSummary: { clipCount: 1, totalDurationSec: 12 },
      segments: [],
      timeline: [],
      markers: [],
      warnings: [],
      notes: [],
    },
    ...overrides,
  };
}

describe('Studio review runtime', () => {
  it('approves a clean Studio pipeline report', () => {
    const review = buildStudioReview({
      report: createPipelineReport(),
      pipelineReportPath: 'temp/studio/vv-fashion/manifests/pipeline-report.json',
    });

    expect(review.status).toBe('approved');
    expect(review.score).toBe(100);
    expect(review.findings).toHaveLength(0);
    expect(review.recommendations[0]).toContain('Approve the delivery');
    expect(review.rerunCommand).toContain('brunella studio full-pipeline');
  });

  it('marks a partial report with warnings as needs-rerun', () => {
    const review = buildStudioReview({
      report: createPipelineReport({
        status: 'partial',
        warnings: ['Timeline contains a transition warning.'],
        timelinePlan: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          style: 'cinematic',
          targetDurationSec: 12,
          inputSummary: { clipCount: 1, totalDurationSec: 12 },
          segments: [],
          timeline: [],
          markers: [],
          warnings: ['Audio ducking needs retune.'],
          notes: [],
        },
        qcReports: [
          {
            filePath: 'out/studio/vv-fashion/vv-fashion-master.mp4',
            checkedAt: new Date().toISOString(),
            passed: true,
            issues: [
              { severity: 'warning', code: 'peak-risk', message: 'Audio peak needs review.' },
            ],
            stats: {},
          },
        ],
      }),
      pipelineReportPath: 'temp/studio/vv-fashion/manifests/pipeline-report.json',
    });

    expect(review.status).toBe('needs-rerun');
    expect(review.score).toBeLessThan(100);
    expect(review.findings.some((finding) => finding.source === 'qc')).toBe(true);
    expect(review.recommendations.join(' ')).toContain('rerun');
  });

  it('surfaces music intelligence findings from audio-plan heuristics', () => {
    const review = buildStudioReview({
      report: createPipelineReport({
        timelinePlan: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          style: 'elegant',
          targetDurationSec: 12,
          musicTrackPath: 'F:\\media\\vv-fashion\\music.mp3',
          inputSummary: { clipCount: 1, totalDurationSec: 12 },
          segments: [
            {
              id: 'hero',
              type: 'hero-opening',
              title: 'Hero opening',
              targetDurationSec: 6,
              intensity: 0.35,
              notes: [],
              clipIds: ['clip-1'],
            },
            {
              id: 'close',
              type: 'emotional-close',
              title: 'Emotional close',
              targetDurationSec: 6,
              intensity: 0.75,
              notes: [],
              clipIds: ['clip-2'],
            },
          ],
          timeline: [
            {
              assetId: 'asset-1',
              assetPath: 'F:\\media\\vv-fashion\\clip-1.mp4',
              segmentId: 'hero',
              startSec: 0,
              endSec: 6,
              placementSec: 0,
              score: 88,
              rationale: 'Hero pass',
              transitionAfter: 'cross-dissolve',
            },
          ],
          markers: [],
          warnings: [],
          notes: [],
        },
        audioPlan: {
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          style: 'elegant',
          musicTrackPath: 'F:\\media\\vv-fashion\\music.mp3',
          trackDurationSec: 6,
          estimatedBpm: 92,
          targetLufs: -8,
          beatMarkers: [
            { timeSec: 0, strength: 1, label: 'phrase' },
            { timeSec: 2, strength: 0.55, label: 'beat' },
          ],
          cues: [
            { timeSec: 0, type: 'fade-in', note: 'Fade in' },
            { timeSec: 5, type: 'fade-out', note: 'Fade out' },
          ],
          ducking: [],
          fadeInSec: 0.8,
          fadeOutSec: 1.2,
          notes: [],
          warnings: [],
        },
      }),
      pipelineReportPath: 'temp/studio/vv-fashion/manifests/pipeline-report.json',
    });

    expect(review.status).toBe('needs-rerun');
    expect(review.findings.some((finding) => finding.source === 'audio' && finding.code === 'audio-track-shorter-than-timeline')).toBe(true);
    expect(review.findings.some((finding) => finding.code === 'audio-sparse-beat-map')).toBe(true);
    expect(review.findings.some((finding) => finding.code === 'audio-missing-ducking-plan')).toBe(true);
    expect(review.findings.some((finding) => finding.code === 'audio-target-lufs-outlier')).toBe(true);
    expect(review.recommendations.join(' ')).toContain('music track');
  });

  it('blocks a report with render or QC errors', () => {
    const review = buildStudioReview({
      report: createPipelineReport({
        status: 'failed',
        renderJobs: [
          {
            id: 'render-master',
            preset: {
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
              description: 'master',
            },
            timelineName: 'vv-fashion-master',
            outputPath: 'out/studio/vv-fashion/vv-fashion-master.mp4',
            expectedDurationSec: 12,
            status: 'failed',
            resolveOperations: [],
            notes: [],
          },
        ],
        qcReports: [
          {
            filePath: 'out/studio/vv-fashion/vv-fashion-master.mp4',
            checkedAt: new Date().toISOString(),
            passed: false,
            issues: [
              { severity: 'error', code: 'missing-video', message: 'Render has no video stream.' },
            ],
            stats: {},
          },
        ],
      }),
      pipelineReportPath: 'temp/studio/vv-fashion/manifests/pipeline-report.json',
    });

    expect(review.status).toBe('blocked');
    expect(review.findings.some((finding) => finding.severity === 'error')).toBe(true);
    expect(review.recommendations[0]).toContain('blocking render');
  });

  it('derives the default pipeline report path from a project name', () => {
    expect(studioPipelineReportPath('VV Fashion Drop')).toMatch(/temp[\\/]studio[\\/]VV-Fashion-Drop[\\/]manifests[\\/]pipeline-report\.json$/);
  });

  it('reads a report file and produces a review result', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-review-'));
    try {
      const reportPath = path.join(tempRoot, 'pipeline-report.json');
      const report = createPipelineReport({ projectName: 'vv-review', outputDir: 'out/studio/vv-review' });
      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

      const result = await reviewStudioRun({ pipelineReportPath: reportPath });

      expect(result.pipelineReportPath).toBe(reportPath);
      expect(result.review.projectName).toBe('vv-review');
      expect(result.review.status).toBe('approved');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('delivers a webhook callback when callbackUrl is provided', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-review-callback-'));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const reportPath = path.join(tempRoot, 'pipeline-report.json');
      const report = createPipelineReport({ projectName: 'vv-review-callback', outputDir: 'out/studio/vv-review-callback' });
      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

      const result = await reviewStudioRun({
        pipelineReportPath: reportPath,
        callbackUrl: 'https://example.com/webhooks/studio-review',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/webhooks/studio-review',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(result.callbackDelivery?.callbackUrl).toBe('https://example.com/webhooks/studio-review');
      expect(result.callbackDelivery?.eventType).toBe('studio.review.completed');
      expect(result.callbackDelivery?.statusCode).toBe(204);
    } finally {
      vi.unstubAllGlobals();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('executes the StudioReviewerAgent against a report path', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'brunella-studio-review-agent-'));
    try {
      const reportPath = path.join(tempRoot, 'pipeline-report.json');
      const report = createPipelineReport({ projectName: 'vv-review-agent', outputDir: 'out/studio/vv-review-agent' });
      await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
      vi.stubGlobal('fetch', fetchMock);

      const agent = new StudioReviewerAgent();
      const result = await agent.executeTask({ task: 'review studio report', payload: { pipelineReportPath: reportPath, callbackUrl: 'https://example.com/webhooks/studio-review' } });

      expect(result.success).toBe(true);
      expect(result.status).toBe('approved');
      expect(result.metadata?.status).toBe('approved');
      expect(result.metadata?.findings).toBe(0);
      expect(result.metadata?.callbackStatus).toBe('sent');
    } finally {
      vi.unstubAllGlobals();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
