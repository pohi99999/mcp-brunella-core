/**
 * Conductor CLI Commands
 * Track State Management commands for CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { trackStateManager } from '../services/trackStateManager.js';
import { getTrackGroupLabel, normalizeTrackGroup, TRACK_GROUP_LABELS } from '../utils/trackGroups.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

export function registerConductorCommands(conductorCmd: Command): void {
  // brunella conductor rescan
  conductorCmd
    .command('rescan')
    .description('Rescan all tracks (active + archived) and update project_state.json')
    .option('--watch', 'Start file watcher after sync')
    .action(async (options: { watch?: boolean }) => {
      writeLine(chalk.blue('🔄 Track State Manager - Full Sync\n'));

      try {
        writeLine(chalk.gray('Scanning conductor/tracks/ and conductor/archive/...\n'));

        await trackStateManager.fullSync();

        const state = trackStateManager.getState();

        writeLine(chalk.green('✅ Sync complete!\n'));
        writeLine(chalk.white('📊 Statistics:'));
        writeLine(chalk.white(`  Total tracks: ${state.stats.total}`));
        writeLine(chalk.cyan(`  Active: ${state.stats.active}`));
        writeLine(chalk.yellow(`  Proposed: ${state.stats.proposed}`));
        writeLine(chalk.green(`  Completed: ${state.stats.completed}`));
        writeLine(chalk.gray(`  Archived: ${state.stats.archived}`));

        writeLine(chalk.white(`\n📁 Files updated:`));
        writeLine(chalk.gray(`  conductor/project_state.json`));
        writeLine(chalk.gray(`  conductor/tracks.md`));

        if (options.watch) {
          writeLine(chalk.blue('\n👀 Starting file watcher (realtime sync)...'));
          trackStateManager.startWatcher();
          writeLine(chalk.green('✅ File watcher active. Press Ctrl+C to stop.'));
          // Keep process alive
          await new Promise(() => {});
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        writeError(chalk.red(`❌ Sync failed: ${msg}`));
        process.exit(1);
      }
    });

  // brunella conductor state (renamed to avoid conflict)
  conductorCmd
    .command('state')
    .description('Show current project status (tracks summary)')
    .action(async () => {
      writeLine(chalk.blue('📊 Project Status Report\n'));

      const state = trackStateManager.getState();

      writeLine(chalk.white(`Last Updated: ${state.lastUpdated}\n`));

      writeLine(chalk.cyan('🚀 Active Tracks:'));
      const active = state.tracks.filter(t => t.status === 'active');
      if (active.length === 0) {
        writeLine(chalk.gray('  (none)'));
      } else {
        active.slice(0, 10).forEach(t => {
          const progressBar = '█'.repeat(Math.floor(t.progress / 10)) + '░'.repeat(10 - Math.floor(t.progress / 10));
          writeLine(chalk.white(`  [${progressBar}] ${t.progress}% - ${t.name}`));
          writeLine(chalk.gray(`           Group: ${getTrackGroupLabel(t.group)} | Priority: ${t.priority}`));
        });
        if (active.length > 10) {
          writeLine(chalk.gray(`  ... and ${active.length - 10} more`));
        }
      }

      writeLine(chalk.yellow('\n📝 Proposed Tracks:'));
      const proposed = state.tracks.filter(t => t.status === 'proposed');
      if (proposed.length === 0) {
        writeLine(chalk.gray('  (none)'));
      } else {
        proposed.slice(0, 5).forEach(t => {
          writeLine(chalk.white(`  - ${t.name} (${t.priority})`));
          writeLine(chalk.gray(`           Group: ${getTrackGroupLabel(t.group)}`));
        });
        if (proposed.length > 5) {
          writeLine(chalk.gray(`  ... and ${proposed.length - 5} more`));
        }
      }

      writeLine(chalk.green('\n✅ Completed (Not Archived):'));
      const completed = state.tracks.filter(t => t.status === 'completed' && !t._isArchived);
      writeLine(chalk.white(`  ${completed.length} tracks`));

      writeLine(chalk.gray('\n📦 Archived:'));
      writeLine(chalk.white(`  ${state.stats.archived} tracks`));

      writeLine(chalk.white(`\n📊 Total: ${state.stats.total} tracks`));
    });

  // brunella conductor list
  conductorCmd
    .command('list')
    .description('List all tracks with details')
    .option('-s, --status <status>', 'Filter by status (active|proposed|completed|archived)')
    .option('-p, --priority <priority>', 'Filter by priority (low|medium|high|critical)')
    .option('-g, --group <group>', 'Filter by group (business|nova|brunella|other)')
    .action(async (options) => {
      let tracks = trackStateManager.getState().tracks;

      // Filter by status
      if (options.status) {
        tracks = tracks.filter(t => t.status === options.status);
      }

      // Filter by priority
      if (options.priority) {
        tracks = tracks.filter(t => t.priority === options.priority);
      }

      // Filter by group
      if (options.group) {
        const selectedGroup = normalizeTrackGroup(options.group);
        if (!selectedGroup) {
          writeError(chalk.red(`Unknown group: ${options.group}. Use one of: ${Object.values(TRACK_GROUP_LABELS).join(' | ')}`));
          process.exit(1);
          return;
        }
        tracks = tracks.filter(t => t.group === selectedGroup);
      }

      writeLine(chalk.blue(`📋 Track List (${tracks.length} tracks)\n`));

      if (tracks.length === 0) {
        writeLine(chalk.gray('No tracks found.'));
        return;
      }

      tracks.forEach(t => {
        const statusColor =
          t.status === 'active' ? chalk.cyan :
          t.status === 'completed' ? chalk.green :
          t.status === 'proposed' ? chalk.yellow :
          chalk.gray;

        const priorityBadge =
          t.priority === 'critical' ? chalk.red('[P0]') :
          t.priority === 'high' ? chalk.yellow('[P1]') :
          t.priority === 'medium' ? chalk.blue('[P2]') :
          chalk.gray('[P3]');

        writeLine(statusColor(`${t.status.toUpperCase().padEnd(10)} ${priorityBadge} ${t.progress}% - ${t.name}`));
        writeLine(chalk.gray(`           Group: ${getTrackGroupLabel(t.group)}`));
        writeLine(chalk.gray(`           ID: ${t.id}`));
        if (t.assignee) {
          writeLine(chalk.gray(`           Assignee: ${t.assignee}`));
        }
        writeLine('');
      });
    });
}
