import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';

import { writeLine } from '../utils/cliOutput.js';
import type {
  WorldPerceptionCycleResult,
  WorldPerceptionOverview,
  WorldPerceptionPromotionResult,
  WorldPerceptionSignalInput,
  WorldPerceptionSignalRecord,
  WorldPerceptionSignalStatus,
} from '../core/worldPerceptionLayer.js';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  count?: number;
}

const API_BASE = process.env.BRUNELLA_API_URL || 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/world-perception${path}`, {
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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function printOverview(overview: WorldPerceptionOverview): void {
  writeLine(boxen(chalk.cyan('🌍 World perception állapot'), { padding: 1, borderStyle: 'round' }));
  writeLine(`Signals:        ${overview.summary.totalSignals}`);
  writeLine(`Detected:       ${overview.summary.detected}`);
  writeLine(`Promoted:       ${overview.summary.promoted}`);
  writeLine(`Ignored:        ${overview.summary.ignored}`);
  writeLine(`Avg score:      ${overview.summary.avgScore.toFixed(2)}`);
  writeLine(`Fresh queue:    ${overview.pendingSignals.length}`);
  if (overview.domainCoverage.length > 0) {
    writeLine(`Domains:        ${overview.domainCoverage.map((entry) => `${entry.domain}:${entry.count}`).join(', ')}`);
  }
  writeLine('');
}

function printSignals(signals: WorldPerceptionSignalRecord[]): void {
  writeLine(boxen(chalk.cyan(`🛰 World signals (${signals.length})`), { padding: 1, borderStyle: 'round' }));
  if (signals.length === 0) {
    writeLine(chalk.gray('Nincs world perception signal.'));
    writeLine('');
    return;
  }

  signals.forEach((signal) => {
    writeLine(`${chalk.bold(signal.id)} ${chalk.cyan(signal.title)} [${signal.status}]`);
    writeLine(`  Domain:       ${signal.domain}`);
    writeLine(`  Score:        ${signal.score.toFixed(2)} • Freshness: ${signal.freshnessScore.toFixed(2)} • Impact: ${signal.impactScore.toFixed(2)}`);
    writeLine(`  Observed:     ${formatTimestamp(signal.observedAt)}`);
    if (signal.intelligenceSignalId) {
      writeLine(`  Intelligence: ${signal.intelligenceSignalId}`);
    }
    writeLine('');
  });
}

function printCycleResult(result: WorldPerceptionCycleResult): void {
  writeLine(boxen(chalk.green('World perception ciklus kész'), { padding: 1, borderStyle: 'round' }));
  writeLine(`Triggered:      ${formatTimestamp(result.triggeredAt)}`);
  writeLine(`Scanned cards:  ${result.scannedCards}`);
  writeLine(`Signals:        ${result.ingestedSignals}`);
  writeLine(`Created:        ${result.createdSignals}`);
  writeLine(`Refreshed:      ${result.refreshedSignals}`);
  writeLine('');
}

function printPromotionResult(prefix: string, result: WorldPerceptionPromotionResult | WorldPerceptionSignalRecord): void {
  writeLine(boxen(chalk.green(prefix), { padding: 1, borderStyle: 'round' }));
  if ('worldSignal' in result) {
    writeLine(`World signal:   ${result.worldSignal.id}`);
    writeLine(`Title:          ${result.worldSignal.title}`);
    writeLine(`Status:         ${result.worldSignal.status}`);
    writeLine(`Intelligence:   ${result.intelligenceSignal.id}`);
  } else {
    writeLine(`World signal:   ${result.id}`);
    writeLine(`Title:          ${result.title}`);
    writeLine(`Status:         ${result.status}`);
  }
  writeLine('');
}

export function registerWorldPerceptionCommands(program: Command): void {
  const perception = program
    .command('perception')
    .alias('world-perception')
    .description('World perception signal review and promotion');

  perception
    .command('status')
    .description('Show world perception overview')
    .action(async () => {
      try {
        const overview = await apiFetch<WorldPerceptionOverview>('/overview');
        printOverview(overview);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  perception
    .command('list')
    .description('List world perception signals')
    .option('--status <status>', 'Filter by signal status')
    .option('--limit <limit>', 'Number of signals to list', '12')
    .action(async (options: { status?: WorldPerceptionSignalStatus; limit: string }) => {
      try {
        const params = new URLSearchParams();
        params.set('limit', options.limit);
        if (options.status) params.set('status', options.status);
        const signals = await apiFetch<WorldPerceptionSignalRecord[]>(`/signals?${params.toString()}`);
        printSignals(signals);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  perception
    .command('observe')
    .description('Create a manual world perception signal')
    .requiredOption('--source <source>', 'Source name or URL')
    .requiredOption('--title <title>', 'Signal title')
    .requiredOption('--summary <summary>', 'Signal summary')
    .requiredOption('--domain <domain>', 'Signal domain')
    .requiredOption('--provenance <provenance>', 'Evidence or provenance')
    .option('--bias-label <label>', 'Bias label', 'unknown')
    .option('--confidence <confidence>', 'Confidence score', '0.6')
    .option('--entity <entity>', 'Primary entity')
    .option('--relation <relation>', 'Primary relation')
    .option('--stance <stance>', 'Signal stance')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (options: {
      source: string;
      title: string;
      summary: string;
      domain: WorldPerceptionSignalInput['domain'];
      provenance: string;
      biasLabel: WorldPerceptionSignalInput['biasLabel'];
      confidence: string;
      entity?: string;
      relation?: string;
      stance?: WorldPerceptionSignalInput['stance'];
      tags?: string;
    }) => {
      try {
        const signal = await apiFetch<WorldPerceptionSignalRecord>('/observe', {
          method: 'POST',
          body: JSON.stringify({
            sourceType: 'manual',
            source: options.source,
            title: options.title,
            summary: options.summary,
            domain: options.domain,
            provenance: options.provenance,
            biasLabel: options.biasLabel,
            confidence: Number(options.confidence),
            entity: options.entity,
            relation: options.relation,
            stance: options.stance,
            tags: options.tags?.split(',').map((part) => part.trim()).filter(Boolean) ?? [],
          } satisfies Partial<WorldPerceptionSignalInput>),
        });
        printPromotionResult('World signal rögzítve', signal);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  perception
    .command('cycle')
    .description('Run the knowledge-card world perception cycle')
    .option('--limit <limit>', 'Maximum knowledge cards to scan', '12')
    .action(async (options: { limit: string }) => {
      try {
        const result = await apiFetch<WorldPerceptionCycleResult>('/cycle', {
          method: 'POST',
          body: JSON.stringify({ limit: Number(options.limit) }),
        });
        printCycleResult(result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  perception
    .command('promote <signalId>')
    .description('Promote a world signal into the intelligence layer')
    .option('--reviewer <reviewer>', 'Reviewer identity', 'cli')
    .option('--notes <notes>', 'Optional notes')
    .action(async (signalId: string, options: { reviewer: string; notes?: string }) => {
      try {
        const result = await apiFetch<WorldPerceptionPromotionResult>(`/signals/${encodeURIComponent(signalId)}/promote`, {
          method: 'POST',
          body: JSON.stringify({
            reviewer: options.reviewer,
            note: options.notes,
          }),
        });
        printPromotionResult('World signal promotálva', result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });

  perception
    .command('ignore <signalId>')
    .description('Ignore a world signal')
    .option('--reviewer <reviewer>', 'Reviewer identity', 'cli')
    .option('--notes <notes>', 'Optional notes')
    .action(async (signalId: string, options: { reviewer: string; notes?: string }) => {
      try {
        const result = await apiFetch<WorldPerceptionSignalRecord>(`/signals/${encodeURIComponent(signalId)}/ignore`, {
          method: 'POST',
          body: JSON.stringify({
            reviewer: options.reviewer,
            note: options.notes,
          }),
        });
        printPromotionResult('World signal ignorálva', result);
      } catch (error) {
        writeLine(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}
