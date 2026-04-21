import { getAuditLog, type AuditEntry } from '../auditLog.js';
import {
  phoenixEventBus,
  type PhoenixEventMap,
} from '../phoenixEventBus.js';
import {
  trustRegistry,
  type PeerIdentity,
  type PeerRuntimeKeyBinding,
  type TrustState,
} from './trustRegistry.js';

export type FederationEvidenceOutcome = 'allowed' | 'denied' | 'observed';
export type FederationEvidenceSource = 'audit' | 'phoenix';
export type FederationEvidenceKind =
  | 'peer_registered'
  | 'peer_revoked'
  | 'runtime_key_staged'
  | 'runtime_key_promoted'
  | 'route_denied';

export interface FederationEvidenceJournalEntry {
  id: string;
  timestamp: string;
  peerId: string | null;
  displayName: string | null;
  endpoint: string | null;
  trustState: TrustState | null;
  kind: FederationEvidenceKind;
  title: string;
  detail: string;
  outcome: FederationEvidenceOutcome;
  keyId: string | null;
  previousCurrentKeyId: string | null;
  reason: string | null;
  evidenceSources: FederationEvidenceSource[];
}

export interface FederationPeerEvidenceSummary {
  peerId: string;
  displayName: string;
  endpoint: string;
  trustState: TrustState;
  trustedAt: string | null;
  revokedAt: string | null;
  currentKeyId: string | null;
  nextKeyId: string | null;
  rotationState: 'stable' | 'staged' | 'missing' | 'revoked';
  lastEvidenceAt: string | null;
  latestAction: string | null;
  latestOutcome: FederationEvidenceOutcome | null;
  journalCount: number;
  registerCount: number;
  revokeCount: number;
  stageCount: number;
  promoteCount: number;
  routeDeniedCount: number;
}

export interface FederationEvidenceSnapshot {
  timestamp: string;
  peerFilter: string | null;
  limit: number;
  truncated: boolean;
  peers: FederationPeerEvidenceSummary[];
  journal: FederationEvidenceJournalEntry[];
  totals: {
    peerCount: number;
    trustedCount: number;
    pendingCount: number;
    revokedCount: number;
    peersWithNextKey: number;
    journalCount: number;
    deniedCount: number;
    registerCount: number;
    revokeCount: number;
    stageCount: number;
    promoteCount: number;
    routeDeniedCount: number;
  };
}

interface BuildFederationEvidenceOptions {
  limit?: number;
  peerId?: string;
}

interface NormalizedAuditEvidence extends FederationEvidenceJournalEntry {
  matched: boolean;
}

const MAX_SAMPLE_LIMIT = 200;
const MIN_SAMPLE_LIMIT = 40;
const AUDIT_MATCH_WINDOW_MS = 5 * 60 * 1000;

const FEDERATION_AUDIT_KIND = {
  'federation:register': 'peer_registered',
  'federation:revoke': 'peer_revoked',
  'federation:runtime-key:stage': 'runtime_key_staged',
  'federation:runtime-key:promote': 'runtime_key_promoted',
  'federation:route': 'route_denied',
} as const;

type FederationAuditAction = keyof typeof FEDERATION_AUDIT_KIND;

const FEDERATION_EVENT_NAMES = [
  'phoenix:federation_peer_registered',
  'phoenix:federation_peer_revoked',
  'phoenix:federation_runtime_key_staged',
  'phoenix:federation_runtime_key_promoted',
] as const;

type FederationEventName = typeof FEDERATION_EVENT_NAMES[number];

function isFederationAuditAction(action: string): action is FederationAuditAction {
  return Object.prototype.hasOwnProperty.call(FEDERATION_AUDIT_KIND, action);
}

function isFederationEventName(value: string): value is FederationEventName {
  return (FEDERATION_EVENT_NAMES as readonly string[]).includes(value);
}

function toTimeValue(timestamp: string): number | null {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? null : value;
}

