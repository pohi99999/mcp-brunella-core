import type { AudioBeatMarker, StudioEditStyle } from '@packages/types/studioSchemas.js';

const BPM_BY_STYLE: Record<StudioEditStyle, number> = {
  elegant: 92,
  energetic: 128,
  cinematic: 76,
  'luxury-minimal': 88,
};

export function estimateBpm(style: StudioEditStyle, hintedBpm?: number): number {
  if (typeof hintedBpm === 'number' && Number.isFinite(hintedBpm) && hintedBpm > 40 && hintedBpm < 220) {
    return hintedBpm;
  }

  return BPM_BY_STYLE[style];
}

export function buildBeatMarkers(options: {
  durationSec: number;
  style: StudioEditStyle;
  hintedBpm?: number;
}): AudioBeatMarker[] {
  const bpm = estimateBpm(options.style, options.hintedBpm);
  const secondsPerBeat = 60 / bpm;
  const markers: AudioBeatMarker[] = [];

  for (let cursor = 0; cursor <= options.durationSec + 0.001; cursor += secondsPerBeat) {
    const beatIndex = markers.length;
    const phraseIndex = beatIndex % 8;
    markers.push({
      timeSec: Number(cursor.toFixed(3)),
      strength: phraseIndex === 0 ? 1 : phraseIndex % 4 === 0 ? 0.8 : 0.55,
      label: phraseIndex === 0 ? 'phrase' : 'beat',
    });
  }

  return markers;
}
