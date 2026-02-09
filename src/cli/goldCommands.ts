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

/**
 * Gold Protocol CLI Commands (G7.7)
 */
export function registerGoldCommands(program: Command) {
  const gold = program.command('gold').description('Gold Protocol management commands');

  // brunella gold spec list
  gold
    .command('spec-list')
    .description('List all track spec statuses')
    .action(async () => {
      try {
        const specs: SpecMeta[] = await listSpecStatuses();
        console.table(
          specs.map((s) => ({
            Track: s.id,
            Status: s.spec_status,
            Progress: `${s.progress}%`,
            Priority: s.priority || 'normal',
          }))
        );
      } catch (e: any) {
        logError('CLI', `Failed to list specs: ${e.message}`);
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
      } catch (e: any) {
        logError('CLI', `Failed to approve spec: ${e.message}`);
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
      } catch (e: any) {
        logError('CLI', `Failed to reject spec: ${e.message}`);
      }
    });

  // brunella gold phoenix checkpoints
  gold
    .command('phoenix-checkpoints')
    .description('List active Phoenix checkpoints')
    .action(async () => {
      try {
        const checkpoints = await listActiveCheckpoints();
        console.table(
          checkpoints.map((cp) => ({
            TaskId: cp.taskId,
            Step: cp.stepName,
            Timestamp: new Date(cp.createdAt || Date.now()).toLocaleString(),
          }))
        );
      } catch (e: any) {
        logError('CLI', `Failed to list checkpoints: ${e.message}`);
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
      } catch (e: any) {
        logError('CLI', `Failed to clear checkpoints: ${e.message}`);
      }
    });

  // brunella gold router decisions
  gold
    .command('router-decisions')
    .description('Show recent router decisions')
    .option('-n, --num <count>', 'Number of decisions', '10')
    .action(async (options) => {
      try {
        const decisions = await getRecentDecisions(Number(options.num));
        console.table(
          decisions.map((d) => ({
            Timestamp: new Date(d.timestamp).toLocaleString(),
            Category: d.category,
            Model: d.selectedModel,
            Reason: d.reason.slice(0, 50),
          }))
        );
      } catch (e: any) {
        logError('CLI', `Failed to list decisions: ${e.message}`);
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
          console.log('\n❌ Golden dataset stats unavailable (Python API offline?)\n');
          return;
        }
        console.log('\n📊 Golden Dataset Stats:');
        console.log(`   Samples: ${stats.totalSamples || 0}`);
        console.log(`   New Since Training: ${stats.newSinceLastTraining || 0}`);
        console.log(`   Last Training: ${stats.lastTrainingAt || 'Never'}`);
      } catch (e: any) {
        logError('CLI', `Failed to get memory stats: ${e.message}`);
      }
    });

  // brunella gold status
  gold
    .command('status')
    .description('Show overall Gold Protocol status')
    .action(async () => {
      try {
        const [specs, checkpoints, stats, golden] = await Promise.all([
          listSpecStatuses(),
          listActiveCheckpoints(),
          getCheckpointStats(),
          getGoldenStats(),
        ]);
        console.log('\n🏆 Gold Protocol Status:\n');
        console.log(`  ✅ Approved Specs: ${specs.filter((s) => s.spec_status === 'approved').length}`);
        console.log(`  ⏳ Pending Specs: ${specs.filter((s) => s.spec_status === 'pending_approval').length}`);
        console.log(`  💾 Active Checkpoints: ${checkpoints.length}`);
        console.log(`  📊 Golden Samples: ${golden?.totalSamples || 0}`);
        console.log(`  📈 New Since Training: ${golden?.newSinceLastTraining || 0}`);
        console.log();
      } catch (e: any) {
        logError('CLI', `Failed to get status: ${e.message}`);
      }
    });
}
