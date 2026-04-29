import { describe, expect, it } from 'vitest';

import type { RenderJob, TimelinePlan } from '@packages/types/studioSchemas.js';
import { prepareResolveTimelineImportFlow } from '@packages/utils/resolveBridgeTool.js';

describe('resolveBridgeTool', () => {
  it('builds a Resolve handoff flow from a timeline plan', () => {
    const timelinePlan: TimelinePlan = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      style: 'elegant',
      targetDurationSec: 12,
      inputSummary: { clipCount: 2, totalDurationSec: 12 },
      segments: [
        { id: 'hero-opening-1', type: 'hero-opening', title: 'Hero opening', targetDurationSec: 6, intensity: 0.7, notes: [], clipIds: ['clip-1'] },
        { id: 'cta-ending-2', type: 'cta-ending', title: 'CTA ending', targetDurationSec: 6, intensity: 0.5, notes: [], clipIds: ['clip-2'] },
      ],
      timeline: [
        { assetId: 'clip-1', assetPath: 'C:\\clips\\clip-1.mp4', segmentId: 'hero-opening-1', startSec: 0, endSec: 3, placementSec: 0, score: 90, rationale: 'hero', transitionAfter: 'cut' },
        { assetId: 'clip-2', assetPath: 'C:\\clips\\clip-2.mp4', segmentId: 'cta-ending-2', startSec: 0, endSec: 3, placementSec: 6, score: 88, rationale: 'ending', transitionAfter: 'fade' },
      ],
      markers: [{ timeSec: 0, label: 'Hero opening', color: 'Blue', note: 'start' }],
      warnings: [],
      notes: [],
    };
    const renderJobs: RenderJob[] = [{
      id: 'job-1',
      timelineName: 'vv-fashion-master-16x9',
      outputPath: 'C:\\out\\vv-fashion-master-16x9.mp4',
      expectedDurationSec: 12,
      status: 'planned',
      notes: [],
      resolveOperations: [],
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
    }];

    const flow = prepareResolveTimelineImportFlow({ projectName: 'vv-fashion', timelinePlan, renderJobs });

    expect(flow.projectName).toBe('vv-fashion');
    expect(flow.operations.map((item) => item.command)).toEqual([
      'create_or_open_project',
      'create_bins',
      'import_media',
      'create_timeline',
      'append_clips',
      'add_markers',
      'queue_render',
    ]);
  });
});
