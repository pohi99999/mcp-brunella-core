/**
 * @fileoverview CLI commands for the Daily Agent Briefing feature.
 *
 * Registers the `briefing` command group under the main CLI program:
 *   brunella briefing riport   — print the latest briefing report
 *   brunella briefing futtat   — trigger an on-demand briefing run
 *
 * Follows the same patterns as `projectMaintainerCommands.ts`.
 */

import type { Command } from 'commander';
import { getGlobalDb } from '../utils/globalDb.js';
import { initBriefingSchema, runDailyAgentBriefing } from '../server/services/briefingService.js';
import { logError, logInfo } from '../utils/logger.js';
import type { BriefingReport } from '../server/services/briefingService.js';

// ── Module constant ───────────────────────────────────────────────────────────
const MODULE = 'BriefingCommands';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Prints a human-readable summary of a BriefingReport to stdout.
 *
 * @param report - The report to display
 */
function printBriefingReport(report: BriefingReport): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Napi AI Agent Összefoglaló');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Riport dátuma    : ${report.reportDate}`);
  console.log(`  Generálva        : ${report.generatedAt}`);
  console.log(`  Indította        : ${report.triggeredBy}`);
  console.log(`  Elemek száma     : ${report.items.length}`);
  console.log(`  LLM összefoglaló : ${report.usedLLM ? '✅ igen' : '⚠️  nem (fallback)'}`);
  console.log(`  Markdown fájl    : ${report.markdownPath}`);
  if (report.dryRun) {
    console.log('  ⚠️  Dry-run mód: nem került mentésre');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Registers the `briefing` command group on the given Commander program.
 *
 * @param program - Root Commander program instance
 */
export function registerBriefingCommands(program: Command): void {
  const briefing = program
    .command('briefing')
    .description('Napi AI Agent Összefoglaló parancsok');

  // ── briefing riport ────────────────────────────────────────────────────────
  briefing
    .command('riport')
    .description('A legutóbbi napi briefing riport megjelenítése')
    .action(() => {
      const db = getGlobalDb();
      initBriefingSchema(db);

      try {
        const row = db
          .prepare(
            `SELECT report_json FROM ai_agent_briefing_reports
             ORDER BY generated_at DESC
             LIMIT 1`,
          )
          .get() as { report_json: string } | undefined;

        if (!row) {
          console.log('\n⚠️  Még nem készült briefing riport. Futtasd: brunella briefing futtat\n');
          return;
        }

        const report = JSON.parse(row.report_json) as BriefingReport;
        printBriefingReport(report);
      } catch (error: unknown) {
        logError(MODULE, `riport hiba: ${error}`);
        console.error('\n❌ Nem sikerült betölteni a riportot:', String(error), '\n');
        process.exit(1);
      }
    });

  // ── briefing futtat ────────────────────────────────────────────────────────
  briefing
    .command('futtat')
    .description('Napi AI agent briefing azonnali futtatása')
    .option('--dry-run', 'Ne mentse az adatbázisba az eredményt')
    .option('--verbose', 'Részletes kimenet')
    .action(async (opts: { dryRun?: boolean; verbose?: boolean }) => {
      const db = getGlobalDb();
      initBriefingSchema(db);

      const dryRun = opts.dryRun ?? false;

      if (opts.verbose) {
        logInfo(MODULE, `Briefing futtatása (dryRun=${dryRun})...`);
      }

      console.log('\n🤖 Napi AI Agent Összefoglaló futtatása...\n');

      try {
        const report = await runDailyAgentBriefing({
          triggeredBy: 'cli',
          dryRun,
          db,
        });

        printBriefingReport(report);
        console.log('✅ Összefoglaló sikeresen elkészült.\n');
      } catch (error: unknown) {
        logError(MODULE, `futtat hiba: ${error}`);
        console.error('\n❌ Briefing futtatás sikertelen:', String(error), '\n');
        process.exit(1);
      }
    });
}
