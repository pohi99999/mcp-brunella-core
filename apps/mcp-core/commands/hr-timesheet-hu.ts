import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';

import { writeLine } from '../../../packages/utils/cliOutput.js';
import { ensureError } from '../../../packages/utils/ensureError.js';
import type { HRTimesheetStatusResponse } from '@packages/types/hrTimesheetStatus.js';

const API_BASE = process.env.BRUNELLA_API_BASE_URL || process.env.API_BASE || 'http://localhost:3000';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('hu-HU').format(value);
}

function formatHours(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'n/a';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('hu-HU');
}

async function requestJson<T>(path: string, timeoutMs = 10000): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  const parsed = text.trim().length > 0 ? JSON.parse(text) as T : undefined;

  if (!response.ok) {
    const message = parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
      ? (parsed as { error: string }).error
      : `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  if (parsed === undefined) {
    throw new Error('Üres válasz érkezett az API-tól.');
  }

  return parsed;
}

function printStatus(response: HRTimesheetStatusResponse): void {
  const { snapshot } = response;
  const borderColor = snapshot.latestMonthlyExport?.status === 'failed' || snapshot.latestDailyAlert?.status === 'failed' ? 'yellow' : 'cyan';

  writeLine(
    boxen(chalk.cyan.bold('🕒 HR Timesheet & Culture Státusz'), {
      padding: 1,
      borderStyle: 'round',
      borderColor,
    }),
  );

  writeLine(chalk.bold('Headline:'), snapshot.headline);
  writeLine(chalk.bold('Ajánlás:'), snapshot.recommendation);
  writeLine(chalk.bold('Frissítve:'), formatDate(snapshot.checkedAt));

  writeLine(chalk.cyan('\nÖsszesítés:'));
  writeLine(`  Bejegyzések: ${formatNumber(snapshot.counts.entries)}`);
  writeLine(`  Munkavállalók: ${formatNumber(snapshot.counts.employees)}`);
  writeLine(`  Havi export futások: ${formatNumber(snapshot.counts.monthlyExports)}`);
  writeLine(`  Napi alert futások: ${formatNumber(snapshot.counts.dailyAlertRuns)}`);

  writeLine(chalk.cyan('\nLegutóbbi havi export:'));
  if (snapshot.latestMonthlyExport) {
    writeLine(`  Hónap: ${snapshot.latestMonthlyExport.month ?? 'n/a'}`);
    writeLine(`  Állapot: ${snapshot.latestMonthlyExport.status}`);
    writeLine(`  Dolgozók: ${formatNumber(snapshot.latestMonthlyExport.employeeCount)}`);
    writeLine(`  Bejegyzések: ${formatNumber(snapshot.latestMonthlyExport.totalEntries)}`);
    writeLine(`  Órák: ${formatHours(snapshot.latestMonthlyExport.totalHours)}`);
    writeLine(`  Kimenet: ${snapshot.latestMonthlyExport.outputPath ?? 'n/a'}`);
  } else {
    writeLine('  Még nincs export futás.');
  }

  writeLine(chalk.cyan('\nLegutóbbi napi alert:'));
  if (snapshot.latestDailyAlert) {
    writeLine(`  Dátum: ${snapshot.latestDailyAlert.date ?? 'n/a'}`);
    writeLine(`  Állapot: ${snapshot.latestDailyAlert.status}`);
    writeLine(`  Generált: ${formatNumber(snapshot.latestDailyAlert.generatedCount)}`);
    writeLine(`  Szűrt: ${formatNumber(snapshot.latestDailyAlert.suppressedCount)}`);
  } else {
    writeLine('  Még nincs napi alert futás.');
  }

  writeLine(chalk.cyan('\nAlert típusok:'));
  writeLine(`  Birthday: ${formatNumber(snapshot.alertTotalsByType.birthday)}`);
  writeLine(`  Anniversary: ${formatNumber(snapshot.alertTotalsByType.anniversary)}`);
}

export async function hrTimesheetStatusCommand(json = false): Promise<void> {
  const spinner = ora('HR timesheet status lekérdezése...').start();

  try {
    const response = await requestJson<HRTimesheetStatusResponse>('/api/v1/hr/timesheet/status');
    spinner.stop();

    if (json) {
      writeLine(JSON.stringify(response, null, 2));
      return;
    }

    printStatus(response);
  } catch (error: unknown) {
    spinner.fail('Nem sikerült lekérni az HR timesheet státuszt.');
    console.error(chalk.red(ensureError(error).message));
    process.exitCode = 1;
  }
}