function compareTimestampDesc(left: string, right: string): number {
  const leftValue = toTimeValue(left);
  const rightValue = toTimeValue(right);

  if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
    return rightValue - leftValue;
  }

  return right.localeCompare(left);
}

function buildEvidenceId(
  source: FederationEvidenceSource,
  kind: FederationEvidenceKind,
  peerId: string | null,
  timestamp: string,
  suffix?: string | null,
): string {
  return [source, kind, peerId ?? 'unknown', timestamp, suffix ?? 'entry'].join(':');
}

function buildTitle(kind: FederationEvidenceKind): string {
  switch (kind) {
    case 'peer_registered':
      return 'Partner regisztrálva';
    case 'peer_revoked':
      return 'Partner visszavonva';
    case 'runtime_key_staged':
      return 'Next kulcs stage-elve';
    case 'runtime_key_promoted':
      return 'Runtime kulcs promotálva';
    case 'route_denied':
      return 'Federation route tiltva';
  }
}

function parseAuditResource(resource: string | undefined): { peerId: string | null; keyId: string | null } {
  const normalized = resource?.trim();
  if (!normalized) {
    return { peerId: null, keyId: null };
  }

  const [peerId, keyId] = normalized.split('/', 2);
  return {
    peerId: peerId?.trim() || null,
    keyId: keyId?.trim() || null,
  };
}

function mergeReason(detail: string, reason: string | null): string {
  if (!reason) {
    return detail;
  }

  if (!detail) {
    return reason;
  }

  return detail.includes(reason) ? detail : `${detail} • ${reason}`;
}

function buildAuditDetail(
  action: FederationAuditAction,
  peerId: string | null,
  keyId: string | null,
  reason: string | undefined,
): string {
  switch (action) {
    case 'federation:register':
      return mergeReason(`Peer ID: ${peerId ?? 'unknown'}`, reason ?? null);
    case 'federation:revoke':
      return mergeReason(`Peer ID: ${peerId ?? 'unknown'}`, reason ?? 'manual revocation');
    case 'federation:runtime-key:stage':
      return mergeReason(`Key ID: ${keyId ?? 'unknown'}`, reason ?? null);
    case 'federation:runtime-key:promote':
      return mergeReason(`Key ID: ${keyId ?? 'unknown'}`, reason ?? null);
    case 'federation:route':
      return mergeReason(`Peer ID: ${peerId ?? 'unknown'}`, reason ?? 'Route denied');
  }
}

function normalizeAuditEntry(entry: AuditEntry): NormalizedAuditEvidence | null {
  if (entry.agentName !== 'TrustRegistry' || !isFederationAuditAction(entry.action)) {
    return null;
  }

  const { peerId, keyId } = parseAuditResource(entry.resource);
  const kind = FEDERATION_AUDIT_KIND[entry.action];
  return {
    id: buildEvidenceId('audit', kind, peerId, entry.timestamp, keyId ?? String(entry.id ?? '0')),
    timestamp: entry.timestamp,
    peerId,
    displayName: null,
    endpoint: null,
    trustState: null,
    kind,
    title: buildTitle(kind),
    detail: buildAuditDetail(entry.action, peerId, keyId, entry.reason),
    outcome: entry.result === 'DENIED' ? 'denied' : 'allowed',
    keyId,
    previousCurrentKeyId: null,
    reason: entry.reason ?? null,
    evidenceSources: ['audit'],
    matched: false,
  };
}

function buildPhoenixDetail(
  kind: FederationEvidenceKind,
  keyId: string | null,
  previousCurrentKeyId: string | null,
  reason: string | null,
  trustState: TrustState | null,
  endpoint: string | null,
): string {
  switch (kind) {
    case 'peer_registered':
      return [endpoint, trustState ? `állapot: ${trustState}` : null]
        .filter((value): value is string => Boolean(value))
        .join(' • ');
    case 'peer_revoked':
      return mergeReason('Federation kapcsolat letiltva', reason);
    case 'runtime_key_staged':
      return [
        keyId ? `Key ID: ${keyId}` : null,
        previousCurrentKeyId ? `előző current: ${previousCurrentKeyId}` : 'nincs korábbi current',
      ]
        .filter((value): value is string => Boolean(value))
        .join(' • ');
    case 'runtime_key_promoted':
      return mergeReason(
        keyId ? `Key ID: ${keyId}` : 'Runtime kulcs current állapotba került',
        reason,
      );
    case 'route_denied':
      return mergeReason('Federation route művelet tiltva', reason);
  }
}

