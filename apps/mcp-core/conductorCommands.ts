/**
 * Conductor CLI Commands
 * Track State Management commands for CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { trackStateManager } from '@packages/core-logic/trackStateManager.js';
import { buildTrackStatusSnapshot, formatTrackStatusSnapshot } from '@packages/core-logic/trackStatusSnapshot.js';
import { getTrackGroupLabel, normalizeTrackGroup, TRACK_GROUP_LABELS } from '@packages/utils/trackGroups.js';

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

  // brunella conductor masterplan
  conductorCmd
    .command('masterplan')
    .description('Show KKV masterplan status snapshot')
    .action(async () => {
      const snapshot = buildTrackStatusSnapshot(trackStateManager.getState());
      writeLine(formatTrackStatusSnapshot(snapshot));
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

  // brunella conductor report
  conductorCmd
    .command('report')
    .description('Generate weekly or monthly summary report')
    .option('-t, --type <type>', 'Report type (weekly|monthly)', 'weekly')
    .action(async (options: { type: string }) => {
      writeLine(chalk.blue(`📊 Generating ${options.type} report...\n`));
      const state = trackStateManager.getState();
      const snapshot = buildTrackStatusSnapshot(state);

      const reportDate = new Date().toISOString().split('T')[0];
      const filename = `conductor/reports/${options.type}_report_${reportDate}.md`;

      const lines = [
        `# KKV Masterplan ${options.type === 'weekly' ? 'Heti' : 'Havi'} Jelentés`,
        `**Dátum:** ${reportDate}`,
        '',
        `## 📈 Áttekintés`,
        `- **Összes Track:** ${snapshot.overallStats.total}`,
        `- **Aktív:** ${snapshot.overallStats.active}`,
        `- **Befejezett:** ${snapshot.overallStats.completed}`,
        '',
        `## ⚠️ Kockázati Jelentés (Risk Indicators)`,
      ];

      const highRisk = snapshot.activeBusinessTracks.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical');
      if (highRisk.length > 0) {
        highRisk.forEach(t => lines.push(`- **${t.title}**: ${t.riskLevel!.toUpperCase()} kockázat.`));
      } else {
        lines.push('- Nincs magas kockázatú aktív üzleti track.');
      }

      lines.push('', '## 📋 Előrehaladás (Progress)', formatTrackStatusSnapshot(snapshot));

      const fs = await import('fs');
      const path = await import('path');
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.writeFileSync(filename, lines.join('\n'), 'utf-8');

      writeLine(chalk.green(`✅ Jelentés mentve: ${filename}`));
    });
}

