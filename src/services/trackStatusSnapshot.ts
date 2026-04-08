import { inferTrackGroup, normalizeTrackGroup, type TrackGroupId } from '../utils/trackGroups.js';
import type { ProjectState, TrackMetadata } from './trackStateManager.js';
import type {
  TrackBucket,
  TrackLifecycleStatus,
  TrackPriority,
  TrackStatusBusinessGroupStats,
  TrackStatusOverallStats,
  TrackStatusRecommendation,
  TrackStatusSnapshot,
  TrackStatusTrack,
} from '../types/trackStatus.js';

const PRIORITY_ORDER: Record<TrackPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function normalizeGroup(track: TrackMetadata): TrackGroupId {
  return (
    normalizeTrackGroup(track.group) ??
    inferTrackGroup({
      id: track.id,
      name: track.name,
      title: track.name,
      tags: track.tags,
    })
  );
}

function normalizeStatus(status: TrackMetadata['status']): TrackLifecycleStatus {
  if (status === 'proposed' || status === 'active' || status === 'completed' || status === 'archived') {
    return status;
  }

  return status === 'paused' ? 'paused' : 'active';
}

function toSnapshotTrack(track: TrackMetadata): TrackStatusTrack {
  return {
    id: track.id,
    title: track.name,
    status: normalizeStatus(track.status),
    priority: track.priority,
    progress: track.progress,
    group: normalizeGroup(track),
    assignee: track.assignee,
    updated: track.updated,
    completed: track.completed,
  };
}

function bucketTrack(track: TrackStatusTrack): TrackBucket {
  if (track.status === 'proposed') return 'proposed';
  if (track.status === 'completed') return 'completed';
  if (track.status === 'archived') return 'archived';
  return 'active';
}

function sortTracks(tracks: TrackStatusTrack[]): TrackStatusTrack[] {
  return [...tracks].sort((left, right) => {
    const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const progressDiff = left.progress - right.progress;
    if (progressDiff !== 0) {
      return progressDiff;
    }

    return left.title.localeCompare(right.title);
  });
}

function groupTracks(tracks: TrackStatusTrack[]): Record<TrackBucket, TrackStatusTrack[]> {
  const grouped: Record<TrackBucket, TrackStatusTrack[]> = {
    active: [],
    proposed: [],
    completed: [],
    archived: [],
  };

  for (const track of tracks) {
    grouped[bucketTrack(track)].push(track);
  }

  return {
    active: sortTracks(grouped.active),
    proposed: sortTracks(grouped.proposed),
    completed: sortTracks(grouped.completed),
    archived: sortTracks(grouped.archived),
  };
}

function countByPriority(tracks: TrackStatusTrack[]): Record<TrackPriority, number> {
  const counts: Record<TrackPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const track of tracks) {
    counts[track.priority] += 1;
  }

  return counts;
}

function averageProgress(tracks: TrackStatusTrack[]): number {
  if (tracks.length === 0) {
    return 0;
  }

  const totalProgress = tracks.reduce((sum, track) => sum + track.progress, 0);
  return Math.round(totalProgress / tracks.length);
}

function buildRecommendation(
  activeTracks: TrackStatusTrack[],
  proposedTracks: TrackStatusTrack[],
  completedTracks: TrackStatusTrack[],
  archivedTracks: TrackStatusTrack[],
): TrackStatusRecommendation {
  const focusTrack = activeTracks[0] ?? proposedTracks[0] ?? completedTracks[0] ?? archivedTracks[0];

  if (!focusTrack) {
    return {
      headline: 'Nincs elérhető business track',
      rationale: 'A business csoport jelenleg üres, ezért új track indítása vagy besorolás szükséges.',
      nextSteps: [
        'Hozz létre egy új business tracket a legfontosabb üzleti célhoz.',
        'Sorold be a meglévő trackeket a business csoportba, ha ide tartoznak.',
      ],
    };
  }

  if (activeTracks.length > 0) {
    return {
      headline: `Fókusz: ${focusTrack.title}`,
      rationale:
        `A ${focusTrack.priority.toUpperCase()} prioritású aktív business track jelenleg ${focusTrack.progress}% készültségen áll.`,
      focusTrackId: focusTrack.id,
      focusTrackTitle: focusTrack.title,
      nextSteps: [
        focusTrack.progress < 50
          ? 'Zárd le a legnagyobb üzleti kockázatú részfeladatokat.'
          : 'Fejezd be a nyitott részfeladatokat és validáld az eredményt.',
        'Frissítsd a meta.json progress mezőjét és a kapcsolódó TODO-kat.',
        'Ha ez a track blokkol más business feladatokat, tisztázd a következő függőséget.',
      ],
    };
  }

  if (proposedTracks.length > 0) {
    return {
      headline: `Indítsd el: ${focusTrack.title}`,
      rationale:
        `A legérettebb javasolt business track ${focusTrack.priority.toUpperCase()} prioritású, ezért ez adja a legjobb következő belépési pontot.`,
      focusTrackId: focusTrack.id,
      focusTrackTitle: focusTrack.title,
      nextSteps: [
        'Erősítsd meg a scope-ot és a sikerkritériumokat.',
        'Válaszd ki az első végrehajtási milestone-t.',
        'Mozgasd a tracket aktív állapotba, ha a feltételek készen állnak.',
      ],
    };
  }

  if (completedTracks.length > 0) {
    return {
      headline: `Lezárásra kész: ${focusTrack.title}`,
      rationale:
        'A business csoportban már csak befejezett vagy archivált trackek vannak, így a következő lépés a lezárás és rendrakás.',
      focusTrackId: focusTrack.id,
      focusTrackTitle: focusTrack.title,
      nextSteps: [
        'Ellenőrizd, hogy minden deliverable dokumentálva van-e.',
        'Archiváld vagy zárd le a kész trackeket.',
        'Készítsd elő a következő business tracket a priorizáláshoz.',
      ],
    };
  }

  return {
    headline: `Archiválás és karbantartás: ${focusTrack.title}`,
    rationale:
      'A business csoportban jelenleg csak archivált trackek vannak, ezért a következő lépés az állapot áttekintése és a backlog tisztítása.',
    focusTrackId: focusTrack.id,
    focusTrackTitle: focusTrack.title,
    nextSteps: [
      'Ellenőrizd az archivált business trackek státuszát és dokumentációját.',
      'Nyiss új business tracket, ha friss üzleti cél érkezett.',
    ],
  };
}

