/**
 * Invoice CLI Commands — L5 Zero-Touch Pipeline management
 *
 * Parancsok:
 *   brunella invoice status        — Pipeline állapot lekérdezése
 *   brunella invoice process       — Manuális trigger a pipeline-hoz
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { ensureError } from '@packages/utils/ensureError.js';
import { writeLine } from '@packages/utils/cliOutput.js';

const API_BASE = 'http://localhost:3000/api/v1/bookkeeping';

export function registerInvoiceCommands(program: Command) {
  const invoice = program
    .command('invoice')
    .description('🧾 Számla automatizálási (L5 Zero-Touch) vezérlőpult');

  invoice
    .command('status')
    .description('A számla pipeline aktuális állapotának lekérdezése')
    .option('-l, --limit <number>', 'Megjelenítendő számlák száma', '10')
    .action(async (opts) => {
      const spinner = ora('Adatok lekérése...').start();
      try {
        const res = await fetch(`${API_BASE}/invoices?limit=${opts.limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json() as { success: boolean, invoices: any[] };
        spinner.stop();

        if (!data.invoices || data.invoices.length === 0) {
          writeLine(chalk.yellow('\nNincsenek feldolgozott számlák az adatbázisban.'));
          return;
        }

        writeLine(boxen(chalk.bold('🧾 LEGUTÓBBI SZÁMLÁK (L5 Pipeline)'), { padding: 1, margin: 1, borderColor: 'blue' }));

        data.invoices.forEach((inv, i) => {
          const statusColor = inv.status === 'COMPLETED' ? chalk.green : 
                             inv.status === 'FAILED' ? chalk.red : chalk.yellow;
          
          writeLine(`${chalk.blue('#' + (i+1))} ${chalk.bold(inv.partnerName || 'Ismeretlen')} — ${inv.amount} ${inv.currency || 'HUF'}`);
          writeLine(`   Azonosító: ${chalk.dim(inv.id)}`);
          writeLine(`   Státusz:   ${statusColor(inv.status)}`);
          if (inv.errorMessage) {
            writeLine(`   Hiba:      ${chalk.red(inv.errorMessage)}`);
          }
          writeLine(chalk.dim('   ' + '─'.repeat(40)));
        });

      } catch (e: unknown) {
        spinner.fail(chalk.red('Hiba az adatok lekérésekor'));
        console.error(chalk.red(ensureError(e).message));
      }
    });

  invoice
    .command('process')
    .description('Számlafeldolgozási folyamat manuális indítása')
    .action(async () => {
      const spinner = ora('L5 Pipeline indítása...').start();
      try {
        const res = await fetch('http://localhost:3000/api/v1/agents/InvoiceAutomation/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: 'process all invoices from gmail' })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        spinner.succeed(chalk.green('Feldolgozás elindítva / befejezve.'));
        writeLine(JSON.stringify(result.data, null, 2));
      } catch (e: unknown) {
        spinner.fail(chalk.red('Indítás sikertelen'));
        console.error(chalk.red(ensureError(e).message));
      }
    });
}

