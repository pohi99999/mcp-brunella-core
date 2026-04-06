/**
 * @fileoverview Brunella CLI — Project Maintainer parancsok (Hungarian)
 *
 * Regisztrálja a `brunella maintainer` alparancs-csoportot az alábbi
 * subcommand-okkal:
 *
 *   brunella maintainer riport   — megjeleníti a legutóbbi riportot
 *   brunella maintainer futtat   — on-demand scant indít és megjeleníti az eredményt
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL ?? 'http://localhost:3000';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Calls the local Brunella API and returns JSON.
 * @param path - Full API path (e.g. '/api/v1/project-maintainer/reports/latest')
 * @param method - HTTP method
 * @param body - Optional JSON body
 */
async function apiFetch<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API hiba (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

interface FindingRow {
  category: string;
  severity: string;
  message: string;
  path?: string;
}

interface SuggestionRow {
  action: string;
  target: string;
  reason: string;
}

interface TrackSummary {
  total: number;
  missingSpec: string[];
  missingPlan: string[];
  healthy: number;
}

interface ProjectMaintainerReport {
  id: string;
  generatedAt: string;
  triggeredBy: string;
  findings: FindingRow[];
  suggestions: SuggestionRow[];
  trackSummary: TrackSummary;
  dryRun: boolean;
}

interface LatestReportResponse {
  id: string;
  generatedAt: string;
  findingsCount: number;
  suggestionsCount: number;
  triggeredBy: string;
  report: ProjectMaintainerReport;
}

interface RunResponse {
  success: boolean;
  message: string;
  report: ProjectMaintainerReport;
}

const SEVERITY_ICON: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
  info: '⚪',
};

const ACTION_LABEL: Record<string, string> = {
  review: 'Ellenőrzés',
  create: 'Létrehozás',
};

function printReport(report: ProjectMaintainerReport): void {
  const genAt = new Date(report.generatedAt).toLocaleString('hu-HU');

  writeLine();
  writeLine(chalk.bold('📋 Project Maintainer Riport'));
  writeLine(`   Generálva : ${chalk.cyan(genAt)}`);
  writeLine(`   Indítva   : ${chalk.gray(report.triggeredBy)}`);
  writeLine(`   Dry-run   : ${report.dryRun ? chalk.green('igen') : chalk.yellow('nem')}`);

  // Track summary
  const ts = report.trackSummary;
  writeLine();
  writeLine(chalk.bold(`📁 Conductor trackok: ${chalk.green(String(ts.healthy))}/${chalk.white(String(ts.total))} egészséges`));
  if (ts.missingSpec.length > 0) {
    writeLine(`   ${chalk.yellow('⚠️  Hiányzó spec.md  :')} ${ts.missingSpec.join(', ')}`);
  }
  if (ts.missingPlan.length > 0) {
    writeLine(`   ${chalk.yellow('⚠️  Hiányzó plan.md  :')} ${ts.missingPlan.join(', ')}`);
  }

  // Findings
  if (report.findings.length === 0) {
    writeLine();
    writeLine(chalk.green('✅ Nincs találat – a repository tiszta!'));
  } else {
    writeLine();
    writeLine(chalk.bold(`🔍 Találatok (${report.findings.length}):`));
    for (const f of report.findings) {
      const icon = SEVERITY_ICON[f.severity] ?? '❓';
      const pathStr = f.path ? chalk.gray(` → ${f.path}`) : '';
      writeLine(`   ${icon} ${chalk.dim(`[${f.category}]`)} ${f.message}${pathStr}`);
    }
  }

  // Suggestions
  if (report.suggestions.length > 0) {
    writeLine();
    writeLine(chalk.bold(`💡 Javaslatok (${report.suggestions.length}):`));
    for (const s of report.suggestions) {
      const actionLabel = ACTION_LABEL[s.action] ?? s.action;
      writeLine(`   ${chalk.cyan(`[${actionLabel}]`)} ${s.target}`);
      writeLine(`     ${chalk.dim('↳')} ${chalk.gray(s.reason)}`);
    }
  }

  writeLine();
}

/**
 * Registers `brunella maintainer` subcommand group onto the given Commander program.
 * @param program - Commander root program instance
 */
export function registerProjectMaintainerCommands(program: Command): void {
  const maintainer = program
    .command('maintainer')
    .description('Project Maintainer — repository karbantartási riportok');

  /**
   * brunella maintainer riport
   * Displays the most recent persisted report.
   */
  maintainer
    .command('riport')
    .description('Legutóbbi karbantartási riport megjelenítése')
    .action(async () => {
      const spinner = ora('Riport betöltése...').start();
      try {
        const data = await apiFetch<LatestReportResponse>(
          '/api/v1/project-maintainer/reports/latest',
        );
        spinner.stop();
        printReport(data.report);
      } catch (e) {
        spinner.fail('Nem sikerült a riport lekérése');
        writeLine(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });

  /**
   * brunella maintainer futtat
   * Triggers an on-demand scan and prints the resulting report.
   */
  maintainer
    .command('futtat')
    .description('On-demand karbantartási scan futtatása')
    .option('--live', 'Aktív karbantartás (fájlok archiválása)', false)
    .action(async (options: { live: boolean }) => {
      const spinner = ora(
        options.live
          ? chalk.yellow('Project Maintainer AKTÍV karbantartás futtatása...')
          : 'Project Maintainer scan futtatása...',
      ).start();
      try {
        const data = await apiFetch<RunResponse>(
          '/api/v1/project-maintainer/run',
          'POST',
          { dryRun: !options.live },
        );
        spinner.stop();
        if (!data.success) {
          writeLine(chalk.red(`❌ A scan nem sikerült: ${data.message}`));
          process.exit(1);
        }

        if (options.live) {
          writeLine(chalk.green('✨ Karbantartás befejezve. Rizikós fájlok archiválva.'));
        }

        printReport(data.report);
      } catch (e) {
        spinner.fail('A scan sikertelen');
        writeLine(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });
}

