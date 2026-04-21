/**
 * Spec Status Manager - Központi specifikáció státusz kezelő
 *
 * A Gold Protocol G1.1 pillér: Spec-Driven Development enforcement.
 * Kezeli a track-specifikációk életciklusát (pending → approved/rejected).
 *
 * Adattárolás: conductor/tracks/<trackId>/meta.json
 *
 * @see conductor/tracks/gold_protocol/spec.md §3.1 (RULE-SF1..SF3)
 */

import { logInfo, logWarn, logError, logDebug } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { normalizeTrackDod, type TrackDodChecklist } from '@packages/utils/trackDod.js';
import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type SpecStatus = 'pending_approval' | 'approved' | 'rejected' | 'not_found';

export interface SpecMeta {
    id: string;
    title: string;
    status: string;
    spec_status: SpecStatus;
    priority: string;
    created: string;
    updated: string;
    owner: string;
    progress: number;
    tags: string[];
    dependencies: string[];
    estimated_effort: string;
    business_value: string;
    rejection_reason?: string;
    dod?: TrackDodChecklist;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRACKS_DIR = path.join(process.cwd(), 'conductor', 'tracks');

/**
 * Agent-ek amelyeknek specifikáció jóváhagyás szükséges a kód-íráshoz.
 * RULE-SF1: DeveloperAgent BLOCKED spec nélkül.
 */
const SPEC_REQUIRED_AGENTS = new Set<string>([
    'Developer',
    'DeveloperAgent',
]);

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Lekérdezi egy track specifikációjának státuszát.
 *
 * @param trackId - A track azonosítója (pl. 'gold_protocol')
 * @returns A spec státusza, vagy 'not_found' ha nem létezik
 */
export async function getSpecStatus(trackId: string): Promise<SpecStatus> {
    try {
        const meta = await readMeta(trackId);
        if (!meta) return 'not_found';

        const status = meta.spec_status || 'not_found';
        if (!isValidSpecStatus(status)) {
            logWarn('SpecStatus', `Invalid spec_status '${status}' in track ${trackId}, treating as not_found`);
            return 'not_found';
        }
        return status;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('SpecStatus', `Failed to get spec status for ${trackId}: ${msg}`);
        return 'not_found';
    }
}

/**
 * Jóváhagyja egy track specifikációját.
 * RULE-SF3: meta.json status → "approved"
 *
 * @param trackId - A track azonosítója
 * @returns true ha sikeres, false ha nem
 */
export async function approveSpec(trackId: string): Promise<boolean> {
    try {
        const meta = await readMeta(trackId);
        if (!meta) {
            logError('SpecStatus', `Cannot approve: track '${trackId}' not found`);
            return false;
        }

        meta.spec_status = 'approved';
        meta.status = 'active';
        meta.updated = new Date().toISOString().split('T')[0];

        await writeMeta(trackId, meta);
        logInfo('SpecStatus', `Spec APPROVED for track: ${trackId}`);
        return true;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('SpecStatus', `Failed to approve spec for ${trackId}: ${msg}`);
        return false;
    }
}

/**
 * Elutasítja egy track specifikációját.
 *
 * @param trackId - A track azonosítója
 * @param reason - Az elutasítás oka
 * @returns true ha sikeres, false ha nem
 */
export async function rejectSpec(trackId: string, reason?: string): Promise<boolean> {
    try {
        const meta = await readMeta(trackId);
        if (!meta) {
            logError('SpecStatus', `Cannot reject: track '${trackId}' not found`);
            return false;
        }

        meta.spec_status = 'rejected';
        meta.updated = new Date().toISOString().split('T')[0];
        if (reason) {
            meta.rejection_reason = reason;
        }

        await writeMeta(trackId, meta);
        logInfo('SpecStatus', `Spec REJECTED for track: ${trackId}${reason ? ` (reason: ${reason})` : ''}`);
        return true;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('SpecStatus', `Failed to reject spec for ${trackId}: ${msg}`);
        return false;
    }
}

/**
 * Ellenőrzi, hogy az adott agent-nek szüksége van-e specifikáció jóváhagyásra.
 * RULE-SF1: DeveloperAgent BLOCKED spec nélkül.
 * EXCEPTION: Ha nincs trackId (ad-hoc feladat), a spec gate SKIP.
 *
 * @param agentName - Az agent neve
 * @returns true ha spec kötelező
 */
export function requiresSpec(agentName: string): boolean {
    return SPEC_REQUIRED_AGENTS.has(agentName);
}

/**
 * Ellenőrzi, hogy egy track specifikációja jóváhagyott-e.
 *
 * @param trackId - A track azonosítója
 * @returns true ha jóváhagyott
 */
export async function isSpecApproved(trackId: string): Promise<boolean> {
    const status = await getSpecStatus(trackId);
    return status === 'approved';
}

/**
 * Listázza az összes track-et specifikációs státuszukkal.
 *
 * @returns Tömbben a track meta adatai
 */
export async function listSpecStatuses(): Promise<SpecMeta[]> {
    try {
        const entries = await fs.readdir(TRACKS_DIR, { withFileTypes: true });
        const results: SpecMeta[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const meta = await readMeta(entry.name);
            if (meta) {
                results.push(meta);
            }
        }

        return results;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('SpecStatus', `Failed to list spec statuses: ${msg}`);
        return [];
    }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function readMeta(trackId: string): Promise<SpecMeta | null> {
    const metaPath = path.join(TRACKS_DIR, trackId, 'meta.json');
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content) as SpecMeta;
        return {
            ...meta,
            dod: normalizeTrackDod(meta.dod),
        };
    } catch (error: unknown) {
        const err = ensureError(error);
        logDebug('SpecStatus', `Could not read spec metadata for ${trackId}: ${err.message}`);
        return null;
    }
}

async function writeMeta(trackId: string, meta: SpecMeta): Promise<void> {
    const metaPath = path.join(TRACKS_DIR, trackId, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify({
        ...meta,
        dod: normalizeTrackDod(meta.dod),
    }, null, 2), 'utf-8');
}

function isValidSpecStatus(status: string): status is SpecStatus {
    return ['pending_approval', 'approved', 'rejected', 'not_found'].includes(status);
}

