#!/usr/bin/env node

/**
 * GitHub Projects Sync Script
 * 
 * Synchronizes conductor/tracks.md with GitHub Projects
 * - Creates/updates issues for each track
 * - Sets appropriate labels and fields
 * - Updates progress and status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Configuration
const TRACKS_FILE = path.join(rootDir, 'conductor', 'tracks.md');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || DRY_RUN;

// GitHub CLI check
function checkGhCli() {
  try {
    const { execSync } = require('child_process');
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('❌ GitHub CLI (gh) not found. Please install: https://cli.github.com/');
    process.exit(1);
  }
}

// Parse tracks.md file
function parseTracks() {
  if (!fs.existsSync(TRACKS_FILE)) {
    console.error(`❌ Tracks file not found: ${TRACKS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(TRACKS_FILE, 'utf-8');
  const tracks = [];
  
  // Parse active tracks section
  const activeSection = content.match(/## 🟢 Aktív Szálak\n\n([\s\S]*?)\n---/);
  if (!activeSection) {
    console.log('⚠️  No active tracks found');
    return tracks;
  }

  const trackRegex = /- \[([ x])\] \*\*(.*?)\*\* \[(.*?)\]\n(?:[\s\S]*?)- \*\*ID:\*\* `(.*?)`\n(?:[\s\S]*?)- \*\*Progress:\*\* (.*?)%/g;
  
  let match;
  while ((match = trackRegex.exec(activeSection[1])) !== null) {
    const [, completed, name, priority, id, progress] = match;
    tracks.push({
      completed: completed === 'x',
      name,
      priority,
      id,
      progress: parseInt(progress) || 0,
      trackFolder: `conductor/tracks/${id}/`
    });
  }

  return tracks;
}

// Get track label
function getTrackLabel(name) {
  const labelMap = {
    'code quality': 'track:code-quality',
    'gold protocol': 'track:gold-protocol',
    'agent architect': 'track:agent-architect',
    'cloudflare': 'track:cloudflare',
    'dashboard': 'track:dashboard',
    'developer agent': 'track:developer-agent',
    'phoenix protocol': 'track:phoenix-protocol',
    'robotkéz': 'track:robotkez'
  };

  const nameLower = name.toLowerCase();
  for (const [key, label] of Object.entries(labelMap)) {
    if (nameLower.includes(key)) {
      return label;
    }
  }
  return 'track';
}

// Get priority label
function getPriorityLabel(priority) {
  const labelMap = {
    'CRITICAL': 'priority:critical',
    'HIGH': 'priority:high',
    'MEDIUM': 'priority:medium',
    'LOW': 'priority:low'
  };
  return labelMap[priority.toUpperCase()] || 'priority:medium';
}

// Search for existing issue
function findIssue(trackId) {
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      `gh issue list --search "Track ID: ${trackId}" --json number,title,state --limit 1`,
      { encoding: 'utf-8' }
    );
    const issues = JSON.parse(result);
    return issues.length > 0 ? issues[0] : null;
  } catch (error) {
    if (VERBOSE) console.error(`Error searching for issue: ${error.message}`);
    return null;
  }
}

// Create issue
function createIssue(track) {
  const title = `[TRACK] ${track.name}`;
  const body = `## Track Information

**Track Name:** ${track.name}
**Track ID:** \`${track.id}\`
**Priority:** ${track.priority}
**Progress:** ${track.progress}%

## Description

This issue tracks the development of: ${track.name}

## Conductor Integration

**Track Folder:** \`${track.trackFolder}\`

📂 [View in conductor](https://github.com/pohi99999/mcp-brunella-core/tree/main/${track.trackFolder})

---

*This issue was automatically created by the GitHub Projects sync script.*
*Update \`conductor/tracks.md\` to sync changes.*`;

  const labels = [
    'track',
    getTrackLabel(track.name),
    getPriorityLabel(track.priority)
  ].join(',');

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create issue: ${title}`);
    console.log(`    Labels: ${labels}`);
    console.log(`    Progress: ${track.progress}%`);
    return null;
  }

  try {
    const { execSync } = require('child_process');
    const result = execSync(
      `gh issue create --title "${title}" --body "${body}" --label "${labels}"`,
      { encoding: 'utf-8' }
    );
    const issueUrl = result.trim();
    const issueNumber = issueUrl.split('/').pop();
    return issueNumber;
  } catch (error) {
    console.error(`  ❌ Failed to create issue: ${error.message}`);
    return null;
  }
}

// Update issue
function updateIssue(issueNumber, track) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would update issue #${issueNumber}`);
    console.log(`    Progress: ${track.progress}%`);
    console.log(`    Completed: ${track.completed}`);
    return;
  }

  try {
    const { execSync } = require('child_process');
    
    // Update labels
    const labels = [
      'track',
      getTrackLabel(track.name),
      getPriorityLabel(track.priority)
    ].join(',');
    
    execSync(`gh issue edit ${issueNumber} --add-label "${labels}"`, { stdio: 'ignore' });

    // Add progress comment
    const comment = `**Progress Update** (from conductor/tracks.md)

Current progress: **${track.progress}%**
Status: ${track.completed ? '✅ Completed' : '🔄 In Progress'}

Track folder: \`${track.trackFolder}\`

---
*Auto-updated by sync script at ${new Date().toISOString()}*`;

    execSync(`gh issue comment ${issueNumber} --body "${comment}"`, { stdio: 'ignore' });

    // Close if completed
    if (track.completed) {
      execSync(`gh issue close ${issueNumber}`, { stdio: 'ignore' });
    }

    if (VERBOSE) console.log(`  ✅ Updated issue #${issueNumber}`);
  } catch (error) {
    console.error(`  ❌ Failed to update issue: ${error.message}`);
  }
}

// Main sync function
async function sync() {
  console.log('🔄 GitHub Projects Sync\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Check prerequisites
  checkGhCli();

  // Parse tracks
  console.log('📖 Reading conductor/tracks.md...');
  const tracks = parseTracks();
  console.log(`   Found ${tracks.length} active tracks\n`);

  if (tracks.length === 0) {
    console.log('✨ Nothing to sync');
    return;
  }

  // Process each track
  console.log('🔄 Processing tracks...\n');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const track of tracks) {
    console.log(`📌 ${track.name} (${track.id})`);
    
    const existingIssue = findIssue(track.id);
    
    if (existingIssue) {
      console.log(`   Found existing issue #${existingIssue.number}`);
      updateIssue(existingIssue.number, track);
      updated++;
    } else {
      console.log(`   No existing issue found, creating new one...`);
      const issueNumber = createIssue(track);
      if (issueNumber) {
        console.log(`   ✅ Created issue #${issueNumber}`);
        created++;
      } else {
        skipped++;
      }
    }
    console.log('');
  }

  // Summary
  console.log('📊 Summary');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${tracks.length}`);
  
  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else {
    console.log('\n✨ Sync complete!');
  }
}

// Run
sync().catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});
