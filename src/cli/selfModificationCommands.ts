import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { writeLine } from '../utils/cliOutput.js';
import type {
  SelfModificationOverview,
  SelfModificationProposal,
  SelfModificationProposalStatus,
} from '../core/selfModificationEngine.js';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  count?: number;
}

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/self-modification${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload.data;
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function printStatus(overview: SelfModificationOverview): void {
  writeLine(boxen(chalk.cyan('🛠 Self-modification állapot'), { padding: 1, borderStyle: 'round' }));
  writeLine(`Runs (7d):      ${overview.summary.totalRuns}`);
  writeLine(`Agents:         ${overview.summary.agentCount}`);
  writeLine(`Success rate:   ${(overview.summary.overallSuccessRate * 100).toFixed(1)}%`);
  writeLine(`Avg duration:   ${Math.round(overview.summary.avgDurationMs)} ms`);
  writeLine(`Weak agents:    ${overview.weakAgents.length}`);
  writeLine(
    `Active proposal:${overview.activeProposal
      ? ` ${chalk.yellow(overview.activeProposal.id)} (${overview.activeProposal.agentName})`
      : ` ${chalk.gray('nincs')}`}`,
  );
  writeLine('');
}

function printProposals(proposals: SelfModificationProposal[]): void {
  writeLine(boxen(chalk.cyan(`📋 Self-mod proposals (${proposals.length})`), { padding: 1, borderStyle: 'round' }));
  if (proposals.length === 0) {
    writeLine(chalk.gray('Nincs self-mod proposal.'));
    writeLine('');
    return;
  }

  proposals.forEach((proposal) => {
    writeLine(`${chalk.bold(proposal.id)} ${chalk.cyan(proposal.agentName)} [${proposal.status}]`);
    writeLine(
      `  Improvement: ${proposal.improvement.improvementPercent.toFixed(1)} • Tests passed: ${proposal.improvement.testsPassed}/${proposal.improvement.sampleCount}`,
    );
    writeLine(`  Weakness:    ${proposal.weaknessSummary}`);
    writeLine(`  Updated:     ${formatTimestamp(proposal.updatedAt)}`);
    if (proposal.trackId) {
      writeLine(`  Track:       ${proposal.trackId}`);
    }
    writeLine('');
  });
}

function printProposalResult(prefix: string, proposal: SelfModificationProposal): void {
  writeLine(boxen(chalk.green(prefix), { padding: 1, borderStyle: 'round' }));
  writeLine(`Proposal:      ${proposal.id}`);
  writeLine(`Agent:         ${proposal.agentName}`);
  writeLine(`Status:        ${proposal.status}`);
  writeLine(`Improvement:   ${proposal.improvement.improvementPercent.toFixed(1)}`);
  writeLine(`Updated:       ${formatTimestamp(proposal.updatedAt)}`);
  if (proposal.trackId) {
    writeLine(`Track:         ${proposal.trackId}`);
  }
  writeLine('');
}

export function registerSelfModificationCommands(program: Command): void {
  const improve = program
    .command('improve')
    .alias('self-mod')
    .description('Self-modification proposal review and execution');

  improve
    .command('status')
    .description('Show the self-modification overview')
    .action(async () => {
      try {
        const overview = await apiFetch<SelfModificationOverview>('/overview');
        printStatus(overview);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  improve
    .command('list')
    .description('List self-modification proposals')
    .option('--status <status>', 'Filter by proposal status')
    .action(async (options: { status?: SelfModificationProposalStatus }) => {
      try {
        const statusQuery = options.status ? `?status=${encodeURIComponent(options.status)}` : '';
        const response = await fetch(`${API_BASE}/api/v1/self-modification/proposals${statusQuery}`);
        const payload = await response.json() as ApiEnvelope<SelfModificationProposal[]>;
        if (!response.ok || payload.success === false || !payload.data) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        printProposals(payload.data);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  improve
    .command('run <agentName>')
    .description('Create a self-modification proposal for an agent')
    .option('--force', 'Allow proposal generation even if thresholds are not met')
    .action(async (agentName: string, options: { force?: boolean }) => {
      try {
        const proposal = await apiFetch<SelfModificationProposal>(`/improve/${encodeURIComponent(agentName)}`, {
          method: 'POST',
          body: JSON.stringify({ force: options.force === true }),
        });
        printProposalResult('Self-mod proposal létrehozva', proposal);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  improve
    .command('approve <proposalId>')
    .description('Approve and apply a self-modification proposal')
    .option('--reviewer <name>', 'Reviewer name', 'cli')
    .option('--notes <notes>', 'Optional review notes')
    .action(async (proposalId: string, options: { reviewer: string; notes?: string }) => {
      try {
        const proposal = await apiFetch<SelfModificationProposal>(`/proposals/${encodeURIComponent(proposalId)}/approve`, {
          method: 'POST',
          body: JSON.stringify({
            reviewer: options.reviewer,
            notes: options.notes,
          }),
        });
        printProposalResult('Proposal jóváhagyva és alkalmazva', proposal);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  improve
    .command('reject <proposalId>')
    .description('Reject a self-modification proposal')
    .option('--reviewer <name>', 'Reviewer name', 'cli')
    .option('--notes <notes>', 'Optional rejection notes')
    .action(async (proposalId: string, options: { reviewer: string; notes?: string }) => {
      try {
        const proposal = await apiFetch<SelfModificationProposal>(`/proposals/${encodeURIComponent(proposalId)}/reject`, {
          method: 'POST',
          body: JSON.stringify({
            reviewer: options.reviewer,
            notes: options.notes,
          }),
        });
        printProposalResult('Proposal elutasítva', proposal);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}
