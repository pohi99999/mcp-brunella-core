import type { AudioCue, AudioPlan, DuckingPoint, TimelinePlan } from '../../schemas/studioSchemas.js';

export function buildSegmentIntensityMap(timelinePlan: TimelinePlan): Array<{ segmentId: string; startSec: number; endSec: number; intensity: number }> {
  let cursor = 0;
  return timelinePlan.segments.map((segment) => {
    const item = {
      segmentId: segment.id,
      startSec: Number(cursor.toFixed(3)),
      endSec: Number((cursor + segment.targetDurationSec).toFixed(3)),
      intensity: segment.intensity,
    };
    cursor += segment.targetDurationSec;
    return item;
  });
}

export function buildDuckingPlan(options: {
  timelinePlan: TimelinePlan;
  voiceoverWindows?: Array<{ startSec: number; endSec: number; label?: string }>;
}): DuckingPoint[] {
  const points: DuckingPoint[] = [];
  const segments = buildSegmentIntensityMap(options.timelinePlan);

  for (const window of options.voiceoverWindows ?? []) {
    points.push({
      startSec: window.startSec,
      endSec: window.endSec,
      gainDb: -9,
      reason: window.label ? `voiceover:${window.label}` : 'voiceover-window',
    });
  }

  for (const segment of segments) {
    if (segment.intensity < 0.45) {
      points.push({
        startSec: segment.startSec,
        endSec: segment.endSec,
        gainDb: -2.5,
        reason: `segment:${segment.segmentId}:low-intensity-presence`,
      });
    }
  }

  return points.sort((left, right) => left.startSec - right.startSec);
}

export function buildAudioCues(timelinePlan: TimelinePlan): AudioCue[] {
  const cues: AudioCue[] = [
    { timeSec: 0, type: 'fade-in', note: 'Nyitó zenei fade-in a hero opening alatt.' },
  ];

  for (const clip of timelinePlan.timeline) {
    if (clip.transitionAfter !== 'cut') {
      cues.push({
        timeSec: clip.endSec,
        type: 'transition-sfx',
        note: `${clip.transitionAfter} transition accent a ${clip.segmentId} után.`,
      });
    }
  }

  cues.push({
    timeSec: Math.max(0, timelinePlan.targetDurationSec - 1.2),
    type: 'fade-out',
    note: 'Záró fade-out az emotional close / CTA ending alatt.',
  });

  return cues.sort((left, right) => left.timeSec - right.timeSec);
}

export function buildAudioPlanNotes(audioPlan: Pick<AudioPlan, 'ducking' | 'cues'>): string[] {
  const notes: string[] = [];
  if (audioPlan.ducking.length === 0) {
    notes.push('Nincs explicit ducking ablak; Fairlight finomhangolás opcionálisan szükséges.');
  }
  if (audioPlan.cues.some((cue) => cue.type === 'transition-sfx')) {
    notes.push('Átmeneti SFX cue-k csak placeholderként kerültek a tervbe, manuális hangdizájn ajánlott.');
  }
  return notes;
}