function normalizePhoenixEntry(
  entry: { event: string; data: unknown; timestamp: string },
): FederationEvidenceJournalEntry | null {
  if (!isFederationEventName(entry.event)) {
    return null;
  }

  switch (entry.event) {
    case 'phoenix:federation_peer_registered': {
      const data = entry.data as PhoenixEventMap['phoenix:federation_peer_registered'];
      return {
        id: buildEvidenceId('phoenix', 'peer_registered', data.peerId, data.timestamp, data.trustState),
        timestamp: data.timestamp,
        peerId: data.peerId,
        displayName: data.displayName,
        endpoint: data.endpoint,
        trustState: (data.trustState as TrustState) ?? null,
        kind: 'peer_registered',
        title: buildTitle('peer_registered'),
        detail: buildPhoenixDetail('peer_registered', null, null, null, data.trustState as TrustState, data.endpoint),
        outcome: 'allowed',
        keyId: null,
        previousCurrentKeyId: null,
        reason: null,
        evidenceSources: ['phoenix'],
      };
    }
    case 'phoenix:federation_peer_revoked': {
      const data = entry.data as PhoenixEventMap['phoenix:federation_peer_revoked'];
      return {
        id: buildEvidenceId('phoenix', 'peer_revoked', data.peerId, data.timestamp, data.reason),
        timestamp: data.timestamp,
        peerId: data.peerId,
        displayName: data.displayName,
        endpoint: null,
        trustState: 'revoked',
        kind: 'peer_revoked',
        title: buildTitle('peer_revoked'),
        detail: buildPhoenixDetail('peer_revoked', null, null, data.reason, 'revoked', null),
        outcome: 'denied',
        keyId: null,
        previousCurrentKeyId: null,
        reason: data.reason,
        evidenceSources: ['phoenix'],
      };
    }
    case 'phoenix:federation_runtime_key_staged': {
      const data = entry.data as PhoenixEventMap['phoenix:federation_runtime_key_staged'];
      return {
        id: buildEvidenceId('phoenix', 'runtime_key_staged', data.peerId, data.timestamp, data.keyId),
        timestamp: data.timestamp,
        peerId: data.peerId,
        displayName: null,
        endpoint: null,
        trustState: null,
        kind: 'runtime_key_staged',
        title: buildTitle('runtime_key_staged'),
        detail: buildPhoenixDetail('runtime_key_staged', data.keyId, data.previousCurrentKeyId, null, null, null),
        outcome: 'allowed',
        keyId: data.keyId,
        previousCurrentKeyId: data.previousCurrentKeyId,
        reason: null,
        evidenceSources: ['phoenix'],
      };
    }
    case 'phoenix:federation_runtime_key_promoted': {
      const data = entry.data as PhoenixEventMap['phoenix:federation_runtime_key_promoted'];
      return {
        id: buildEvidenceId('phoenix', 'runtime_key_promoted', data.peerId, data.timestamp, data.keyId),
        timestamp: data.timestamp,
        peerId: data.peerId,
        displayName: null,
        endpoint: null,
        trustState: null,
        kind: 'runtime_key_promoted',
        title: buildTitle('runtime_key_promoted'),
        detail: buildPhoenixDetail('runtime_key_promoted', data.keyId, data.previousCurrentKeyId, data.reason, null, null),
        outcome: 'allowed',
        keyId: data.keyId,
        previousCurrentKeyId: data.previousCurrentKeyId,
        reason: data.reason,
        evidenceSources: ['phoenix'],
      };
    }
  }
}

