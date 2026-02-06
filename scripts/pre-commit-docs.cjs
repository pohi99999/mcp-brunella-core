#!/usr/bin/env node
/**
 * Pre-commit hook script for documentation sync
 * Zone IV: Docs-as-Code
 *
 * Validates:
 * 1. Required documentation files exist
 * 2. Protected files are not being deleted
 * 3. .env is not staged for commit
 * 4. Agent logs have recent entries (optional warning)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ANSI colors for output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Required documentation files
const requiredDocs = [
    'CLAUDE.md',
    'README.md',
    'conductor/tracks.md',
    'package.json'
];

// Protected files that should NEVER be deleted
const protectedFiles = [
    '.env',
    'package.json',
    'src/agents/types.ts',
    'src/agents/OrchestratorAgent.ts',
    'src/agents/EvaluatorAgent.ts',
    'src/index.ts',
    'src/cli.ts',
    'src/core/llm_client.ts',
    'src/server/web.ts',
    'src/server/registry.ts'
];

// Files that should NEVER be committed
const forbiddenCommits = [
    '.env',
    'credentials.json',
    '.env.local',
    '.env.production'
];

let errors = [];
let warnings = [];

// === Check 1: Required docs exist ===
for (const doc of requiredDocs) {
    const fullPath = path.join(ROOT, doc);
    if (!fs.existsSync(fullPath)) {
        errors.push(`Required file missing: ${doc}`);
    }
}

// === Check 2: Get staged files ===
let stagedFiles = [];
try {
    const output = execSync('git diff --cached --name-status', {
        cwd: ROOT,
        encoding: 'utf-8'
    });
    stagedFiles = output.trim().split('\n').filter(Boolean).map(line => {
        const [status, ...fileParts] = line.split('\t');
        return { status, file: fileParts.join('\t') };
    });
} catch (e) {
    // Not in git repo or git not available
    warnings.push('Could not check staged files (git not available?)');
}

// === Check 3: Protected files not deleted ===
for (const staged of stagedFiles) {
    if (staged.status === 'D') {
        if (protectedFiles.includes(staged.file)) {
            errors.push(`PROTECTED FILE DELETED: ${staged.file} - restore with: git checkout HEAD -- ${staged.file}`);
        }
    }
}

// === Check 4: Forbidden files not staged ===
for (const staged of stagedFiles) {
    if (staged.status !== 'D') {
        const basename = path.basename(staged.file);
        if (forbiddenCommits.includes(basename) || forbiddenCommits.includes(staged.file)) {
            errors.push(`FORBIDDEN FILE STAGED: ${staged.file} - contains secrets, run: git reset HEAD ${staged.file}`);
        }
    }
}

// === Check 5: Agent log freshness (warning only) ===
const agentLogPath = path.join(ROOT, '.ai', 'claude.md');
if (fs.existsSync(agentLogPath)) {
    const content = fs.readFileSync(agentLogPath, 'utf-8');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (!content.includes(today)) {
        warnings.push(`Agent log .ai/claude.md has no entry for today (${today}). Consider updating before commit.`);
    }
}

// === Output results ===
if (warnings.length > 0) {
    console.log(`${YELLOW}[pre-commit-docs] Warnings:${RESET}`);
    for (const w of warnings) {
        console.log(`  ${YELLOW}- ${w}${RESET}`);
    }
}

if (errors.length > 0) {
    console.log(`${RED}[pre-commit-docs] ERRORS - Commit blocked:${RESET}`);
    for (const e of errors) {
        console.log(`  ${RED}- ${e}${RESET}`);
    }
    process.exit(1);
}

console.log(`${GREEN}[pre-commit-docs] Documentation check passed${RESET}`);
process.exit(0);
