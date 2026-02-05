#!/usr/bin/env node
/**
 * Pre-commit hook script for documentation sync
 * Zone IV: Docs-as-Code
 *
 * This script runs before each commit to ensure documentation is in sync.
 * Currently a placeholder - add validation logic as needed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Check if key documentation files exist
const requiredDocs = [
    'CLAUDE.md',
    'README.md',
    'conductor/tracks.md'
];

let allOk = true;

for (const doc of requiredDocs) {
    const fullPath = path.join(ROOT, doc);
    if (!fs.existsSync(fullPath)) {
        console.warn(`[pre-commit-docs] Warning: ${doc} not found`);
        // Don't fail on missing docs, just warn
    }
}

// Future: Add more validation here
// - Check if tracks.md is up to date
// - Validate CLAUDE.md format
// - Sync konyvtarfa.md

console.log('[pre-commit-docs] Documentation check passed');
process.exit(0);