function timestampsAreClose(left: string, right: string): boolean {
  const leftValue = toTimeValue(left);
  const rightValue = toTimeValue(right);
  if (leftValue === null || rightValue === null) {
    return false;
  }

  return Math.abs(leftValue - rightValue) <= AUDIT_MATCH_WINDOW_MS;
}

function matchAuditEntry(
  eventEntry: FederationEvidenceJournalEntry,
  auditEntries: NormalizedAuditEvidence[],
): NormalizedAuditEvidence | null {
  const match = auditEntries.find((candidate) => {
    if (candidate.matched || candidate.kind !== eventEntry.kind) {
      return false;
    }

    if (candidate.peerId !== eventEntry.peerId) {
      return false;
    }

    if ((eventEntry.keyId ?? null) !== (candidate.keyId ?? null)) {
      return false;
    }

    return timestampsAreClose(candidate.timestamp, eventEntry.timestamp);
  });

  if (!match) {
    return null;
  }

  match.matched = true;
  return match;
}

function hydrateEntryWithPeer(
  entry: FederationEvidenceJournalEntry,
  peersById: Map<string, PeerIdentity>,
): FederationEvidenceJournalEntry {
  if (!entry.peerId) {
    return entry;
  }

  const peer = peersById.get(entry.peerId);
  if (!peer) {
    return entry;
  }

  return {
    ...entry,
    displayName: entry.displayName ?? peer.displayName,
    endpoint: entry.endpoint ?? peer.endpoint,
    trustState: entry.trustState ?? peer.trustState,
  };
}

function buildPeerSummary(
  peer: PeerIdentity,
  runtimeKeys: PeerRuntimeKeyBinding[],
  journal: FederationEvidenceJournalEntry[],
): FederationPeerEvidenceSummary {
  const peerEntries = journal
    .filter((entry) => entry.peerId === peer.peerId)
    .sort((left, right) => compareTimestampDesc(left.timestamp, right.timestamp));
  const currentKeyId = runtimeKeys.find((binding) => binding.status === 'current')?.keyId ?? null;
  const nextKeyId = runtimeKeys.find((binding) => binding.status === 'next')?.keyId ?? null;
  const latestEntry = peerEntries[0] ?? null;

  let rotationState: FederationPeerEvidenceSummary['rotationState'];
  if (peer.trustState === 'revoked') {
    rotationState = 'revoked';
  } else if (nextKeyId) {
    rotationState = 'staged';
  } else if (currentKeyId) {
    rotationState = 'stable';
  } else {
    rotationState = 'missing';
  }

  return {
    peerId: peer.peerId,
    displayName: peer.displayName,
    endpoint: peer.endpoint,
    trustState: peer.trustState,
    trustedAt: peer.trustedAt ?? null,
    revokedAt: peer.revokedAt ?? null,
    currentKeyId,
    nextKeyId,
    rotationState,
    lastEvidenceAt: latestEntry?.timestamp ?? peer.revokedAt ?? peer.trustedAt ?? null,
    latestAction: latestEntry?.title ?? null,
    latestOutcome: latestEntry?.outcome ?? null,
    journalCount: peerEntries.length,
    registerCount: peerEntries.filter((entry) => entry.kind === 'peer_registered').length,
    revokeCount: peerEntries.filter((entry) => entry.kind === 'peer_revoked').length,
    stageCount: peerEntries.filter((entry) => entry.kind === 'runtime_key_staged').length,
    promoteCount: peerEntries.filter((entry) => entry.kind === 'runtime_key_promoted').length,
    routeDeniedCount: peerEntries.filter((entry) => entry.kind === 'route_denied').length,
  };
}

