import type { MediaAsset, StorySegment, StorySegmentType, StudioEditStyle, TimelineClip, TimelineMarker, TimelinePlan } from '../../schemas/studioSchemas.js';

const SEGMENT_ORDER: StorySegmentType[] = [
  'hero-opening',
  'detail-montage',
  'silhouette-motion',
  'emotional-close',
  'cta-ending',
];

const STYLE_TRANSITIONS: Record<StudioEditStyle, TimelineClip['transitionAfter']> = {
  elegant: 'cross-dissolve',
  energetic: 'cut',
  cinematic: 'dip-to-color',
  'luxury-minimal': 'fade',
};

function segmentWeights(style: StudioEditStyle): number[] {
  if (style === 'energetic') return [0.16, 0.24, 0.28, 0.18, 0.14];
  if (style === 'cinematic') return [0.2, 0.2, 0.24, 0.22, 0.14];
  if (style === 'luxury-minimal') return [0.22, 0.18, 0.2, 0.24, 0.16];
  return [0.2, 0.22, 0.22, 0.2, 0.16];
}

function segmentTitles(type: StorySegmentType): string {
  switch (type) {
    case 'hero-opening':
      return 'Hero opening';
    case 'detail-montage':
      return 'Detail montage';
    case 'silhouette-motion':
      return 'Silhouette / motion';
    case 'emotional-close':
      return 'Emotional close';
    case 'cta-ending':
      return 'CTA ending';
  }
}

function preferredTags(type: StorySegmentType): string[] {
  switch (type) {
    case 'hero-opening':
      return ['opening', 'hero', 'video'];
    case 'detail-montage':
      return ['detail', 'montage', 'video'];
    case 'silhouette-motion':
      return ['motion', 'video'];
    case 'emotional-close':
      return ['hero', 'misc', 'video'];
    case 'cta-ending':
      return ['ending', 'hero', 'video'];
  }
}

function createSegments(style: StudioEditStyle, targetDurationSec: number): StorySegment[] {
  const weights = segmentWeights(style);
  return SEGMENT_ORDER.map((type, index) => ({
    id: `${type}-${index + 1}`,
    type,
    title: segmentTitles(type),
    targetDurationSec: Number((targetDurationSec * weights[index]).toFixed(2)),
    intensity: type === 'hero-opening' ? 0.75 : type === 'detail-montage' ? 0.58 : type === 'silhouette-motion' ? 0.86 : type === 'emotional-close' ? 0.48 : 0.62,
    notes: [],
    clipIds: [],
  }));
}

function pickAssetsForSegment(type: StorySegmentType, assets: MediaAsset[], usedAssetIds: Set<string>): MediaAsset[] {
  const preferred = preferredTags(type);
  const ranked = [...assets].sort((left, right) => {
    const leftTagScore = preferred.filter((tag) => left.tags.includes(tag)).length;
    const rightTagScore = preferred.filter((tag) => right.tags.includes(tag)).length;
    return (rightTagScore * 100 + right.qualityScore) - (leftTagScore * 100 + left.qualityScore);
  });

  const fresh = ranked.filter((asset) => !usedAssetIds.has(asset.id));
  return (fresh.length > 0 ? fresh : ranked).slice(0, 3);
}

export function assembleTimelinePlan(options: {
  assets: MediaAsset[];
  style: StudioEditStyle;
  targetDurationSec: number;
  musicTrackPath?: string;
}): TimelinePlan {
  const videoAssets = options.assets.filter((asset) => asset.type === 'video').sort((left, right) => right.qualityScore - left.qualityScore);
  const warnings: string[] = [];
  if (videoAssets.length === 0) {
    warnings.push('Nem található használható videó asset a rough-cut tervhez.');
  }

  const segments = createSegments(options.style, options.targetDurationSec);
  const timeline: TimelineClip[] = [];
  const markers: TimelineMarker[] = [];
  const usedAssetIds = new Set<string>();
  let placementSec = 0;

  for (const segment of segments) {
    const candidates = pickAssetsForSegment(segment.type, videoAssets, usedAssetIds);
    if (candidates.length === 0) {
      segment.notes.push('Nincs ideális klip, ezért ez a szegmens manuális szerkesztést igényelhet.');
      markers.push({ timeSec: placementSec, label: `${segment.title} needs clip`, color: 'Red', note: 'Manual clip selection required.' });
      placementSec += segment.targetDurationSec;
      continue;
    }

    const perClipDuration = Math.max(1, Number((segment.targetDurationSec / candidates.length).toFixed(2)));
    let localOffset = 0;
    for (const asset of candidates) {
      const maxWindow = Math.min(asset.durationSec || perClipDuration, perClipDuration);
      const clip: TimelineClip = {
        assetId: asset.id,
        assetPath: asset.path,
        segmentId: segment.id,
        startSec: 0,
        endSec: Number(maxWindow.toFixed(2)),
        placementSec: Number((placementSec + localOffset).toFixed(2)),
        score: asset.qualityScore,
        rationale: `${segment.title} <- ${asset.tags.join(', ') || 'untagged'} (${asset.qualityScore})`,
        transitionAfter: STYLE_TRANSITIONS[options.style],
      };
      timeline.push(clip);
      segment.clipIds.push(asset.id);
      localOffset += maxWindow;
      usedAssetIds.add(asset.id);
    }

    markers.push({
      timeSec: Number(placementSec.toFixed(2)),
      label: segment.title,
      color: segment.type === 'cta-ending' ? 'Yellow' : 'Blue',
      note: `${segment.type} start`,
    });
    placementSec += segment.targetDurationSec;
  }

  if (placementSec < options.targetDurationSec * 0.85) {
    warnings.push('A teljes tervezett idő rövidebb a célnál; hosszabb klip-szeletek vagy additional footage javasolt.');
  }

  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    style: options.style,
    targetDurationSec: options.targetDurationSec,
    musicTrackPath: options.musicTrackPath,
    inputSummary: {
      clipCount: videoAssets.length,
      totalDurationSec: Number(videoAssets.reduce((sum, asset) => sum + asset.durationSec, 0).toFixed(2)),
    },
    segments,
    timeline,
    markers,
    warnings,
    notes: [
      'A rough-cut terv determinisztikus scoring es segment-template alapú javaslat.',
      'A vegso ritmus es color finish Resolve/Fairlight finomitassal ajanlott.',
    ],
  };
}
