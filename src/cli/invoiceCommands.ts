/**
 * Invoice Automation CLI Commands (Phase 5)
 *
 * Parancs:
 *  - brunella invoices sync
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { BrunellaClient } from "../utils/mcpClient.js";
import { runInvoiceSync, type InvoiceSyncOptions } from "./invoiceSync.js";

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function registerInvoiceCommands(program: Command): void {
  const invoices = program
    .command("invoices")
    .description("Invoice automation commands (Számlázz.hu → Google Sheets)");

  invoices
    .command("sync")
    .description("Számlák szinkronizálása a Google Sheets-be")
    .option("--since <date>", "Számlák ettől a dátumtól (YYYY-MM-DD)")
    .option("--limit <number>", "Maximum számla (default: 100)")
    .option("--force-refresh", "Cache bypass")
    .option("--unpaid-only", "Csak nem fizetett számlák")
    .option("--overdue", "Csak lejárt számlák")
    .option("--replace", "Replace mód (append=false)")
    .option("--clear-first", "Sheet ürítése írás előtt")
    .option("--no-skip-duplicates", "Duplikátumok megtartása")
    .option("--batch-size <number>", "Batch méret (default: 75)")
    .option("--dry-run", "Csak lekérés, nem ír Sheets-be")
    .action(async (opts: Record<string, string | boolean>) => {
      const spinner = ora("Kapcsolódás...").start();
      const client = new BrunellaClient();

      const options: InvoiceSyncOptions = {
        sinceDate: typeof opts.since === "string" ? opts.since : undefined,
        limit: toNumber(opts.limit as string | undefined, 100),
        forceRefresh: Boolean(opts.forceRefresh),
        includeUnpaidOnly: Boolean(opts.unpaidOnly),
        getOverdue: Boolean(opts.overdue),
        append: !opts.replace,
        clearFirst: Boolean(opts.clearFirst),
        skipDuplicates: opts.skipDuplicates !== false,
        batchSize: toNumber(opts.batchSize as string | undefined, 75),
        dryRun: Boolean(opts.dryRun),
      };

      try {
        await client.connect();
        spinner.text = "Számlák lekérése...";

        const result = await runInvoiceSync(client, options);
        spinner.stop();

        if (!result.success) {
          console.error(chalk.red(`❌ ${result.message || "Szinkron hiba"}`));
          process.exit(1);
        }

        if (options.dryRun) {
          console.log(
            chalk.green(
              `✅ Dry-run kész: ${result.fetched} számla (forrás: ${result.source})`,
            ),
          );
          return;
        }

        console.log(
          chalk.green(
            `✅ Szinkron kész: ${result.fetched} → ${result.written} sor (duplikátum: ${result.duplicatesSkipped})`,
          ),
        );
      } catch (e: unknown) {
        spinner.fail("Sikertelen szinkron");
        const msg = e instanceof Error ? e.message : String(e);
        console.error(chalk.red(msg));
        process.exit(1);
      } finally {
        await client.close();
      }
    });
}
