/**
 * Conductor CLI Commands
 * Track State Management commands for CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { trackStateManager } from '../services/trackStateManager.js';

export function registerConductorCommands(conductorCmd: Command): void {
  // brunella conductor rescan
  conductorCmd
    .command('rescan')
    .description('Rescan all tracks (active + archived) and update project_state.json')
    .option('--watch', 'Start file watcher after sync')
    .action(async (options) => {
      console.log(chalk.blue('🔄 Track State Manager - Full Sync\n'));

      try {
        console.log(chalk.gray('Scanning conductor/tracks/ and conductor/archive/...\n'));

        await trackStateManager.fullSync();

        const state = trackStateManager.getState();

        console.log(chalk.green('✅ Sync complete!\n'));
        console.log(chalk.white('📊 Statistics:'));
        console.log(chalk.white(`  Total tracks: ${state.stats.total}`));
        console.log(chalk.cyan(`  Active: ${state.stats.active}`));
        console.log(chalk.yellow(`  Proposed: ${state.stats.proposed}`));
        console.log(chalk.green(`  Completed: ${state.stats.completed}`));
        console.log(chalk.gray(`  Archived: ${state.stats.archived}`));

        console.log(chalk.white(`\n📁 Files updated:`));
        console.log(chalk.gray(`  conductor/project_state.json`));
        console.log(chalk.gray(`  conductor/tracks.md`));

        if (options.watch) {
          console.log(chalk.blue('\n👀 Starting file watcher (realtime sync)...'));
          trackStateManager.startWatcher();
          console.log(chalk.green('✅ File watcher active. Press Ctrl+C to stop.'));
          // Keep process alive
          await new Promise(() => {});
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(chalk.red(`❌ Sync failed: ${msg}`));
        process.exit(1);
      }
    });

  // brunella conductor state (renamed to avoid conflict)
  conductorCmd
    .command('state')
    .description('Show current project status (tracks summary)')
    .action(async () => {
      console.log(chalk.blue('📊 Project Status Report\n'));

      const state = trackStateManager.getState();

      console.log(chalk.white(`Last Updated: ${state.lastUpdated}\n`));

      console.log(chalk.cyan('🚀 Active Tracks:'));
      const active = state.tracks.filter(t => t.status === 'active');
      if (active.length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        active.slice(0, 10).forEach(t => {
          const progressBar = '█'.repeat(Math.floor(t.progress / 10)) + '░'.repeat(10 - Math.floor(t.progress / 10));
          console.log(chalk.white(`  [${progressBar}] ${t.progress}% - ${t.name} (${t.priority})`));
        });
        if (active.length > 10) {
          console.log(chalk.gray(`  ... and ${active.length - 10} more`));
        }
      }

      console.log(chalk.yellow('\n📝 Proposed Tracks:'));
      const proposed = state.tracks.filter(t => t.status === 'proposed');
      if (proposed.length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        proposed.slice(0, 5).forEach(t => {
          console.log(chalk.white(`  - ${t.name} (${t.priority})`));
        });
        if (proposed.length > 5) {
          console.log(chalk.gray(`  ... and ${proposed.length - 5} more`));
        }
      }

      console.log(chalk.green('\n✅ Completed (Not Archived):'));
      const completed = state.tracks.filter(t => t.status === 'completed' && !t._isArchived);
      console.log(chalk.white(`  ${completed.length} tracks`));

      console.log(chalk.gray('\n📦 Archived:'));
      console.log(chalk.white(`  ${state.stats.archived} tracks`));

      console.log(chalk.white(`\n📊 Total: ${state.stats.total} tracks`));
    });

  // brunella conductor list
  conductorCmd
    .command('list')
    .description('List all tracks with details')
    .option('-s, --status <status>', 'Filter by status (active|proposed|completed|archived)')
    .option('-p, --priority <priority>', 'Filter by priority (low|medium|high|critical)')
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

      console.log(chalk.blue(`📋 Track List (${tracks.length} tracks)\n`));

      if (tracks.length === 0) {
        console.log(chalk.gray('No tracks found.'));
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

        console.log(statusColor(`${t.status.toUpperCase().padEnd(10)} ${priorityBadge} ${t.progress}% - ${t.name}`));
        console.log(chalk.gray(`           ID: ${t.id}`));
        if (t.assignee) {
          console.log(chalk.gray(`           Assignee: ${t.assignee}`));
        }
        console.log('');
      });
    });
}
