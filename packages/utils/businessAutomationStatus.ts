import { TRACK_GROUP_LABELS, type TrackGroupId } from './trackGroups.js';

const PRIORITY_ORDER: Record<'critical' | 'high' | 'medium' | 'low', number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface BusinessAutomationTrackSource {
  id: string;
  name: string;
  status: 'proposed' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low';
  progress: number;
  group: TrackGroupId;
  assignee?: string;
  updated?: string;
  completed?: string;
  _isArchived?: boolean;
}

export interface BusinessAutomationTrackItem {
  id: string;
  name: string;
  status: 'proposed' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low';
  progress: number;
  group: TrackGroupId;
  assignee?: string;
  updated?: string;
  completed?: string;
}

export interface BusinessAutomationStats {
  total: number;
  active: number;
  proposed: number;
  completed: number;
  archived: number;
  paused: number;
}

export interface BusinessAutomationRecommendation {
  id: string;
  type: 'focus' | 'promote' | 'archive' | 'unblock';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  rationale: string;
  targets: string[];
  evidence: string[];
}

export interface BusinessAutomationGroupSnapshot {
  id: TrackGroupId;
  label: string;
  stats: BusinessAutomationStats;
  active: BusinessAutomationTrackItem[];
  proposed: BusinessAutomationTrackItem[];
  completed: BusinessAutomationTrackItem[];
  archived: BusinessAutomationTrackItem[];
}

export interface BusinessAutomationStatusSnapshot {
  checkedAt: string;
  overallStats: BusinessAutomationStats;
  businessGroup: BusinessAutomationGroupSnapshot;
  nextSteps: {
    summary: string;
    recommendations: BusinessAutomationRecommendation[];
  };
}

export interface BusinessAutomationStatusResponse extends BusinessAutomationStatusSnapshot {
  success: boolean;
}

function isArchived(track: BusinessAutomationTrackSource): boolean {
  return track._isArchived || track.status === 'archived';
}

function getPriorityRank(priority: BusinessAutomationTrackSource['priority']): number {
  return PRIORITY_ORDER[priority] ?? PRIORITY_ORDER.medium;
}

function sortTracksForDisplay(
  tracks: BusinessAutomationTrackSource[],
): BusinessAutomationTrackSource[] {
  return [...tracks].sort((a, b) => {
    const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const progressDiff = b.progress - a.progress;
    if (progressDiff !== 0) {
      return progressDiff;
    }

    return a.name.localeCompare(b.name);
  });
}

function sortTracksForFocus(
  tracks: BusinessAutomationTrackSource[],
): BusinessAutomationTrackSource[] {
  return [...tracks].sort((a, b) => {
    const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const progressDiff = a.progress - b.progress;
    if (progressDiff !== 0) {
      return progressDiff;
    }

    return a.name.localeCompare(b.name);
  });
}

function toTrackItem(track: BusinessAutomationTrackSource): BusinessAutomationTrackItem {
  return {
    id: track.id,
    name: track.name,
    status: isArchived(track) ? 'archived' : track.status,
    priority: track.priority,
    progress: track.progress,
    group: track.group,
    assignee: track.assignee,
    updated: track.updated,
    completed: track.completed,
  };
}

function buildStats(tracks: BusinessAutomationTrackSource[]): BusinessAutomationStats {
  const stats: BusinessAutomationStats = {
    total: tracks.length,
    active: 0,
    proposed: 0,
    completed: 0,
    archived: 0,
    paused: 0,
  };

  for (const track of tracks) {
    if (isArchived(track)) {
      stats.archived += 1;
      continue;
    }

    if (track.status === 'active') {
      stats.active += 1;
    } else if (track.status === 'proposed') {
      stats.proposed += 1;
    } else if (track.status === 'completed') {
      stats.completed += 1;
    } else if (track.status === 'paused') {
      stats.paused += 1;
    }
  }

  return stats;
}

function buildRecommendationId(kind: string, suffix: string): string {
  return `business-${kind}-${suffix}`;
}