export function buildTrackStatusSnapshot(state: Readonly<ProjectState>): TrackStatusSnapshot {
  const normalizedTracks = state.tracks.map(toSnapshotTrack);
  const grouped = groupTracks(normalizedTracks);
  const businessTracks = normalizedTracks.filter((track) => track.group === 'business');
  const businessGrouped = groupTracks(businessTracks);
  const priorityCounts = countByPriority(businessTracks);

  const overallStats: TrackStatusOverallStats = {
    total: normalizedTracks.length,
    active: grouped.active.length,
    proposed: grouped.proposed.length,
    completed: grouped.completed.length,
    archived: grouped.archived.length,
  };

  const businessGroupStats: TrackStatusBusinessGroupStats = {
    total: businessTracks.length,
    active: businessGrouped.active.length,
    proposed: businessGrouped.proposed.length,
    completed: businessGrouped.completed.length,
    archived: businessGrouped.archived.length,
    averageProgress: averageProgress(businessTracks),
    critical: priorityCounts.critical,
    high: priorityCounts.high,
    medium: priorityCounts.medium,
    low: priorityCounts.low,
  };

  const recommendation = buildRecommendation(
    businessGrouped.active,
    businessGrouped.proposed,
    businessGrouped.completed,
    businessGrouped.archived,
  );

  return {
    success: true,
    checkedAt: new Date().toISOString(),
    overallStats,
    businessGroupStats,
    activeBusinessTracks: businessGrouped.active,
    proposedBusinessTracks: businessGrouped.proposed,
    completedBusinessTracks: businessGrouped.completed,
    archivedBusinessTracks: businessGrouped.archived,
    recommendation,
  };
}

function renderTrackLine(track: TrackStatusTrack): string {
  const statusSuffix = track.status !== 'active' ? ` · ${track.status}` : '';
  const assigneeSuffix = track.assignee ? ` · ${track.assignee}` : '';
  return `- [${track.priority.toUpperCase()}] ${track.title} — ${track.progress}%${statusSuffix}${assigneeSuffix}`;
}

function renderTrackSection(title: string, tracks: TrackStatusTrack[]): string {
  const lines = [`## ${title} (${tracks.length})`];

  if (tracks.length === 0) {
    lines.push('- (none)');
    return lines.join('\n');
  }

  for (const track of tracks) {
    lines.push(renderTrackLine(track));
  }

  return lines.join('\n');
}

export function formatTrackStatusSnapshot(snapshot: TrackStatusSnapshot): string {
  const lines: string[] = [
    '📊 KKV Masterplan Status Snapshot',
    `Checked at: ${snapshot.checkedAt}`,
    `Overall: ${snapshot.overallStats.total} total | ${snapshot.overallStats.active} active | ${snapshot.overallStats.proposed} proposed | ${snapshot.overallStats.completed} completed | ${snapshot.overallStats.archived} archived`,
    `Business: ${snapshot.businessGroupStats.total} total | ${snapshot.businessGroupStats.active} active | ${snapshot.businessGroupStats.proposed} proposed | ${snapshot.businessGroupStats.completed} completed | ${snapshot.businessGroupStats.archived} archived | avg progress ${snapshot.businessGroupStats.averageProgress}%`,
    `Priority mix: critical ${snapshot.businessGroupStats.critical} | high ${snapshot.businessGroupStats.high} | medium ${snapshot.businessGroupStats.medium} | low ${snapshot.businessGroupStats.low}`,
    '',
    '## Recommendation',
    snapshot.recommendation.headline,
    snapshot.recommendation.rationale,
  ];

  if (snapshot.recommendation.focusTrackTitle) {
    lines.push(`Focus track: ${snapshot.recommendation.focusTrackTitle}`);
  }

  if (snapshot.recommendation.nextSteps.length > 0) {
    lines.push('Next steps:');
    snapshot.recommendation.nextSteps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  }

  lines.push('');
  lines.push(renderTrackSection('Active business tracks', snapshot.activeBusinessTracks));
  lines.push('');
  lines.push(renderTrackSection('Proposed business tracks', snapshot.proposedBusinessTracks));
  lines.push('');
  lines.push(renderTrackSection('Completed business tracks', snapshot.completedBusinessTracks));
  lines.push('');
  lines.push(renderTrackSection('Archived business tracks', snapshot.archivedBusinessTracks));

  return lines.join('\n');
}
