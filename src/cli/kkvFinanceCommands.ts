import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import { writeLine } from "../utils/cliOutput.js";
import { ensureError } from "../utils/ensureError.js";
import { summarizeInvoices } from "../kkv/financeAutomation.js";

export function registerKkvFinanceCommands(program: Command): void {
  const kkv = program.command("kkv-finance").description("KKV finance helper commands");

  kkv
    .command("summarize")
    .description("Summarize invoices from JSON file")
    .option("--file <path>", "Path to JSON file with invoices")
    .option("--json", "Raw JSON output")
    .action(async (opts: { file?: string; json?: boolean }) => {
      try {
        let invoices: unknown[] = [];
        if (opts.file) {
          const content = fs.readFileSync(opts.file, "utf-8");
          invoices = JSON.parse(content);
        } else {
          writeLine(chalk.yellow("No --file provided; use --file <path> to pass invoices JSON"));
          process.exit(1);
        }

        const result = summarizeInvoices(invoices as any);
        if (opts.json) {
          writeLine(JSON.stringify(result, null, 2));
          return;
        }

        writeLine(chalk.bold("Invoice summary:"));
        writeLine("Total count:", String(result.totalCount));
        writeLine("Total amount:", String(result.totalAmount));
        writeLine("By status:", JSON.stringify(result.byStatus));
      } catch (error: unknown) {
        console.error(chalk.red("Error parsing invoices:"), ensureError(error).message);
        process.exit(1);
      }
    });
}