export async function buildFederationEvidenceSnapshot(
  options: BuildFederationEvidenceOptions = {},
): Promise<FederationEvidenceSnapshot> {
  const limit = Math.max(1, Math.min(options.limit ?? 24, 100));
  const sampleLimit = Math.min(Math.max(limit * 4, MIN_SAMPLE_LIMIT), MAX_SAMPLE_LIMIT);
  const peerFilter = options.peerId?.trim() || null;

  const [auditEntries, phoenixHistory] = await Promise.all([
    getAuditLog(sampleLimit, 0),
    Promise.resolve(phoenixEventBus.getHistory(undefined, sampleLimit)),
  ]);

  const peers = trustRegistry
    .listPeers()
    .filter((peer) => !peerFilter || peer.peerId === peerFilter);
  const peersById = new Map(peers.map((peer) => [peer.peerId, peer]));

  const normalizedAuditEntries = auditEntries
    .map(normalizeAuditEntry)
    .filter((entry): entry is NormalizedAuditEvidence => entry !== null)
    .filter((entry) => !peerFilter || entry.peerId === peerFilter);

  const mergedFromPhoenix = phoenixHistory
    .map(normalizePhoenixEntry)
    .filter((entry): entry is FederationEvidenceJournalEntry => entry !== null)
    .filter((entry) => !peerFilter || entry.peerId === peerFilter)
    .map((entry) => {
      const matchedAudit = matchAuditEntry(entry, normalizedAuditEntries);
      if (!matchedAudit) {
        return hydrateEntryWithPeer(entry, peersById);
      }

      return hydrateEntryWithPeer(
        {
          ...entry,
          outcome: matchedAudit.outcome,
          detail: mergeReason(entry.detail, matchedAudit.reason),
          reason: entry.reason ?? matchedAudit.reason,
          evidenceSources: ['phoenix', 'audit'],
        },
        peersById,
      );
    });

  const unmatchedAuditEntries = normalizedAuditEntries
    .filter((entry) => !entry.matched)
    .map((entry) => hydrateEntryWithPeer(entry, peersById));

  const combinedJournal = [...mergedFromPhoenix, ...unmatchedAuditEntries].sort((left, right) => {
    const timestampOrder = compareTimestampDesc(left.timestamp, right.timestamp);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }

    return right.evidenceSources.length - left.evidenceSources.length;
  });

  const journal = combinedJournal.slice(0, limit);
  const peerSummaries = peers
    .map((peer) => buildPeerSummary(peer, trustRegistry.getPeerRuntimeKeys(peer.peerId), combinedJournal))
    .sort((left, right) => {
      const leftTimestamp = left.lastEvidenceAt ?? '';
      const rightTimestamp = right.lastEvidenceAt ?? '';
      const timestampOrder = compareTimestampDesc(leftTimestamp, rightTimestamp);
      if (timestampOrder !== 0) {
        return timestampOrder;
      }
      return left.peerId.localeCompare(right.peerId);
    });

  return {
    timestamp: new Date().toISOString(),
    peerFilter,
    limit,
    truncated: combinedJournal.length > journal.length,
    peers: peerSummaries,
    journal,
    totals: {
      peerCount: peerSummaries.length,
      trustedCount: peerSummaries.filter((peer) => peer.trustState === 'trusted').length,
      pendingCount: peerSummaries.filter((peer) => peer.trustState === 'pending').length,
      revokedCount: peerSummaries.filter((peer) => peer.trustState === 'revoked').length,
      peersWithNextKey: peerSummaries.filter((peer) => Boolean(peer.nextKeyId)).length,
      journalCount: journal.length,
      deniedCount: combinedJournal.filter((entry) => entry.outcome === 'denied').length,
      registerCount: combinedJournal.filter((entry) => entry.kind === 'peer_registered').length,
      revokeCount: combinedJournal.filter((entry) => entry.kind === 'peer_revoked').length,
      stageCount: combinedJournal.filter((entry) => entry.kind === 'runtime_key_staged').length,
      promoteCount: combinedJournal.filter((entry) => entry.kind === 'runtime_key_promoted').length,
      routeDeniedCount: combinedJournal.filter((entry) => entry.kind === 'route_denied').length,
    },
  };
}