function buildNextSteps(
  active: BusinessAutomationTrackSource[],
  proposed: BusinessAutomationTrackSource[],
  completed: BusinessAutomationTrackSource[],
  paused: BusinessAutomationTrackSource[],
): BusinessAutomationStatusSnapshot['nextSteps'] {
  const recommendations: BusinessAutomationRecommendation[] = [];
  const primaryActive = sortTracksForFocus(active)[0];
  const primaryProposed = sortTracksForFocus(proposed)[0];

  let summary = 'Nincs nyitott business track a fókuszban.';

  if (primaryActive) {
    summary = `Fókusz az aktív business tracken: ${primaryActive.name}.`;
    recommendations.push({
      id: buildRecommendationId('focus', primaryActive.id),
      type: 'focus',
      priority: primaryActive.priority,
      title: `Folytasd: ${primaryActive.name}`,
      rationale: `Az aktív business track ${primaryActive.progress}% készültségnél tart, ezért ez legyen a következő operatív fókusz.`,
      targets: [primaryActive.id],
      evidence: [
        `status=${primaryActive.status}`,
        `priority=${primaryActive.priority}`,
        `progress=${primaryActive.progress}%`,
      ],
    });
  } else if (primaryProposed) {
    summary = `Nincs aktív business track; indítsd el a legfontosabb javasolt tételt: ${primaryProposed.name}.`;
    recommendations.push({
      id: buildRecommendationId('promote', primaryProposed.id),
      type: 'promote',
      priority: primaryProposed.priority,
      title: `Indítsd el: ${primaryProposed.name}`,
      rationale: 'A business streamben nincs aktív track, ezért a legjobb következő lépés egy priorizált javasolt tétel felvétele.',
      targets: [primaryProposed.id],
      evidence: [
        `status=${primaryProposed.status}`,
        `priority=${primaryProposed.priority}`,
        `progress=${primaryProposed.progress}%`,
      ],
    });
  } else if (paused.length > 0) {
    const primaryPaused = sortTracksForFocus(paused)[0];
    summary = `Nincs aktív vagy javasolt business track; vizsgáld meg a szüneteltetett tételt: ${primaryPaused.name}.`;
  }

  if (completed.length > 0) {
    const completedTargets = completed.map((track) => track.id);
    recommendations.push({
      id: buildRecommendationId('archive', completedTargets[0]),
      type: 'archive',
      priority: 'low',
      title: 'Archiváld a lezárt business trackeket',
      rationale: `${completed.length} kész business track még külön kezelt státuszban van; az archívum tisztán tartása segít a fókusz megtartásában.`,
      targets: completedTargets,
      evidence: completed.map((track) => `${track.id}:${track.progress}%`),
    });
  }

  if (paused.length > 0) {
    const pausedTargets = paused.map((track) => track.id);
    recommendations.push({
      id: buildRecommendationId('unblock', pausedTargets[0]),
      type: 'unblock',
      priority: 'medium',
      title: 'Oldd fel a szüneteltetett business trackeket',
      rationale: `${paused.length} business track szüneteltetett állapotban van, ezért érdemes újra átnézni a blokkoló tényezőket.`,
      targets: pausedTargets,
      evidence: paused.map((track) => `${track.id}:${track.priority}:${track.progress}%`),
    });
  }

  return {
    summary,
    recommendations: recommendations.slice(0, 3),
  };
}

export function buildBusinessAutomationStatusSnapshot(
  tracks: BusinessAutomationTrackSource[],
  checkedAt: string = new Date().toISOString(),
): BusinessAutomationStatusSnapshot {
  const overallStats = buildStats(tracks);
  const businessTracks = tracks.filter((track) => track.group === 'business');
  const businessStats = buildStats(businessTracks);

  const active = sortTracksForDisplay(
    businessTracks.filter((track) => !isArchived(track) && track.status === 'active'),
  ).map(toTrackItem);
  const proposed = sortTracksForDisplay(
    businessTracks.filter((track) => !isArchived(track) && track.status === 'proposed'),
  ).map(toTrackItem);
  const completed = sortTracksForDisplay(
    businessTracks.filter((track) => !isArchived(track) && track.status === 'completed'),
  ).map(toTrackItem);
  const archived = sortTracksForDisplay(
    businessTracks.filter((track) => isArchived(track)),
  ).map(toTrackItem);
  const paused = sortTracksForDisplay(
    businessTracks.filter((track) => !isArchived(track) && track.status === 'paused'),
  );

  return {
    checkedAt,
    overallStats,
    businessGroup: {
      id: 'business',
      label: TRACK_GROUP_LABELS.business,
      stats: businessStats,
      active,
      proposed,
      completed,
      archived,
    },
    nextSteps: buildNextSteps(
      businessTracks.filter((track) => !isArchived(track) && track.status === 'active'),
      businessTracks.filter((track) => !isArchived(track) && track.status === 'proposed'),
      businessTracks.filter((track) => !isArchived(track) && track.status === 'completed'),
      paused,
    ),
  };
}

function formatStatLine(stats: BusinessAutomationStats): string {
  return [
    `összesen ${stats.total}`,
    `aktív ${stats.active}`,
    `javasolt ${stats.proposed}`,
    `kész ${stats.completed}`,
    `archivált ${stats.archived}`,
    `szüneteltetett ${stats.paused}`,
  ].join(' | ');
}

function formatTrackLine(track: BusinessAutomationTrackItem): string {
  const assignee = track.assignee ? ` • ${track.assignee}` : '';
  const completed = track.completed ? ` • kész: ${track.completed}` : '';
  return `- [${track.priority.toUpperCase()}] ${track.progress}% ${track.name}${assignee}${completed}`;
}

function formatTrackSection(title: string, tracks: BusinessAutomationTrackItem[]): string[] {
  if (tracks.length === 0) {
    return [`${title}: (nincs)`];
  }

  return [title + ':', ...tracks.map((track) => formatTrackLine(track))];
}

export function formatBusinessAutomationStatusLines(
  snapshot: BusinessAutomationStatusSnapshot,
): string[] {
  return [
    'KKV üzleti automatizálás státusz',
    `Ellenőrizve: ${snapshot.checkedAt}`,
    `Összesen: ${formatStatLine(snapshot.overallStats)}`,
    `Business csoport: ${formatStatLine(snapshot.businessGroup.stats)}`,
    '',
    `Következő lépés: ${snapshot.nextSteps.summary}`,
    ...snapshot.nextSteps.recommendations.flatMap((recommendation) => [
      `  - [${recommendation.priority.toUpperCase()}] ${recommendation.title}`,
      `    ${recommendation.rationale}`,
    ]),
    '',
    ...formatTrackSection('Aktív business trackek', snapshot.businessGroup.active),
    '',
    ...formatTrackSection('Javasolt business trackek', snapshot.businessGroup.proposed),
    '',
    ...formatTrackSection('Kész business trackek', snapshot.businessGroup.completed),
    '',
    ...formatTrackSection('Archivált business trackek', snapshot.businessGroup.archived),
  ];
}
