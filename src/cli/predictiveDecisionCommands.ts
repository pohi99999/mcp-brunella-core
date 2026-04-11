import { Command } from 'commander';
import boxen from 'boxen';
import chalk from 'chalk';

import type { DecisionResult, DecisionStats, MonteCarloConfig } from '../core/decisionTypes.js';
import { writeLine } from '../utils/cliOutput.js';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  count?: number;
}

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/predictive-decision${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || payload.success === false || payload.data === undefined) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.data;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('hu-HU');
}

function printHistory(history: DecisionResult[]): void {
  writeLine(boxen(chalk.cyan('🔮 Predictive decision history'), { padding: 1, borderStyle: 'round' }));
  if (history.length === 0) {
    writeLine(chalk.gray('Nincs predictive decision futás.'));
    writeLine('');
    return;
  }

  for (const decision of history) {
    writeLine(`${chalk.bold(decision.id)} ${chalk.cyan(decision.outcome)} • ${decision.selectedScenario?.action.type ?? 'no-action'}`);
    writeLine(`  Triggered:    ${decision.triggeredBy}`);
    writeLine(`  Created:      ${formatTimestamp(decision.createdAt)}`);
    writeLine(`  Scenarios:    ${decision.scenarios.length}`);
    writeLine(`  Selected:     ${decision.selectedScenario ? decision.selectedScenario.totalScore.toFixed(3) : '—'}`);
    writeLine(`  Rollback:     ${decision.rollbackCapability ? 'available' : 'n/a'}`);
    writeLine('');
  }
}

function printDecision(decision: DecisionResult): void {
  writeLine(boxen(chalk.cyan(`Predictive decision ${decision.id}`), { padding: 1, borderStyle: 'round' }));
  writeLine(`Outcome:       ${decision.outcome}`);
  writeLine(`Triggered by:  ${decision.triggeredBy}`);
  writeLine(`Created:       ${formatTimestamp(decision.createdAt)}`);
  writeLine(`Rolled back:   ${formatTimestamp(decision.rolledBackAt)}`);
  writeLine(`Scenarios:     ${decision.scenarios.length}`);
  writeLine(`Alerts/signals:${decision.metadata.activeAlerts}/${decision.metadata.signalCount}`);
  if (decision.selectedScenario) {
    writeLine(`Action:        ${decision.selectedScenario.action.type}`);
    writeLine(`Source:        ${decision.selectedScenario.candidate.sourceType}:${decision.selectedScenario.candidate.sourceId}`);
    writeLine(`Score:         ${decision.selectedScenario.totalScore.toFixed(3)}`);
    writeLine(`Reason:        ${decision.selectedScenario.action.description}`);
  }
  if (decision.executedAction) {
    writeLine(`Executed:      ${decision.executedAction.success ? 'yes' : 'no'}`);
    if (decision.executedAction.error) {
      writeLine(`Error:         ${decision.executedAction.error}`);
    }
  }
  writeLine('');
}

function printStats(stats: DecisionStats): void {
  writeLine(boxen(chalk.cyan('📊 Predictive decision stats'), { padding: 1, borderStyle: 'round' }));
  writeLine(`Total:         ${stats.totalDecisions}`);
  writeLine(`Executed:      ${stats.actionsExecuted}`);
  writeLine(`No action:     ${stats.noActionDecisions}`);
  writeLine(`Failed:        ${stats.failedActions}`);
  writeLine(`Rolled back:   ${stats.rolledBackActions}`);
  writeLine(`Success rate:  ${(stats.successRate * 100).toFixed(1)}%`);
  writeLine(`Avg scenarios: ${stats.averageScenarioCount.toFixed(1)}`);
  writeLine(`Avg score:     ${stats.averageSelectedScore.toFixed(3)}`);
  if (stats.actionBreakdown.length > 0) {
    writeLine(`Actions:       ${stats.actionBreakdown.map((entry) => `${entry.actionType}:${entry.count}`).join(', ')}`);
  }
  writeLine(`Window:        ${formatTimestamp(stats.dateRange.from)} → ${formatTimestamp(stats.dateRange.to)}`);
  writeLine('');
}

export function registerPredictiveDecisionCommands(program: Command): void {
  const decision = program
    .command('decision')
    .alias('predictive-decision')
    .description('Predictive decision engine');

  decision
    .command('history')
    .description('List recent predictive decision runs')
    .option('--limit <limit>', 'Maximum number of decisions', '10')
    .action(async (options: { limit: string }) => {
      try {
        const history = await apiFetch<DecisionResult[]>(`/history?limit=${encodeURIComponent(options.limit)}`);
        printHistory(history);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  decision
    .command('status')
    .description('Show predictive decision statistics')
    .option('--days <days>', 'Statistics window in days', '30')
    .action(async (options: { days: string }) => {
      try {
        const stats = await apiFetch<DecisionStats>(`/stats?daysBack=${encodeURIComponent(options.days)}`);
        printStats(stats);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  decision
    .command('trigger')
    .description('Trigger a predictive decision cycle')
    .option('--scenarios <count>', 'Monte Carlo scenario count')
    .option('--seed <seed>', 'Deterministic seed')
    .option('--threshold <threshold>', 'Selection threshold')
    .action(async (options: { scenarios?: string; seed?: string; threshold?: string }) => {
      try {
        const config: Partial<MonteCarloConfig> = {};
        if (options.scenarios) config.scenarioCount = Number(options.scenarios);
        if (options.seed) config.seed = Number(options.seed);
        if (options.threshold) config.selectionThreshold = Number(options.threshold);
        const result = await apiFetch<DecisionResult>('/trigger', {
          method: 'POST',
          body: JSON.stringify({
            triggeredBy: 'manual_cli',
            config,
          }),
        });
        printDecision(result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  decision
    .command('show <decisionId>')
    .description('Show a single predictive decision run')
    .action(async (decisionId: string) => {
      try {
        const result = await apiFetch<DecisionResult>(`/${encodeURIComponent(decisionId)}`);
        printDecision(result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  decision
    .command('rollback <decisionId>')
    .description('Rollback a reversible predictive decision')
    .action(async (decisionId: string) => {
      try {
        const result = await apiFetch<DecisionResult>(`/${encodeURIComponent(decisionId)}/rollback`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        printDecision(result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}
