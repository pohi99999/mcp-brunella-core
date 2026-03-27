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
    .description("Számlák szinkronizálása a Google Sheets-be (Számlázz.hu)")
    // ... (rest of sync options)
    .action(async (opts: Record<string, string | boolean>) => {
      // ... (sync logic)
    });

  invoices
    .command("process")
    .description("Gmail-be érkező számlák automatikus feldolgozása (Gemini Vision)")
    .action(async () => {
      const { invoiceCommand } = await import("./commands/invoice-hu.js");
      await invoiceCommand();
    });
}
