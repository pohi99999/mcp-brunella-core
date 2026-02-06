#!/usr/bin/env node
/**
 * Spec Freeze Protocol - Check Script
 *
 * Usage:
 *   node scripts/spec-freeze-check.cjs <track_id>
 *   node scripts/spec-freeze-check.cjs --all
 *   node scripts/spec-freeze-check.cjs --freeze <track_id>
 *
 * Rules:
 * - Implementation is ONLY allowed when spec_status === "frozen"
 * - Agents must run this check before starting implementation
 * - Use --freeze to mark a spec as frozen (approved for implementation)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRACKS_DIR = path.join(ROOT, 'conductor', 'tracks');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function loadMeta(trackId) {
    const metaPath = path.join(TRACKS_DIR, trackId, 'meta.json');
    if (!fs.existsSync(metaPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function saveMeta(trackId, meta) {
    const metaPath = path.join(TRACKS_DIR, trackId, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

function hasSpec(trackId) {
    const specPath = path.join(TRACKS_DIR, trackId, 'spec.md');
    if (!fs.existsSync(specPath)) return false;
    const content = fs.readFileSync(specPath, 'utf-8');
    // Spec must have at least 100 chars of content
    return content.trim().length >= 100;
}

function checkTrack(trackId) {
    const meta = loadMeta(trackId);
    if (!meta) {
        return { trackId, status: 'ERROR', message: 'meta.json not found or invalid' };
    }

    if (meta.status === 'archived' || meta.status === 'completed') {
        return { trackId, status: 'SKIP', message: `Track is ${meta.status}` };
    }

    const specExists = hasSpec(trackId);
    const specStatus = meta.spec_status || 'draft';
    const implAllowed = meta.implementation_allowed === true;

    if (!specExists) {
        return {
            trackId,
            status: 'BLOCKED',
            message: 'No spec.md found (or too short)',
            specStatus: 'none'
        };
    }

    if (specStatus === 'frozen' && implAllowed) {
        return {
            trackId,
            status: 'OK',
            message: 'Implementation allowed',
            specStatus
        };
    }

    return {
        trackId,
        status: 'BLOCKED',
        message: `Spec not frozen (current: ${specStatus})`,
        specStatus
    };
}

function freezeTrack(trackId, approver = 'Claude') {
    const meta = loadMeta(trackId);
    if (!meta) {
        console.log(`${RED}ERROR: meta.json not found for ${trackId}${RESET}`);
        return false;
    }

    if (!hasSpec(trackId)) {
        console.log(`${RED}ERROR: Cannot freeze - no spec.md found for ${trackId}${RESET}`);
        return false;
    }

    meta.spec_status = 'frozen';
    meta.spec_approved_at = new Date().toISOString();
    meta.spec_approved_by = approver;
    meta.implementation_allowed = true;
    meta.updated_at = new Date().toISOString();

    saveMeta(trackId, meta);
    console.log(`${GREEN}✓ Track ${trackId} spec FROZEN - implementation allowed${RESET}`);
    return true;
}

function listAllTracks() {
    const tracks = fs.readdirSync(TRACKS_DIR).filter(d => {
        const stat = fs.statSync(path.join(TRACKS_DIR, d));
        return stat.isDirectory();
    });

    console.log(`\n${CYAN}=== Spec Freeze Status Report ===${RESET}\n`);

    let frozen = 0, blocked = 0, skipped = 0;

    for (const trackId of tracks) {
        const result = checkTrack(trackId);

        if (result.status === 'SKIP') {
            skipped++;
            continue;
        }

        const icon = result.status === 'OK' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
        const statusColor = result.status === 'OK' ? GREEN :
                           result.status === 'BLOCKED' ? YELLOW : RED;

        console.log(`${icon} ${trackId}`);
        console.log(`   ${statusColor}${result.message}${RESET}`);

        if (result.status === 'OK') frozen++;
        else blocked++;
    }

    console.log(`\n${CYAN}Summary:${RESET}`);
    console.log(`  ${GREEN}Frozen (impl allowed):${RESET} ${frozen}`);
    console.log(`  ${YELLOW}Blocked (need freeze):${RESET} ${blocked}`);
    console.log(`  Skipped (archived/completed): ${skipped}`);
    console.log(`\nTo freeze a spec: node scripts/spec-freeze-check.cjs --freeze <track_id>`);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help') {
    console.log(`
${CYAN}Spec Freeze Protocol - Check Script${RESET}

Usage:
  node scripts/spec-freeze-check.cjs <track_id>     Check single track
  node scripts/spec-freeze-check.cjs --all          List all tracks
  node scripts/spec-freeze-check.cjs --freeze <id>  Freeze a spec

Rules:
  - Implementation is ONLY allowed when spec_status === "frozen"
  - Run this before starting implementation work
`);
    process.exit(0);
}

if (args[0] === '--all') {
    listAllTracks();
} else if (args[0] === '--freeze') {
    if (!args[1]) {
        console.log(`${RED}ERROR: Please provide track_id${RESET}`);
        process.exit(1);
    }
    freezeTrack(args[1], args[2] || 'Claude');
} else {
    const result = checkTrack(args[0]);
    const icon = result.status === 'OK' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${icon} ${result.trackId}: ${result.message}`);
    process.exit(result.status === 'OK' ? 0 : 1);
}
