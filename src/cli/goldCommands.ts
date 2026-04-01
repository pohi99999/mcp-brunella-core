/**
 * Gold Protocol G7.7: Gold Config + CLI Commands
 *
 * CLI parancsok a Gold Protocol kezeléséhez
 */

import { Command } from 'commander';
import { logInfo, logError } from '../utils/logger.js';
import type { SpecMeta } from '../agents/specStatus.js';
import { listSpecStatuses, approveSpec, rejectSpec } from '../agents/specStatus.js';
import { listActiveCheckpoints, clearCheckpoints, getCheckpointStats } from '../core/checkpoint.js';
import { getRecentDecisions } from '../core/modelRouter.js';
import { getGoldenStats } from '../core/goldenDatasetBridge.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const formatRow = (columns: string[]) =>
    columns.map((column, index) => column.padEnd(widths[index]!)).join(' | ');

  writeLine(formatRow(headers));
  writeLine(widths.map((width) => '-'.repeat(width)).join('-|-'));

  for (const row of rows) {
    writeLine(formatRow(row));
  }
}

/**
 * Gold Protocol CLI Commands (G7.7)
 */
export function registerGoldCommands(program: Command): void {
  const gold = program.command('gold').description('Gold Protocol management commands');

  // brunella gold spec list
  gold
    .command('spec-list')
    .description('List all track spec statuses')
    .action(async () => {
      try {
        const specs: SpecMeta[] = await listSpecStatuses();
        writeTable(
          ['Track', 'Status', 'Progress', 'Priority'],
          specs.map((spec) => [
            spec.id,
            spec.spec_status,
            `${spec.progress}%`,
            spec.priority || 'normal',
          ]),
        );
      } catch (error: unknown) {
        logError('CLI', `Failed to list specs: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold spec approve <trackId>
  gold
    .command('spec-approve <trackId>')
    .description('Approve a track spec')
    .action(async (trackId: string) => {
      try {
        await approveSpec(trackId);
        logInfo('CLI', `✅ Spec approved: ${trackId}`);
      } catch (error: unknown) {
        logError('CLI', `Failed to approve spec: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold spec reject <trackId> <reason>
  gold
    .command('spec-reject <trackId> <reason>')
    .description('Reject a track spec')
    .action(async (trackId: string, reason: string) => {
      try {
        await rejectSpec(trackId, reason);
        logInfo('CLI', `❌ Spec rejected: ${trackId} (${reason})`);
      } catch (error: unknown) {
        logError('CLI', `Failed to reject spec: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold phoenix checkpoints
  gold
    .command('phoenix-checkpoints')
    .description('List active Phoenix checkpoints')
    .action(async () => {
      try {
        const checkpoints = await listActiveCheckpoints();
        writeTable(
          ['TaskId', 'Step', 'Timestamp'],
          checkpoints.map((checkpoint) => [
            checkpoint.taskId,
            checkpoint.stepName,
            new Date(checkpoint.createdAt || Date.now()).toLocaleString(),
          ]),
        );
      } catch (error: unknown) {
        logError('CLI', `Failed to list checkpoints: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold phoenix clear <taskId>
  gold
    .command('phoenix-clear <taskId>')
    .description('Clear checkpoints for a task')
    .action(async (taskId: string) => {
      try {
        await clearCheckpoints(taskId);
        logInfo('CLI', `🗑 Cleared checkpoints for: ${taskId}`);
      } catch (error: unknown) {
        logError('CLI', `Failed to clear checkpoints: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold router decisions
  gold
    .command('router-decisions')
    .description('Show recent router decisions')
    .option('-n, --num <count>', 'Number of decisions', '10')
    .action(async (options: { num: string }) => {
      try {
        const decisions = await getRecentDecisions(Number(options.num));
        writeTable(
          ['Timestamp', 'Category', 'Model', 'Reason'],
          decisions.map((decision) => [
            new Date(decision.timestamp).toLocaleString(),
            decision.category,
            decision.selectedModel,
            decision.reason.slice(0, 50),
          ]),
        );
      } catch (error: unknown) {
        logError('CLI', `Failed to list decisions: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold memory stats
  gold
    .command('memory-stats')
    .description('Show cognitive memory statistics')
    .action(async () => {
      try {
        const stats = await getGoldenStats();
        if (!stats) {
          writeLine('\n❌ Golden dataset stats unavailable (Python API offline?)\n');
          return;
        }
        writeLine('\n📊 Golden Dataset Stats:');
        writeLine(`   Samples: ${stats.totalSamples || 0}`);
        writeLine(`   New Since Training: ${stats.newSinceLastTraining || 0}`);
        writeLine(`   Last Training: ${stats.lastTrainingAt || 'Never'}`);
      } catch (error: unknown) {
        logError('CLI', `Failed to get memory stats: ${getErrorMessage(error)}`);
      }
    });

  // brunella gold status
  gold
    .command('status')
    .description('Show overall Gold Protocol status')
    .action(async () => {
      try {
        const [specs, checkpoints, golden] = await Promise.all([
          listSpecStatuses(),
          listActiveCheckpoints(),
          getGoldenStats(),
        ]);
        writeLine('\n🏆 Gold Protocol Status:\n');
        writeLine(`  ✅ Approved Specs: ${specs.filter((spec) => spec.spec_status === 'approved').length}`);
        writeLine(`  ⏳ Pending Specs: ${specs.filter((spec) => spec.spec_status === 'pending_approval').length}`);
        writeLine(`  💾 Active Checkpoints: ${checkpoints.length}`);
        writeLine(`  📊 Golden Samples: ${golden?.totalSamples || 0}`);
        writeLine(`  📈 New Since Training: ${golden?.newSinceLastTraining || 0}`);
        writeLine();
      } catch (error: unknown) {
        logError('CLI', `Failed to get status: ${getErrorMessage(error)}`);
      }
    });
}
