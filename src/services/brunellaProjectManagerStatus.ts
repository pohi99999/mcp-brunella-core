import { ensureError } from '../utils/ensureError.js';
import { trackStateManager } from './trackStateManager.js';
import { buildTrackStatusSnapshot, formatTrackStatusSnapshot } from './trackStatusSnapshot.js';
import { readRecentFoszalEntries, type BrunellaFoszalEntry } from './brunellaProjectManagerFoszal.js';
import {
  queryProjectSummary,
  summarizeRagHits,
  type BrunellaRagHit,
} from './brunellaProjectManagerRag.js';
import type { TrackStatusSnapshot } from '../types/trackStatus.js';

export interface BrunellaProjectManagerOptions {
  limit?: number;
  ragQuery?: string;
  ragLimit?: number;
}

export interface BrunellaProjectManagerSnapshot {
  checkedAt: string;
  trackSnapshot: TrackStatusSnapshot;
  foszalEntries: BrunellaFoszalEntry[];
  ragHits: BrunellaRagHit[];
  warnings: string[];
}

function normalizeLimit(value: number | undefined, fallback: number, max = 10): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.floor(value)));
}

export function getTrackStateSnapshot(): TrackStatusSnapshot {
  return buildTrackStatusSnapshot(trackStateManager.getState());
}

export async function buildBrunellaProjectManagerSnapshot(
  options: BrunellaProjectManagerOptions = {},
): Promise<BrunellaProjectManagerSnapshot> {
  const warnings: string[] = [];
  const limit = normalizeLimit(options.limit, 5);
  const ragLimit = normalizeLimit(options.ragLimit, 5);

  const trackSnapshot = getTrackStateSnapshot();

  let foszalEntries: BrunellaFoszalEntry[] = [];
  try {
    foszalEntries = await readRecentFoszalEntries(limit);
  } catch (error: unknown) {
    const err = ensureError(error);
    warnings.push(`FOSZAL unavailable: ${err.message}`);
  }

  let ragHits: BrunellaRagHit[] = [];
  try {
    ragHits = await queryProjectSummary(
      options.ragQuery?.trim() || 'Brunella project status track documentation FOSZAL',
      ragLimit,
    );
  } catch (error: unknown) {
    const err = ensureError(error);
    warnings.push(`RAG search failed: ${err.message}`);
  }

  return {
    checkedAt: new Date().toISOString(),
    trackSnapshot,
    foszalEntries,
    ragHits,
    warnings,
  };
}

export function renderBrunellaProjectManagerSnapshot(
  snapshot: BrunellaProjectManagerSnapshot,
): string {
  const lines: string[] = [
    '# Brunella Project Manager Status',
    `Checked at: ${snapshot.checkedAt}`,
    '',
  ];

  for (const warning of snapshot.warnings) {
    lines.push(`> ⚠️ ${warning}`);
  }

  lines.push('', '## Track Snapshot', formatTrackStatusSnapshot(snapshot.trackSnapshot), '', '## Recent FOSZAL Entries');

  if (snapshot.foszalEntries.length === 0) {
    lines.push('- (none)');
  } else {
    for (const entry of snapshot.foszalEntries) {
      const header = `- [${entry.time}] [${entry.agent}] ${entry.title}`;
      const details: string[] = [];
      if (entry.date) {
        details.push(`date: ${entry.date}`);
      }
      if (entry.status) {
        details.push(`status: ${entry.status}`);
      }
      if (entry.files.length > 0) {
        details.push(`files: ${entry.files.join(', ')}`);
      }
      lines.push(details.length > 0 ? `${header}\n  - ${details.join('\n  - ')}` : header);
    }
  }

  lines.push('', '## RAG Project Summary');
  lines.push(...summarizeRagHits(snapshot.ragHits));

  return lines.join('\n');
}

export { parseRecentFoszalEntries } from './brunellaProjectManagerFoszal.js';
export { summarizeRagHits } from './brunellaProjectManagerRag.js';
