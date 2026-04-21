export const TRACK_GROUP_IDS = ['business', 'nova', 'brunella', 'other'] as const;

export type TrackGroupId = (typeof TRACK_GROUP_IDS)[number];

export const TRACK_GROUP_LABELS: Record<TrackGroupId, string> = {
  business: 'Könyvelés / üzleti automatizálás',
  nova: 'Nova asszisztens',
  brunella: 'Brunella rendszer',
  other: 'Egyéb',
};

export const TRACK_GROUP_ORDER: TrackGroupId[] = ['business', 'nova', 'brunella', 'other'];

const GROUP_ALIAS_MAP: Record<string, TrackGroupId> = {
  business: 'business',
  bookkeeping: 'business',
  konyveles: 'business',
  finance: 'business',
  financial: 'business',
  accounting: 'business',
  sales: 'business',
  kkv: 'business',
  'konyveles uzleti automatizalas': 'business',
  'uzleti automatizalas': 'business',
  'business automation': 'business',
  nova: 'nova',
  'nova asszisztens': 'nova',
  assistant: 'nova',
  briefing: 'nova',
  'knowledge workflow': 'nova',
  'knowledge workflows': 'nova',
  gatekeeper: 'nova',
  brunella: 'brunella',
  system: 'brunella',
  'brunella rendszer': 'brunella',
  other: 'other',
  misc: 'other',
  egyeb: 'other',
};

const BUSINESS_KEYWORDS = [
  'kkv',
  'konyveles',
  'bookkeeping',
  'invoice',
  'szamlazz',
  'finance',
  'financial',
  'accounting',
  'crm',
  'lead',
  'sales',
  'marketing',
  'inventory',
  'logistics',
  'revenue',
  'customer service',
  'human resources',
  'hr',
  'timesheet',
  'onboarding',
  'leave approval',
  'leave approvals',
  'followup',
  'campaign',
  'real estate',
  'supply chain',
];

const NOVA_KEYWORDS = [
  'nova',
  'briefing',
  'reggeli briefing',
  'intelligens briefing',
  'daily briefing',
  'knowledge workflow',
  'knowledge workflows',
  'gatekeeper',
  'rag',
  'voice',
];

const BRUNELLA_KEYWORDS = [
  'brunella',
  'type safety',
  'technical debt',
  'dashboard',
  'conductor',
  'mcp',
  'cloudflare',
  'workers migration',
  'identity project maintainer',
  'reflection continual learning',
  'zero prompt',
  'bootstrap single source',
  'precommit',
  'smoke test',
  'build',
  'test infrastructure',
  'test cadence',
  'error handling',
  'logging',
  'windows bridge',
  'vscode',
  'doc code auto sync',
  'apify',
  'jules',
  'copilot self improvement',
  'agent runtime',
  'agent health',
  'agent coordinator',
  'deadlock',
  'system audit',
  'modular state refactor',
  'robotkez',
  'remote layer',
  'ephemeral bridge',
  'federation',
  'learning loop',
  'self healing',
  'orchestrator',
  'swarm',
  'browser use',
  'browser',
  'autogen',
  'github models',
  'project maintainer',
  'zero mock',
  'bootstrap health',
  'readme bootstrap',
  'personal assistant',
];

function normalizeTrackText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hasAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(normalizeTrackText(keyword)));
}

export function normalizeTrackGroup(group: unknown): TrackGroupId | undefined {
  if (typeof group !== 'string') {
    return undefined;
  }

  const normalized = normalizeTrackText(group);
  return GROUP_ALIAS_MAP[normalized];
}

export interface TrackGroupSource {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  sourceDocument?: string;
  tags?: string[];
  group?: unknown;
}

export function inferTrackGroup(source: TrackGroupSource): TrackGroupId {
  const explicit = normalizeTrackGroup(source.group);
  if (explicit) {
    return explicit;
  }

  const haystack = normalizeTrackText(
    [
      source.id,
      source.name,
      source.title,
      source.description,
      source.sourceDocument,
      ...(source.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (hasAnyKeyword(haystack, BUSINESS_KEYWORDS)) {
    return 'business';
  }

  if (hasAnyKeyword(haystack, NOVA_KEYWORDS)) {
    return 'nova';
  }

  if (hasAnyKeyword(haystack, BRUNELLA_KEYWORDS)) {
    return 'brunella';
  }

  return 'other';
}

export function getTrackGroupLabel(group: TrackGroupId | string | undefined): string {
  if (!group) {
    return TRACK_GROUP_LABELS.other;
  }

  const normalized = normalizeTrackGroup(group);
  return normalized ? TRACK_GROUP_LABELS[normalized] : TRACK_GROUP_LABELS.other;
}

export function groupTracksByGroup<T extends { group: TrackGroupId }>(tracks: T[]): Record<TrackGroupId, T[]> {
  const grouped: Record<TrackGroupId, T[]> = {
    business: [],
    nova: [],
    brunella: [],
    other: [],
  };

  for (const track of tracks) {
    grouped[track.group].push(track);
  }

  return grouped;
}
